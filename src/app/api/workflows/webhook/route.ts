import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflow-engine";
import { webhookRateLimiter } from "@/lib/rate-limit";
import { withErrorHandler } from "@/lib/api-utils";
import { webhookLogger } from "@/lib/logger";

function resolveClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0"
  );
}

function safeStrEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, Buffer.alloc(ab.length));
    return false;
  }
  return timingSafeEqual(ab, bb);
}

function audit(entry: {
  result: "granted" | "denied" | "rate_limited" | "disabled";
  ip: string;
  workflowId?: string;
}) {
  try {
    db.agentAction
      .create({
        data: {
          type: "audit",
          severity: entry.result === "denied" ? "warning" : "info",
          title: `🌐 Webhook ${entry.result}`,
          description: `IP: ${entry.ip}${entry.workflowId ? ` | workflowId: ${entry.workflowId}` : ""}`,
          status: "active",
          payload: JSON.stringify(entry).slice(0, 4000),
          organizationId: "default",
        },
      })
      .catch(() => {});
  } catch (e) { webhookLogger.warn({ module: "webhook" }, "catch swallowed: auditar entrada de webhook") }
}

const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "set-cookie", "x-api-key"]);

async function postHandler(req: NextRequest) {
  const ip = resolveClientIp(req);

  const { allowed } = webhookRateLimiter(ip);
  if (!allowed) {
    audit({ result: "rate_limited", ip });
    return NextResponse.json(
      { error: "Demasiadas peticiones. Reintentá en un minuto." },
      { status: 429 },
    );
  }

  const expectedApiKey = process.env.WEBHOOK_API_KEY || "";
  const expectedSecret = process.env.WEBHOOK_SECRET || "";

  if (!expectedApiKey && !expectedSecret) {
    audit({ result: "disabled", ip });
    return NextResponse.json(
      {
        error:
          "Webhook no configurado. Seteá WEBHOOK_API_KEY o WEBHOOK_SECRET en las variables de entorno.",
      },
      { status: 503 },
    );
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    audit({ result: "denied", ip });
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const headers = Object.fromEntries(
    Array.from(req.headers.entries()).filter(([k]) => !SENSITIVE_HEADERS.has(k.toLowerCase()))
  );
  const apiKey = (headers["x-api-key"] as string) || body.apiKey;
  const webhookSecret = body.webhookSecret;

  let authenticated = false;

  if (expectedApiKey) {
    authenticated = safeStrEqual(apiKey || "", expectedApiKey);
  }
  if (!authenticated && expectedSecret) {
    authenticated = safeStrEqual(webhookSecret || "", expectedSecret);
  }

  if (!authenticated) {
    audit({ result: "denied", ip, workflowId: body.workflowId });
    return NextResponse.json(
      { error: "No autorizado. Proporcioná x-api-key o webhookSecret válido." },
      { status: 401 },
    );
  }

  audit({ result: "granted", ip, workflowId: body.workflowId });

  const vars: Record<string, any> = {
    webhook: {
      headers,
      body: body.data || body,
      receivedAt: new Date().toISOString(),
      source: req.headers.get("user-agent") || "unknown",
    },
  };

  if (body.workflowId && typeof body.workflowId !== "string") {
    return NextResponse.json({ error: "workflowId inválido" }, { status: 400 });
  }

  if (body.workflowId) {
    const workflow = await db.workflow.findUnique({
      where: { id: body.workflowId },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: `Workflow ${body.workflowId} no encontrado` },
        { status: 404 },
      );
    }

    if (!workflow.enabled) {
      return NextResponse.json(
        { error: `Workflow ${workflow.name} está deshabilitado` },
        { status: 403 },
      );
    }

    if (body.data) {
      Object.assign(vars, { payload: body.data });
    }

    const result = await executeWorkflow(workflow.id, "webhook", vars);

    return NextResponse.json({
      success: result.success,
      workflowId: workflow.id,
      workflowName: workflow.name,
      logs: result.logs.map((l) => ({
        step: l.stepLabel || l.stepType,
        status: l.status,
        error: l.error,
      })),
      executionId: result.execution?.id,
    });
  }

  const webhookWorkflows = await db.workflow.findMany({
    where: { enabled: true, trigger: "webhook" },
  });

  if (webhookWorkflows.length === 0) {
    return NextResponse.json({
      success: true,
      message:
        "No hay workflows con trigger webhook configurados. Los datos se recibieron correctamente.",
      received: true,
    });
  }

  if (body.data) {
    Object.assign(vars, { payload: body.data });
  }

  const results = await Promise.allSettled(
    webhookWorkflows.map((wf) => executeWorkflow(wf.id, "webhook", vars)),
  );

  const executions = webhookWorkflows.map((wf, i) => ({
    workflowId: wf.id,
    workflowName: wf.name,
    status:
      results[i].status === "fulfilled"
        ? (results[i] as PromiseFulfilledResult<any>).value.success
          ? "completed"
          : "failed"
        : "error",
    error:
      results[i].status === "rejected"
        ? (results[i] as PromiseRejectedResult).reason?.message
        : undefined,
  }));

  const allOk = executions.every((e) => e.status === "completed");

  return NextResponse.json({
    success: allOk,
    totalWorkflows: webhookWorkflows.length,
    executions,
  });
}

export const POST = withErrorHandler(postHandler);
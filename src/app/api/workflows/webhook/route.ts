import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executeWorkflow } from "@/lib/workflow-engine";

// POST /api/workflows/webhook - Disparar un workflow desde un webhook externo
// Se autentica via API key o via secret compartido en el webhook
//
// Uso:
//   POST /api/workflows/webhook
//   Headers: { "x-api-key": "tu-api-key" }
//   Body: { workflowId?: string, trigger?: string, data?: any }
//
//   O con secret en el body:
//   POST /api/workflows/webhook
//   Body: { webhookSecret: "tu-secret", workflowId: "...", data: {...} }
//
//   Si no se especifica workflowId, se ejecutan TODOS los workflows
//   cuyo trigger sea "webhook" y estén activos.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const headers = Object.fromEntries(req.headers);

    // ─── 1. Autenticación ───
    const apiKey = (headers["x-api-key"] as string) || body.apiKey;
    const webhookSecret = body.webhookSecret;

    // Verificar contra la API key guardada en las variables de entorno
    const expectedApiKey = process.env.WEBHOOK_API_KEY;
    const expectedWebhookSecret = process.env.WEBHOOK_SECRET;

    const isAuthenticated =
      (expectedApiKey && apiKey === expectedApiKey) ||
      (expectedWebhookSecret && webhookSecret === expectedWebhookSecret);

    if (!isAuthenticated) {
      return NextResponse.json(
        { error: "No autorizado. Proporcioná x-api-key o webhookSecret válido." },
        { status: 401 }
      );
    }

    // ─── 2. Preparar variables de contexto ───
    const vars: Record<string, any> = {
      webhook: {
        headers,
        body: body.data || body,
        receivedAt: new Date().toISOString(),
        source: req.headers.get("user-agent") || "unknown",
      },
    };

    // Si se especifica un workflowId, ejecutar solo ese workflow
    if (body.workflowId) {
      const workflow = await db.workflow.findUnique({
        where: { id: body.workflowId },
      });

      if (!workflow) {
        return NextResponse.json(
          { error: `Workflow ${body.workflowId} no encontrado` },
          { status: 404 }
        );
      }

      if (!workflow.enabled) {
        return NextResponse.json(
          { error: `Workflow ${workflow.name} está deshabilitado` },
          { status: 403 }
        );
      }

      // Pasar data del webhook como variables
      if (body.data) {
        Object.assign(vars, { payload: body.data });
      }

      const result = await executeWorkflow(workflow.id, "webhook", vars);

      return NextResponse.json({
        success: result.success,
        workflowId: workflow.id,
        workflowName: workflow.name,
        logs: result.logs.map(l => ({
          step: l.stepLabel || l.stepType,
          status: l.status,
          error: l.error,
        })),
        executionId: result.execution?.id,
      });
    }

    // ─── 3. Si no hay workflowId, ejecutar todos los workflows con trigger "webhook" ───
    const webhookWorkflows = await db.workflow.findMany({
      where: { enabled: true, trigger: "webhook" },
    });

    if (webhookWorkflows.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No hay workflows con trigger webhook configurados. Los datos se recibieron correctamente.",
        received: true,
      });
    }

    // Pasar data del webhook como variables
    if (body.data) {
      Object.assign(vars, { payload: body.data });
    }

    const results = await Promise.allSettled(
      webhookWorkflows.map(wf => executeWorkflow(wf.id, "webhook", vars))
    );

    const executions = webhookWorkflows.map((wf, i) => ({
      workflowId: wf.id,
      workflowName: wf.name,
      status: results[i].status === "fulfilled"
        ? (results[i] as PromiseFulfilledResult<any>).value.success ? "completed" : "failed"
        : "error",
      error: results[i].status === "rejected"
        ? (results[i] as PromiseRejectedResult).reason?.message
        : undefined,
    }));

    const allOk = executions.every(e => e.status === "completed");

    return NextResponse.json({
      success: allOk,
      totalWorkflows: webhookWorkflows.length,
      executions,
    });
  } catch (error: any) {
    console.error("[API] POST /api/workflows/webhook:", error.message);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}

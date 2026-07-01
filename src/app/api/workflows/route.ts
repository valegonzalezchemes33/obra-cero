import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, authRequiredResponse, AuthRequiredError, RateLimitError, rateLimitResponse } from "@/lib/api-utils";
import { parseBody, validateBody, WorkflowCreateSchema, WorkflowUpdateSchema } from "@/lib/validation";
import { apiLogger } from "@/lib/logger";
import { getCached } from "@/lib/cache";
import { getTenant, orgScope } from "@/lib/tenant";

export async function GET() {
  try {
    const tenant = await getTenant();
    const workflows = await getCached(`workflows:list:${tenant.organizationId}`, () =>
      db.workflow.findMany({
        where: { organizationId: tenant.organizationId },
        include: {
          steps: { orderBy: { order: "asc" } },
          executions: { orderBy: { startedAt: "desc" }, take: 1, select: { id: true, status: true, startedAt: true, completedAt: true, error: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }), 15000);
    return NextResponse.json(workflows);
  } catch (error: any) {
    apiLogger.error({ module: "API", path: "/api/workflows" }, error.message)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const tenant = await getTenant();
    const parsed = await parseBody(req, WorkflowCreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const workflow = await db.workflow.create({
      data: orgScope(tenant, {
        name: body.name,
        description: body.description || null,
        trigger: body.trigger || "manual",
        triggerConfig: body.triggerConfig ? JSON.stringify(body.triggerConfig) : null,
        enabled: body.enabled ?? true,
      }),
    });

    if (body.steps && Array.isArray(body.steps)) {
      await db.$transaction(async (tx) => {
        for (let i = 0; i < body.steps!.length; i++) {
          const step = body.steps![i];
          await tx.workflowStep.create({
            data: {
              workflowId: workflow.id,
              type: step.type,
              label: step.label || null,
              config: JSON.stringify(step.config || step),
              order: step.order ?? (i + 1) * 10,
              parentId: step.parentId || null,
            },
          });
        }
      });
    }

    const full = await db.workflow.findUnique({
      where: { id: workflow.id },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (error: any) {
    if (error instanceof RateLimitError) return rateLimitResponse();
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    apiLogger.error({ module: "API", path: "/api/workflows" }, error.message)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireSession();
    const tenant = await getTenant();
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }
    const id = body.id;
    const parsed = validateBody(WorkflowUpdateSchema, body);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    await db.$transaction(async (tx) => {
      await tx.workflow.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          trigger: data.trigger,
          triggerConfig: data.triggerConfig ? JSON.stringify(data.triggerConfig) : undefined,
          enabled: data.enabled,
        },
      });

      if (data.steps && Array.isArray(data.steps)) {
        await tx.workflowStep.deleteMany({ where: { workflowId: id } });
        for (let i = 0; i < data.steps.length; i++) {
          const step = data.steps[i];
          await tx.workflowStep.create({
            data: {
              workflowId: id,
              type: step.type,
              label: step.label || null,
              config: JSON.stringify(step.config || step),
              order: step.order ?? (i + 1) * 10,
              parentId: step.parentId || null,
            },
          });
        }
      }
    });

    const full = await db.workflow.findUnique({
      where: { id },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json(full);
  } catch (error: any) {
    if (error instanceof RateLimitError) return rateLimitResponse();
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    apiLogger.error({ module: "API", path: "/api/workflows" }, error.message)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireSession();
    const tenant = await getTenant();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    const orgFilter = { organizationId: tenant.organizationId };
    await db.workflowStep.deleteMany({ where: { workflowId: id, ...orgFilter } });
    await db.workflowExecution.deleteMany({ where: { workflowId: id, ...orgFilter } });
    await db.workflow.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error instanceof RateLimitError) return rateLimitResponse();
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    apiLogger.error({ module: "API", path: "/api/workflows" }, error.message)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/workflows - Listar todos los workflows
export async function GET() {
  try {
    const workflows = await db.workflow.findMany({
      include: {
        steps: { orderBy: { order: "asc" } },
        executions: { orderBy: { startedAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(workflows);
  } catch (error: any) {
    console.error("[API] GET /api/workflows:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

// POST /api/workflows - Crear un nuevo workflow
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workflow = await db.workflow.create({
      data: {
        name: body.name,
        description: body.description || null,
        trigger: body.trigger || "manual",
        triggerConfig: body.triggerConfig ? JSON.stringify(body.triggerConfig) : null,
        enabled: body.enabled ?? true,
      },
    });

    // Crear pasos si se enviaron
    if (body.steps && Array.isArray(body.steps)) {
      for (let i = 0; i < body.steps.length; i++) {
        const step = body.steps[i];
        await db.workflowStep.create({
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
    }

    const full = await db.workflow.findUnique({
      where: { id: workflow.id },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (error: any) {
    console.error("[API] POST /api/workflows:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

// PATCH /api/workflows - Actualizar workflow completo (con pasos)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // Actualizar workflow
    await db.workflow.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        trigger: data.trigger,
        triggerConfig: data.triggerConfig ? JSON.stringify(data.triggerConfig) : undefined,
        enabled: data.enabled,
      },
    });

    // Reemplazar pasos si se enviaron
    if (data.steps && Array.isArray(data.steps)) {
      await db.workflowStep.deleteMany({ where: { workflowId: id } });
      for (let i = 0; i < data.steps.length; i++) {
        const step = data.steps[i];
        await db.workflowStep.create({
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

    const full = await db.workflow.findUnique({
      where: { id },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json(full);
  } catch (error: any) {
    console.error("[API] PATCH /api/workflows:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

// DELETE /api/workflows - Eliminar workflow (por query param ?id=xxx)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    await db.workflowStep.deleteMany({ where: { workflowId: id } });
    await db.workflowExecution.deleteMany({ where: { workflowId: id } });
    await db.workflow.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[API] DELETE /api/workflows:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

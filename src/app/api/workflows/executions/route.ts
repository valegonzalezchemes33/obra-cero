import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/workflows/executions - Listar ejecuciones
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workflowId = searchParams.get("workflowId");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: any = {};
    if (workflowId) where.workflowId = workflowId;

    const executions = await db.workflowExecution.findMany({
      where,
      include: { workflow: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    return NextResponse.json(executions);
  } catch (error: any) {
    console.error("[API] GET /api/workflows/executions:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, authRequiredResponse, AuthRequiredError, RateLimitError, rateLimitResponse } from "@/lib/api-utils";
import { apiLogger } from "@/lib/logger";

// GET /api/workflows/executions - Listar ejecuciones
export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const workflowId = searchParams.get("workflowId");
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "50") || 50), 500);

    const where: { workflowId?: string } = {};
    if (workflowId) where.workflowId = workflowId;

    const executions = await db.workflowExecution.findMany({
      where,
      include: { workflow: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    return NextResponse.json(executions);
  } catch (error: any) {
    apiLogger.error({ module: "API", path: "/api/workflows/executions" }, error.message)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

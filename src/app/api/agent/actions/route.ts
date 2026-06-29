import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, authRequiredResponse, AuthRequiredError } from "@/lib/api-utils";

export async function GET() {
  try {
    const actions = await db.agentAction.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json(actions);
  } catch (error: any) {
    console.error("[API] GET /api/agent/actions:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireSession();
    const body = await req.json();
    const { id, ids, status } = body;

    const targetIds = ids || (id ? [id] : []);
    if (targetIds.length === 0) {
      return NextResponse.json({ error: "Se requiere id o ids" }, { status: 400 });
    }

    const result = await db.agentAction.updateMany({
      where: { id: { in: targetIds } },
      data: { status: status || "resolved" },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error: any) {
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    console.error("[API] PATCH /api/agent/actions:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

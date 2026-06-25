import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - listar acciones del agente
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

// PATCH - marcar acción como resuelta o descartada
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;
    const action = await db.agentAction.update({
      where: { id },
      data: { status },
    });
    return NextResponse.json(action);
  } catch (error: any) {
    console.error("[API] PATCH /api/agent/actions:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

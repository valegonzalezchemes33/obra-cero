import { NextRequest, NextResponse } from "next/server";
import { processAgentMessage, runAutomations } from "@/lib/agent";

// POST /api/agent - Enviar mensaje al agente
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message: string = body.message || "";
    if (!message.trim()) {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
    }
    const response = await processAgentMessage(message);
    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[API] POST /api/agent:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

// GET /api/agent - Correr automatizaciones y devolver acciones activas
export async function GET() {
  try {
    const { db } = await import("@/lib/db");
    await runAutomations();
    const actions = await db.agentAction.findMany({
      where: { status: "active" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ actions });
  } catch (error: any) {
    console.error("[API] GET /api/agent:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

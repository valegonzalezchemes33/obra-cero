import { NextRequest, NextResponse } from "next/server";
import { processAgentMessage, runAutomations } from "@/lib/agent";

// POST /api/agent - Enviar mensaje al agente
export async function POST(req: NextRequest) {
  const body = await req.json();
  const message: string = body.message || "";
  if (!message.trim()) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }
  const response = await processAgentMessage(message);
  return NextResponse.json(response);
}

// GET /api/agent - Correr automatizaciones y devolver acciones activas
export async function GET() {
  // Importar db aquí para evitar dependencias circulares en el tipo de import
  const { db } = await import("@/lib/db");
  await runAutomations();
  const actions = await db.agentAction.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ actions });
}

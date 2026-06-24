import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/agent/conversation - Historial de conversación
export async function GET() {
  const messages = await db.agentMessage.findMany({
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return NextResponse.json(messages);
}

// DELETE - Limpiar conversación
export async function DELETE() {
  await db.agentMessage.deleteMany({});
  return NextResponse.json({ ok: true });
}

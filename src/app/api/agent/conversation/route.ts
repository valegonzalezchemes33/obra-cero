import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/agent/conversation - Historial de conversación
export async function GET() {
  try {
    const messages = await db.agentMessage.findMany({
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return NextResponse.json(messages);
  } catch (error: any) {
    console.error("[API] GET /api/agent/conversation:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

// DELETE - Limpiar conversación
export async function DELETE() {
  try {
    await db.agentMessage.deleteMany({});
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[API] DELETE /api/agent/conversation:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

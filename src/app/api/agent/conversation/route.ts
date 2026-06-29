import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, authRequiredResponse, AuthRequiredError } from "@/lib/api-utils";

export async function GET() {
  try {
    const messages = await db.agentMessage.findMany({
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error("[API] GET /api/agent/conversation:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await requireSession();
    await db.agentMessage.deleteMany({});
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    console.error("[API] DELETE /api/agent/conversation:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

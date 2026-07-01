import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, authRequiredResponse, AuthRequiredError, RateLimitError, rateLimitResponse } from "@/lib/api-utils";
import { apiLogger } from "@/lib/logger";

export async function GET() {
  try {
    const messages = await db.agentMessage.findMany({
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return NextResponse.json({ messages });
  } catch (error: any) {
    apiLogger.error({ module: "API", path: "/api/agent/conversation" }, error.message);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await requireSession();
    await db.agentMessage.deleteMany({});
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error instanceof RateLimitError) return rateLimitResponse();
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    apiLogger.error({ module: "API", path: "/api/agent/conversation" }, error.message);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

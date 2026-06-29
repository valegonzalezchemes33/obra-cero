import { NextRequest, NextResponse } from "next/server";
import { runAutomations } from "@/lib/agent";
import { requireAgentApiKey, agentApiKeyRequiredResponse } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  if (!requireAgentApiKey(req)) return agentApiKeyRequiredResponse();
  try {
    const triggered = await runAutomations();
    return NextResponse.json({ triggered, count: triggered.length });
  } catch (error: any) {
    console.error("[API] POST /api/automations/run:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

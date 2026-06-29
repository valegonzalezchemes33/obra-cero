import { NextRequest, NextResponse } from "next/server";
import { runScheduler } from "@/lib/workflow-engine";
import { requireAgentApiKey, agentApiKeyRequiredResponse } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  if (!requireAgentApiKey(req)) return agentApiKeyRequiredResponse();
  try {
    const results = await runScheduler();
    return NextResponse.json({ triggered: results.length, results });
  } catch (error: any) {
    console.error("[API] POST /api/scheduler/run:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

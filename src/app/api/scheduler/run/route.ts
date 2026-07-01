import { NextRequest, NextResponse } from "next/server";
import { runScheduler } from "@/lib/workflow-engine";
import { requireAgentApiKey, agentApiKeyRequiredResponse } from "@/lib/api-utils";
import { apiLogger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  if (!requireAgentApiKey(req)) return agentApiKeyRequiredResponse();
  try {
    const results = await runScheduler();
    return NextResponse.json({ triggered: results.length, results });
  } catch (error: any) {
    apiLogger.error({ module: "API", path: "/api/scheduler/run" }, error.message);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

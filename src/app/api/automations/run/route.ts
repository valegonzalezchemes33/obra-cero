import { NextRequest, NextResponse } from "next/server";
import { runAutomations } from "@/lib/agent";
import { requireAgentApiKey, agentApiKeyRequiredResponse } from "@/lib/api-utils";
import { apiLogger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  if (!requireAgentApiKey(req)) return agentApiKeyRequiredResponse();
  try {
    const triggered = await runAutomations();
    return NextResponse.json({ triggered, count: triggered.length });
  } catch (error: any) {
    apiLogger.error({ module: "API", path: "/api/automations/run" }, error.message);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

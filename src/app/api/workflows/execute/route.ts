import { NextRequest, NextResponse } from "next/server";
import { executeWorkflow } from "@/lib/workflow-engine";
import { requireAgentApiKey, agentApiKeyRequiredResponse } from "@/lib/api-utils";
import { apiLogger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  if (!requireAgentApiKey(req)) return agentApiKeyRequiredResponse();
  try {
    const body = await req.json();
    const { workflowId, vars } = body;

    if (!workflowId) {
      return NextResponse.json({ error: "workflowId requerido" }, { status: 400 });
    }

    const result = await executeWorkflow(workflowId, "manual", vars || {});
    return NextResponse.json(result);
  } catch (error: any) {
    apiLogger.error({ module: "API", path: "/api/workflows/execute" }, error.message)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

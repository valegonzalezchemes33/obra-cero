import type { BrainQuery, BrainResponse, BrainTool, BrainMemory } from "./types";
import { loadMemory } from "./memory";

// ── Tool Registry ──

const toolRegistry = new Map<string, BrainTool>();

export function registerTool(tool: BrainTool): void {
  toolRegistry.set(tool.name, tool);
}

export function getTools(): Map<string, BrainTool> {
  return toolRegistry;
}

export function getToolNames(): string[] {
  return [...toolRegistry.keys()];
}

// ── Core query engine ──

function intentToTool(intent: string): string[] {
  const map: Record<string, string[]> = {
    context: ["get_context"],
    architecture: ["explain_architecture"],
    search: ["search"],
    query: ["search", "get_context"],
    analyze: ["analyze_impact"],
    plan: ["plan_feature"],
    design: ["plan_feature"],
    "before-change": ["plan_feature", "analyze_impact", "project_health"],
    "before_change": ["plan_feature", "analyze_impact", "project_health"],
    "dead-code": ["project_health"],
    "unused-routes": ["project_health"],
    "circular-deps": ["project_health"],
    module: ["summarize_module"],
    health: ["project_health"],
    feedback: ["feedback"],
    ask: ["get_context", "search", "analyze_impact", "plan_feature", "project_health"],
  };
  return map[intent] || ["search"];
}

export async function query(q: BrainQuery): Promise<BrainResponse> {
  const start = Date.now();
  const warnings: string[] = [];
  const toolsUsed: string[] = [];

  // Guard: health check first
  if (q.intent !== "health" && q.intent !== "feedback") {
    try {
      const healthTool = toolRegistry.get("project_health");
      if (healthTool) {
        const mem = await loadMemory();
        const health = await healthTool.execute({}, mem);
        if (health.overall === "critical") {
          warnings.push("CRITICAL: El proyecto tiene problemas de salud. Ejecutar health para más detalles.");
        }
        if (health.warnings?.length > 0) {
          warnings.push(...health.warnings.slice(0, 3));
        }
      }
    } catch { /* health check best-effort */ }
  }

  // Resolve tools for this intent
  const toolNames = intentToTool(q.intent);
  const memory = await loadMemory();

  // Execute tools
  const results: any[] = [];
  for (const name of toolNames) {
    const tool = toolRegistry.get(name);
    if (!tool) {
      warnings.push("Tool not found: " + name);
      continue;
    }
    try {
      toolsUsed.push(name);
      const params: any = { ...q.options };
      if (q.target) params.target = q.target;
      if (q.context) params.context = q.context;
      if (name === "search") params.query = q.target;
      if (name === "plan_feature") {
        params.feature = q.target || q.context || "";
        params.mode = q.intent === "design" ? "design" : q.intent === "before-change" || q.intent === "before_change" ? "before-change" : "estimate";
      }
      if (name === "analyze_impact") params.target = q.target || "";
      if (name === "summarize_module") params.path = q.target || "";
      if (name === "feedback") {
        params.task = q.target || q.context || "";
        params.result = q.options?.result || "completed";
        params.success = q.options?.success ?? true;
      }
      const result = await tool.execute(params, memory);
      results.push({ tool: name, data: result });
    } catch (err: any) {
      warnings.push(`Tool ${name} failed: ${err.message}`);
    }
  }

  // Merge results
  let merged: any;
  if (results.length === 1) {
    merged = results[0].data;
  } else if (results.length > 1) {
    merged = { multi: true, tools: results.map((r) => ({ tool: r.tool, data: r.data })) };
  } else {
    merged = { error: "No tools could execute this query" };
  }

  const confidence = warnings.length > 0 ? Math.max(0.5, 1 - warnings.length * 0.15) : 0.95;

  return {
    intent: q.intent,
    success: results.length > 0,
    data: merged,
    toolsUsed,
    confidence,
    warnings,
    duration: Date.now() - start,
  };
}

// ── Initialize ──

export async function initBrain(): Promise<void> {
  const tools = [
    (await import("./tools/context.tool")).ContextTool,
    (await import("./tools/search.tool")).SearchTool,
    (await import("./tools/impact.tool")).ImpactTool,
    (await import("./tools/planning.tool")).PlanTool,
    (await import("./tools/module.tool")).ModuleTool,
    (await import("./tools/architecture.tool")).ArchitectureTool,
    (await import("./tools/health.tool")).HealthTool,
    (await import("./tools/feedback.tool")).FeedbackTool,
  ];

  for (const Tool of tools) {
    registerTool(new Tool());
  }
}

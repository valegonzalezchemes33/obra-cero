import { BaseTool } from "./base.tool";
import type { BrainMemory, HealthMetrics } from "../types";
import { analyzeFeedback } from "./feedback.tool";

export class HealthTool extends BaseTool {
  name = "project_health";
  description = "Genera métricas de salud del proyecto: build, tests, dead code, dependencias circulares, feedback rate.";
  inputSchema = { type: "object", properties: {}, required: [] };

  async execute(_params: any, memory: BrainMemory) {
    const s = memory.state;
    const fb = analyzeFeedback(memory.feedback);
    const si = memory.knowledge["semantic-index"];

    // Dead code estimation
    let deadCodeCount = 0;
    const allItems: any[] = [];
    for (const val of Object.values(memory.knowledge)) {
      if (val?.items) allItems.push(...val.items);
      if (val?.modules) {
        for (const mod of val.modules) {
          if (mod.items) allItems.push(...mod.items);
        }
      }
    }

    // Simple heuristic: count items with no relations
    const allRelations = new Set<string>();
    const deps = memory.knowledge.dependencies;
    if (deps?.codeRelations) {
      for (const rel of deps.codeRelations) {
        allRelations.add(rel.source);
        allRelations.add(rel.target);
      }
    }

    // Count items not referenced in relations
    for (const item of allItems) {
      if (item.id && !allRelations.has(item.id)) deadCodeCount++;
    }

    // Circular deps count from dependencies
    const circularDepCount = countCycles(deps?.codeRelations || []);

    const health: HealthMetrics = {
      generatedAt: new Date().toISOString(),
      changeId: s.changeId || 0,
      buildStatus: s.lastBuildStatus || "UNKNOWN",
      testStatus: s.lastTestStatus || "UNKNOWN",
      moduleCount: allItems.length,
      routeCount: memory.knowledge.routes?.routes?.length || 0,
      modelCount: memory.knowledge.database?.models?.length || 0,
      agentCount: memory.knowledge.agents?.modules?.length || 0,
      testCount: s.stats?.tests || 0,
      deadCodeCount,
      circularDepCount,
      unusedRouteCount: 0,
      feedbackCount: memory.feedback.length,
      feedbackSuccessRate: fb.successRate !== 0 ? parseInt(fb.successRate) : 100,
      overall: "healthy",
      warnings: [],
    };

    // Determine health status
    if (health.buildStatus === "FAILED") {
      health.overall = "critical";
      health.warnings.push("Build fallando");
    }
    if (health.deadCodeCount > 20) {
      health.overall = health.overall === "healthy" ? "warning" : health.overall;
      health.warnings.push(health.deadCodeCount + " posibles módulos no utilizados");
    }
    if (health.circularDepCount > 0) {
      health.overall = health.overall === "healthy" ? "warning" : health.overall;
      health.warnings.push(health.circularDepCount + " dependencias circulares");
    }
    if (health.feedbackCount > 10 && health.feedbackSuccessRate < 60) {
      health.overall = "warning";
      health.warnings.push("Tasa de éxito baja: " + health.feedbackSuccessRate + "%");
    }

    return health;
  }
}

function countCycles(relations: { source: string; target: string }[]): number {
  const graph = new Map<string, string[]>();
  for (const rel of relations) {
    if (!graph.has(rel.source)) graph.set(rel.source, []);
    graph.get(rel.source)!.push(rel.target);
  }

  let cycles = 0;
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(node: string) {
    visited.add(node);
    recStack.add(node);
    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) dfs(neighbor);
      else if (recStack.has(neighbor)) cycles++;
    }
    recStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) dfs(node);
  }
  return cycles;
}

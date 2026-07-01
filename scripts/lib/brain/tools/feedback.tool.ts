import { BaseTool } from "./base.tool";
import type { BrainMemory, FeedbackEntry } from "../types";
import * as fs from "fs";
import * as path from "path";

export class FeedbackTool extends BaseTool {
  name = "feedback";
  description = "Registra feedback de una tarea ejecutada: resultado, errores, duración. El Brain usa estos datos para mejorar recomendaciones.";
  inputSchema = {
    type: "object",
    properties: {
      task: { type: "string", description: "Descripción de la tarea ejecutada" },
      solution: { type: "string", description: "Solución elegida" },
      result: { type: "string", description: "Resultado obtenido" },
      duration: { type: "number", description: "Duración en segundos" },
      errors: { type: "array", items: { type: "string" }, description: "Errores encontrados" },
      corrections: { type: "array", items: { type: "string" }, description: "Correcciones aplicadas" },
      agent: { type: "string", description: "Agente que ejecutó la tarea" },
      success: { type: "boolean", description: "Si la tarea se completó exitosamente" },
    },
    required: ["task", "result", "success"],
  };

  async execute(params: any, _memory: BrainMemory) {
    const entry: FeedbackEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toISOString(),
      task: params.task,
      solution: params.solution || "",
      result: params.result,
      duration: params.duration || 0,
      errors: params.errors || [],
      corrections: params.corrections || [],
      agent: params.agent || "unknown",
      success: params.success,
    };

    const feedbackDir = path.join(process.cwd(), ".ai", "feedback");
    fs.mkdirSync(feedbackDir, { recursive: true });
    const filename = new Date().toISOString().replace(/[:.]/g, "-") + ".json";
    fs.writeFileSync(path.join(feedbackDir, filename), JSON.stringify(entry, null, 2), "utf-8");

    return { recorded: true, id: entry.id, timestamp: entry.timestamp };
  }
}

// Analysis function for existing feedback
export function analyzeFeedback(feedback: FeedbackEntry[]) {
  if (feedback.length === 0) return { patterns: [], successRate: 0, totalTasks: 0 };

  const total = feedback.length;
  const successful = feedback.filter((f) => f.success).length;
  const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;

  // Find error patterns
  const errorMap = new Map<string, number>();
  for (const f of feedback) {
    for (const e of f.errors) {
      errorMap.set(e, (errorMap.get(e) || 0) + 1);
    }
  }
  const topErrors = [...errorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([error, count]) => ({ error, count, rate: Math.round((count / total) * 100) }));

  // Find patterns by agent
  const agentMap = new Map<string, { total: number; success: number }>();
  for (const f of feedback) {
    if (!agentMap.has(f.agent)) agentMap.set(f.agent, { total: 0, success: 0 });
    const a = agentMap.get(f.agent)!;
    a.total++;
    if (f.success) a.success++;
  }

  return {
    totalTasks: total,
    successRate: successRate + "%",
    topErrors,
    agentPerformance: [...agentMap.entries()].map(([agent, stats]) => ({
      agent,
      total: stats.total,
      successRate: Math.round((stats.success / stats.total) * 100) + "%",
    })),
  };
}

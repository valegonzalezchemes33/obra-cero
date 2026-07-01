import { BaseTool } from "./base.tool";
import type { BrainMemory } from "../types";

export class ContextTool extends BaseTool {
  name = "get_context";
  description = "Obtiene el contexto completo del proyecto: versión, stack, estadísticas, salud, agentes";
  inputSchema = { type: "object", properties: {}, required: [] };

  async execute(_params: any, memory: BrainMemory) {
    const s = memory.state;
    return {
      name: "ObraCero",
      version: s.version || "0.0.0",
      stack: ["Next.js", "Prisma", "Groq LLM", "Tailwind CSS", "shadcn/ui"],
      stats: s.stats || {},
      agents: s.agents || [],
      health: s.health || "unknown",
      changeId: s.changeId || 0,
      lastUpdated: s.lastUpdated || "unknown",
      pendingRefactors: s.pendingRefactors || [],
    };
  }
}

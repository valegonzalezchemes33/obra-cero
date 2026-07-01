import { BaseTool } from "./base.tool";
import type { BrainMemory } from "../types";

export class ModuleTool extends BaseTool {
  name = "summarize_module";
  description = "Resume un módulo del proyecto: tipo, descripción, dependencias, rutas asociadas, agentes relacionados.";
  inputSchema = {
    type: "object",
    properties: {
      path: { type: "string", description: "Ruta del módulo (src/lib/agent/dispatcher.ts, prisma/schema.prisma, etc.)" },
    },
    required: ["path"],
  };

  async execute(params: { path: string }, memory: BrainMemory) {
    const q = params.path.toLowerCase();
    const parts: string[] = [];

    // Find in modules knowledge
    const mods = memory.knowledge.modules;
    if (mods?.modules) {
      for (const m of mods.modules) {
        if (m.path?.toLowerCase() === q || m.name?.toLowerCase() === q) {
          parts.push("Tipo: " + (m.type || "desconocido"));
          parts.push("Descripción: " + (m.description || "Sin descripción"));
          if (m.dependencies?.length) {
            parts.push("Dependencias: " + m.dependencies.join(", "));
          }
        }
      }
    }

    // Find associated routes
    const routes = memory.knowledge.routes;
    if (routes?.routes) {
      const matches = routes.routes.filter(
        (r: any) => r.path?.toLowerCase().includes(q) || r.id?.toLowerCase().includes(q)
      );
      if (matches.length > 0) {
        parts.push("Rutas:");
        for (const r of matches) parts.push("  " + r.method + " " + (r.id || r.path));
      }
    }

    // Find associated agents
    const agents = memory.knowledge.agents;
    if (agents?.modules) {
      for (const mod of agents.modules) {
        for (const item of mod.items || []) {
          if (item.path?.toLowerCase().includes(q) || item.name?.toLowerCase().includes(q)) {
            parts.push("Módulo agente: " + item.name + " — " + (item.description || ""));
          }
        }
      }
    }

    if (parts.length === 0) parts.push("No se encontró información para: " + params.path);

    return { path: params.path, details: parts.join("\n") };
  }
}

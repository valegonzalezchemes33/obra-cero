import { BaseTool } from "./base.tool";
import type { BrainMemory } from "../types";

export class ArchitectureTool extends BaseTool {
  name = "explain_architecture";
  description = "Explica la arquitectura del proyecto: stack, capas, rutas principales, modelos DB, módulos agente.";
  inputSchema = { type: "object", properties: {}, required: [] };

  async execute(_params: any, memory: BrainMemory) {
    const parts: string[] = [];

    // Overview
    const overview = memory.architecture["overview"];
    if (overview) parts.push("## Overview\n" + overview.split("\n").slice(0, 20).join("\n"));

    // Backend routes
    const backend = memory.architecture["backend"];
    if (backend) {
      const lines = backend.split("\n");
      const routeLines = lines.filter((l: string) => l.startsWith("| `") || l.startsWith("|  "));
      parts.push("## Backend (" + routeLines.length + " rutas)\n" +
        routeLines.slice(0, 30).join("\n") + (routeLines.length > 30 ? "\n[...]" : ""));
    }

    // Database
    const database = memory.architecture["database"];
    if (database) {
      const lines = database.split("\n");
      const modelLines = lines.filter((l: string) => l.startsWith("| `") || l.startsWith("| `"));
      parts.push("## Database (" + modelLines.length + " modelos)\n" +
        modelLines.slice(0, 20).join("\n") + (modelLines.length > 20 ? "\n[...]" : ""));
    }

    // Agents
    const agents = memory.architecture["agents"];
    if (agents) {
      const lines = agents.split("\n");
      const agentLines = lines.filter((l: string) => l.startsWith("- **"));
      parts.push("## Agents (" + agentLines.length + " módulos)");
    }

    return parts.join("\n\n") || "No architecture data available.";
  }
}

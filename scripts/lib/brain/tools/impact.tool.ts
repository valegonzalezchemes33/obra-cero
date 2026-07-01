import { BaseTool } from "./base.tool";
import type { BrainMemory } from "../types";

export class ImpactTool extends BaseTool {
  name = "analyze_impact";
  description = "Analiza el impacto de modificar un archivo o concepto. Devuelve endpoints, agentes, DB, tests, integraciones afectados y nivel de riesgo.";
  inputSchema = {
    type: "object",
    properties: {
      target: { type: "string", description: "Archivo (src/...) o concepto (Project, Cliente, etc.)" },
    },
    required: ["target"],
  };

  async execute(params: { target: string }, memory: BrainMemory) {
    const target = params.target;

    // If it's a file path, use the legacy impact analyzer
    if (target.includes("/") || target.includes("\\") || target.endsWith(".ts")) {
      try {
        const { analyzeImpact } = await import("../../impact");
        const report = analyzeImpact(target);
        const total = report.endpoints.length + report.agents.length + report.components.length +
          report.databaseModels.length + report.automations.length + report.integrations.length;
        return {
          ...report,
          risk: total > 15 ? "high" : total > 5 ? "medium" : "low",
        };
      } catch {
        return { error: "Impact analysis failed for file: " + target };
      }
    }

    // If it's a concept, search semantic index
    const q = target.toLowerCase();
    const si = memory.knowledge["semantic-index"];
    const allModules = new Set<string>();
    const allRoutes = new Set<string>();
    const allAgents = new Set<string>();
    const allDB = new Set<string>();

    // Find matching concepts
    for (const c of si?.concepts || []) {
      if (
        c.concept.toLowerCase().includes(q) ||
        c.aliases?.some((a: string) => a.toLowerCase().includes(q)) ||
        q.includes(c.concept.toLowerCase())
      ) {
        for (const m of c.relatedModules || []) allModules.add(m);
        for (const r of c.routes || []) allRoutes.add(r);
        for (const a of c.agents || []) allAgents.add(a);
        for (const d of c.databaseModels || []) allDB.add(d);
      }
    }

    // Categorize
    const endpoints: string[] = [];
    const agents: string[] = [];
    const components: string[] = [];
    const tests: string[] = [];
    const automations: string[] = [];
    const integrations: string[] = [];

    for (const mod of allModules) {
      const ml = mod.toLowerCase();
      if (ml.includes("route.ts") || ml.includes("api/")) endpoints.push(mod);
      if (ml.includes("agent") || ml.includes("tool")) agents.push(mod);
      if (ml.includes("components/") && !ml.includes(".test.")) components.push(mod);
      if (ml.includes(".test.")) tests.push(mod);
      if (ml.includes("automation") || ml.includes("workflow")) automations.push(mod);
      if (ml.includes("monday") || ml.includes("integrat")) integrations.push(mod);
    }

    const total = endpoints.length + agents.length + components.length +
      allDB.size + tests.length + automations.length + integrations.length;

    return {
      target,
      summary: "Se verán afectados:\n" +
        (endpoints.length > 0 ? "  • " + endpoints.length + " endpoints\n" : "") +
        (agents.length > 0 ? "  • " + agents.length + " agentes IA\n" : "") +
        (components.length > 0 ? "  • " + components.length + " componentes\n" : "") +
        (allDB.size > 0 ? "  • " + allDB.size + " tablas DB\n" : "") +
        (tests.length > 0 ? "  • " + tests.length + " tests\n" : "") +
        (automations.length > 0 ? "  • " + automations.length + " automatizaciones\n" : "") +
        (integrations.length > 0 ? "  • " + integrations.length + " integraciones\n" : ""),
      endpoints, agents, components,
      databaseModels: [...allDB],
      tests, automations, integrations,
      risk: total > 15 ? "high" : total > 5 ? "medium" : "low",
    };
  }
}

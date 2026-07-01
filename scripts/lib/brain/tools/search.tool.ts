import { BaseTool } from "./base.tool";
import type { BrainMemory } from "../types";

export class SearchTool extends BaseTool {
  name = "search";
  description = "Busca en toda la memoria del proyecto: conceptos, rutas, módulos, agentes, términos de negocio";
  inputSchema = {
    type: "object",
    properties: {
      query: { type: "string", description: "Término de búsqueda" },
    },
    required: ["query"],
  };

  async execute(params: { query: string }, memory: BrainMemory) {
    const q = params.query.toLowerCase();
    const results: any[] = [];

    // Search semantic index concepts
    const si = memory.knowledge["semantic-index"];
    if (si?.concepts) {
      for (const c of si.concepts) {
        if (
          c.concept.toLowerCase().includes(q) ||
          c.aliases?.some((a: string) => a.toLowerCase().includes(q)) ||
          c.description?.toLowerCase().includes(q)
        ) {
          results.push({ type: "concept", item: c.concept, context: c.description, score: 10 });
        }
        for (const mod of c.relatedModules || []) {
          if (mod.toLowerCase().includes(q)) {
            results.push({ type: "module", item: mod, context: "Concepto: " + c.concept, score: 5 });
          }
        }
      }
    }

    // Search business terms
    if (si?.businessTerms) {
      for (const bt of si.businessTerms) {
        if (
          bt.term.toLowerCase().includes(q) ||
          bt.aliases?.some((a: string) => a.toLowerCase().includes(q))
        ) {
          results.push({ type: "business-term", item: bt.term, context: bt.description, score: 9 });
        }
      }
    }

    // Search routes
    const routes = memory.knowledge.routes;
    if (routes?.routes) {
      for (const r of routes.routes) {
        if (r.path?.toLowerCase().includes(q) || r.id?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)) {
          results.push({ type: "route", item: r.id || r.path, context: r.method + " " + r.description, score: 7 });
        }
      }
    }

    // Search DB models
    const db = memory.knowledge.database;
    if (db?.models) {
      for (const m of db.models) {
        if (m.name?.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q)) {
          results.push({ type: "database-model", item: m.name, context: (m.fields?.length || 0) + " fields", score: 8 });
        }
      }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);
    return { query: params.query, total: results.length, results: results.slice(0, 30) };
  }
}

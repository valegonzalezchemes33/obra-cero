import { BaseTool } from "./base.tool";
import type { BrainMemory } from "../types";

export class PlanTool extends BaseTool {
  name = "plan_feature";
  description = "Estima el impacto de una nueva funcionalidad: conceptos relacionados, módulos afectados, riesgo, patrones reutilizables, agente recomendado.";
  inputSchema = {
    type: "object",
    properties: {
      feature: { type: "string", description: "Nombre o descripción de la funcionalidad" },
      mode: { type: "string", enum: ["estimate", "design", "before-change"], description: "estimate = solo impacto, design = + arquitectura sugerida, before-change = plan de ejecución completo", default: "estimate" },
    },
    required: ["feature"],
  };

  async execute(params: { feature: string; mode?: string }, memory: BrainMemory) {
    const terms = params.feature.toLowerCase().split(/[\s_\-/]+/).filter((t) => t.length > 2);
    const si = memory.knowledge["semantic-index"];
    const allConcepts = si?.concepts || [];
    const businessTerms = si?.businessTerms || [];
    const relatedConcepts: string[] = [];

    for (const term of terms) {
      for (const c of allConcepts) {
        if (
          c.concept.toLowerCase().includes(term) ||
          term.includes(c.concept.toLowerCase()) ||
          c.aliases?.some((a: string) => a.toLowerCase().includes(term))
        ) {
          if (!relatedConcepts.includes(c.concept)) relatedConcepts.push(c.concept);
        }
      }
      for (const bt of businessTerms) {
        if (
          bt.term.toLowerCase().includes(term) ||
          bt.aliases?.some((a: string) => a.toLowerCase().includes(term))
        ) {
          if (!relatedConcepts.includes(bt.term)) relatedConcepts.push(bt.term);
        }
        if (bt.relatedConcepts) {
          for (const rc of bt.relatedConcepts) {
            if (rc.toLowerCase().includes(term) && !relatedConcepts.includes(rc)) {
              relatedConcepts.push(rc);
            }
          }
        }
      }
    }

    // Count affected items
    const affectedModules = new Set<string>();
    const affectedRoutes = new Set<string>();
    const affectedAgents = new Set<string>();
    const affectedDB = new Set<string>();

    for (const concept of relatedConcepts) {
      const c = allConcepts.find((cx: any) => cx.concept === concept);
      if (c) {
        for (const m of c.relatedModules || []) affectedModules.add(m);
        for (const r of c.routes || []) affectedRoutes.add(r);
        for (const a of c.agents || []) affectedAgents.add(a);
        for (const d of c.databaseModels || []) affectedDB.add(d);
      }
    }

    // Pattern count
    const patterns = memory.memory["patterns"] || "";
    const reusablePatterns = (patterns.match(/## /g) || []).length;

    // Risk
    const total = affectedModules.size + affectedAgents.size;
    const risk: "low" | "medium" | "high" = total > 20 ? "high" : total > 8 ? "medium" : "low";

    // Recommended agent
    let recommendedAgent = "InternalAgent";
    for (const term of terms) {
      if (["ocr", "document", "factur", "certific"].some((t) => term.includes(t))) {
        recommendedAgent = "DocumentAgent";
      }
      if (["monday", "calendar", "sync"].some((t) => term.includes(t))) {
        recommendedAgent = "InternalAgent";
      }
    }

    const result: any = {
      feature: params.feature,
      relatedConcepts,
      affectedModules: affectedModules.size,
      affectedRoutes: affectedRoutes.size,
      affectedDBModels: affectedDB.size,
      affectedAgents: affectedAgents.size,
      risk,
      reusablePatterns: Math.max(0, reusablePatterns - 4),
      recommendedAgent,
      estimatedFiles: total + affectedRoutes.size + affectedDB.size,
    };

    if (params.mode === "design") {
      const t0 = terms[0] || "feature";
      const pascal = t0.charAt(0).toUpperCase() + t0.slice(1);

      // Collect patterns
      const patternList: { name: string; location: string }[] = [];
      const patternLines = (patterns as string).split("\n");
      for (let i = 0; i < patternLines.length; i++) {
        if (patternLines[i].startsWith("## ") && !patternLines[i].includes("Common Abstractions")) {
          const name = patternLines[i].replace("## ", "").trim();
          const loc = (patternLines[i + 1] || "").replace("- **Location:** ", "").replace(/`/g, "").trim();
          patternList.push({ name, location: loc || "—" });
        }
      }

      // Decision history
      const decisions: string[] = [];
      const dec = memory.memory["decisions"] || "";
      for (const line of (dec as string).split("\n")) {
        if (line.startsWith("## ")) decisions.push(line.replace("## ", "").trim());
      }

      result.suggestedArchitecture = [
        "📦 Prisma model: " + pascal,
        "  ├── fields: id, code, name, status, ...",
        "  ├── relations: " + (relatedConcepts.join(", ") || "—"),
        "  └── indexes: code (unique)",
        "",
        "🌐 API Routes:",
        "  ├── GET    /api/" + t0 + "        → list",
        "  ├── POST   /api/" + t0 + "        → create",
        "  ├── GET    /api/" + t0 + "/[id]   → detail",
        "  ├── PATCH  /api/" + t0 + "/[id]   → update",
        "  └── DELETE /api/" + t0 + "/[id]   → delete",
        "",
        "🖥️ UI Components:",
        "  ├── " + pascal + "Page",
        "  ├── " + pascal + "Form",
        "  └── " + pascal + "DetailModal",
        "",
        "🤖 Agent integration:",
        "  ├── handlers: handle" + pascal + "()",
        "  └── intents: \"" + t0 + "\"",
        "",
        "⚡ Recomendación: Usar CRUD factory + " + recommendedAgent,
      ];
      result.patterns = patternList;
      result.databaseImpact = ["New table for " + params.feature, "Relations with: " + (relatedConcepts.join(", ") || "none")];
      result.routeImpact = ["New CRUD routes for /api/" + t0, "Integration with: " + (relatedConcepts.join(", ") || "none")];
      result.decisionHistory = decisions;
    }

    if (params.mode === "before-change") {
      const t0 = terms[0] || "feature";
      const pascal = t0.charAt(0).toUpperCase() + t0.slice(1);

      // Build an ordered execution plan
      const plan = [
        "1. Crear modelo Prisma " + pascal + " en schema.prisma",
        "2. Ejecutar migración: npx prisma migrate dev --name add_" + t0,
        "3. Generar tipos: npx prisma generate",
        "4. Crear endpoints CRUD en src/app/api/" + t0 + "/route.ts + [id]/route.ts",
        "5. Crear UI components: " + pascal + "Page, " + pascal + "Form, " + pascal + "DetailModal",
        "6. Registrar intents del agente para '" + t0 + "'",
        "7. Agregar handlers en src/lib/agent/handlers.ts",
        "8. Escribir tests: api/" + t0 + ", agent/" + t0,
        "9. Ejecutar tests: npx vitest run",
        "10. Regenerar memoria: npm run docs",
        "11. Registrar en memory/decisions.md",
      ];

      // Identify tests to run
      const testsToRun: string[] = [];
      if (affectedAgents.size > 0) testsToRun.push("agent/" + t0);
      testsToRun.push("api/" + t0);

      // Warnings from constitution rules
      const warnings: string[] = [];
      const rules = (memory.memory["rules"] || "").toLowerCase();
      if (!rules.includes("migración") && relatedConcepts.length > 0) {
        warnings.push("Recordatorio: crear migración Prisma antes de deploy.");
      }

      // Check for similar existing patterns
      const patterns = memory.memory["patterns"] || "";
      const patternLines = (patterns as string).split("\n").filter((l) => l.startsWith("## "));
      const similarPatterns = patternLines
        .map((l) => l.replace("## ", "").trim())
        .filter((p) => p.toLowerCase().includes(t0) || terms.some((t) => p.toLowerCase().includes(t)));

      if (similarPatterns.length > 0) {
        warnings.push("Patrón similar existente: " + similarPatterns[0] + ". Reutilizar antes de crear.");
      }

      result.plan = plan;
      result.testsToRun = testsToRun;
    }

    return result;
  }
}

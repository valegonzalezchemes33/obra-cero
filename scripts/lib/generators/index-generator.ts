import * as fs from "fs";
import * as path from "path";
import type { AnalyzerResult, Relation } from "../analyzer.interface";

function obsidianLink(name: string): string {
  return `[[${name}]]`;
}

export function generateIndexPages(
  results: Map<string, AnalyzerResult>,
  allRelations: Relation[],
  outputDir: string
): void {
  const docDir = path.join(outputDir, "docs-vault");
  fs.mkdirSync(docDir, { recursive: true });

  // ── Main INDEX.md ──
  const indexLines: string[] = [];
  indexLines.push("---");
  indexLines.push("type: index");
  indexLines.push("tags: [index, project, hub]");
  indexLines.push("title: \"ObraCero — Índice del Proyecto\"");
  indexLines.push("module: core");
  indexLines.push("status: active");
  indexLines.push("---");
  indexLines.push("");
  indexLines.push("# ObraCero — Índice del Proyecto");
  indexLines.push("");
  indexLines.push("Sistema CRM interno con Agente IA para la construcción.");
  indexLines.push("");
  indexLines.push("---");
  indexLines.push("");
  indexLines.push("Bienvenido al vault de documentación. Este archivo es el hub central del grafo de conocimiento.");
  indexLines.push("");
  indexLines.push("## Arquitectura");
  indexLines.push("");
  indexLines.push("| Nota | Descripción |");
  indexLines.push("|------|-------------|");
  indexLines.push("| [[architecture/overview]] | Visión general del stack y patrón de capas |");
  indexLines.push("| [[architecture/backend]] | API Routes (36), autenticación, patrones CRUD |");
  indexLines.push("| [[architecture/frontend]] | Next.js App Router, Tailwind, shadcn/ui |");
  indexLines.push("| [[architecture/database]] | Modelos Prisma (13), relaciones, convenciones |");
  indexLines.push("| [[architecture/agents]] | Sistema de agente IA, módulos, automatizaciones |");
  indexLines.push("");
  indexLines.push("## Memoria del Proyecto");
  indexLines.push("");
  indexLines.push("| Nota | Descripción |");
  indexLines.push("|------|-------------|");
  indexLines.push("| [[memory/roadmap]] | Features completadas, en progreso y planificadas |");
  indexLines.push("| [[memory/decisions]] | Decisiones de diseño registradas |");
  indexLines.push("| [[memory/patterns]] | Patrones de código (CRUD Factory, Caching, Agent Dispatch) |");
  indexLines.push("| [[memory/lessons]] | Lecciones aprendidas durante el desarrollo |");
  indexLines.push("| [[memory/ideas]] | Ideas para mejoras futuras |");
  indexLines.push("| [[memory/known-bugs]] | Bugs conocidos y su estado |");
  indexLines.push("");
  indexLines.push("## Agente IA");
  indexLines.push("");
  indexLines.push("| Nota | Descripción |");
  indexLines.push("|------|-------------|");
  indexLines.push("| [[agent-architecture]] | Arquitectura completa del agente conversacional |");
  indexLines.push("| [[agents/extending]] | Guía para extender el agente con nuevas capacidades |");
  indexLines.push("| [[agents/tools]] | Catálogo de herramientas del agente |");
  indexLines.push("");
  indexLines.push("## Base de Datos");
  indexLines.push("");
  indexLines.push("Modelos definidos en [[prisma/schema.prisma]]:");
  indexLines.push("");
  indexLines.push("| Modelo | Uso |");
  indexLines.push("|--------|-----|");
  indexLines.push("| Project | Proyectos de construcción |");
  indexLines.push("| Transaction | Transacciones financieras |");
  indexLines.push("| Task | Tareas operativas |");
  indexLines.push("| Supplier | Proveedores registrados |");
  indexLines.push("| Material | Materiales con control de stock |");
  indexLines.push("| StockMovement | Movimientos de inventario |");
  indexLines.push("| AutomationRule | Reglas de automatización |");
  indexLines.push("| Workflow / WorkflowStep / WorkflowExecution | Flujos de trabajo |");
  indexLines.push("| AgentSchedule / AgentAction / AgentMessage | Sistema de agente IA |");
  indexLines.push("");
  indexLines.push("---");
  indexLines.push("");
  indexLines.push("## Todos los Módulos");
  indexLines.push("");

  for (const [, result] of results) {
    const groupName = result.type.charAt(0).toUpperCase() + result.type.slice(1);
    indexLines.push(`### ${groupName}`);
    indexLines.push("");
    for (const item of result.items) {
      const linkName = item.path.replace(/\.(ts|tsx)$/, "").replace(/\\/g, "/");
      indexLines.push(`- ${obsidianLink(linkName)} — ${item.description || item.name}`);
    }
    indexLines.push("");
  }

  indexLines.push("## Relaciones entre módulos");
  indexLines.push("");
  indexLines.push(`Total: **${allRelations.length}** relaciones detectadas.`);
  indexLines.push("");

  // Agrupar relaciones por tipo
  const byType: Record<string, number> = {};
  for (const rel of allRelations) {
    byType[rel.type] = (byType[rel.type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    indexLines.push(`- **${type}**: ${count}`);
  }

  indexLines.push("");
  // ─── Dataview Dynamic Queries ───
  indexLines.push("");
  indexLines.push("## Vistas Dinámicas (Dataview)");
  indexLines.push("");
  indexLines.push("```dataview");
  indexLines.push('TABLE type AS "Tipo", module AS "Módulo", status AS "Estado"');
  indexLines.push('FROM "src" OR "scripts" OR "mcp-bridge"');
  indexLines.push('WHERE type');
  indexLines.push('SORT type ASC, module ASC');
  indexLines.push("```");
  indexLines.push("");
  indexLines.push("## Estadísticas");
  indexLines.push("");
  const stats: Record<string, number> = {};
  for (const [, result] of results) {
    for (const item of result.items) {
      stats[item.type] = (stats[item.type] || 0) + 1;
    }
  }
  for (const [type, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    indexLines.push(`- **${type}**: ${count}`);
  }
  indexLines.push(`- **Total**: ${Object.values(stats).reduce((a, b) => a + b, 0)}`);

  fs.writeFileSync(path.join(docDir, "INDEX.md"), indexLines.join("\n"), "utf-8");

  // ── Per-directory index.md files ──
  const dirs = new Map<string, { items: { id: string; name: string; path: string }[] }>();

  for (const [, result] of results) {
    for (const item of result.items) {
      const dir = path.dirname(item.path);
      if (!dirs.has(dir)) dirs.set(dir, { items: [] });
      dirs.get(dir)!.items.push({
        id: item.id,
        name: item.name,
        path: item.path.replace(/\.(ts|tsx)$/, ".md"),
      });
    }
  }

  for (const [dirPath, data] of dirs) {
    // Skip root-level files
    if (dirPath === ".") continue;

    const dirLine: string[] = [];
    dirLine.push("---");
    dirLine.push(`tags: [index, ${dirPath.replace(/\\/g, "/").split("/").pop()}]`);
    dirLine.push("---");
    dirLine.push("");
    dirLine.push(`# Índice: \`${dirPath}\``);
    dirLine.push("");

    const sorted = [...data.items].sort((a, b) => a.name.localeCompare(b.name));
    for (const item of sorted) {
      const linkName = item.path.replace(/\.(ts|tsx)$/, "").replace(/\\/g, "/");
      dirLine.push(`- ${obsidianLink(linkName)}`);
    }

    const targetDir = path.join(docDir, dirPath);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, "index.md"), dirLine.join("\n"), "utf-8");
  }
}

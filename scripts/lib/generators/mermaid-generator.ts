import * as fs from "fs";
import * as path from "path";
import type { AnalyzerResult, Relation } from "../analyzer.interface";

function escapeMermaid(text: string): string {
  return text.replace(/[()]/g, "").replace(/[\[\]]/g, "");
}

export function generateMermaidDiagrams(
  results: Map<string, AnalyzerResult>,
  allRelations: Relation[],
  outputDir: string
): void {
  const diagramDir = path.join(outputDir, "docs-vault", "diagrams");
  fs.mkdirSync(diagramDir, { recursive: true });

  // ── Architecture diagram ──
  const archLines: string[] = [];
  archLines.push("graph TD");
  archLines.push("  %% Architecture layers");

  const layers: Record<string, string[]> = {
    Presentation: [],
    API: [],
    Agent: [],
    Lib: [],
    Database: [],
    Config: [],
  };

  for (const [, result] of results) {
    for (const item of result.items) {
      const label = escapeMermaid(item.name.replace(/[^a-zA-Z0-9]/g, "_"));
      const layer = getLayer(item.type);
      const id = `${layer}_${label}`;
      layers[layer].push(`  ${id}["${item.name}"]`);
    }
  }

  // Add subgraphs
  archLines.push("");
  archLines.push("  subgraph Presentation[Presentación]");
  for (const l of layers.Presentation) archLines.push(l);
  archLines.push("  end");

  archLines.push("  subgraph API[API Routes]");
  for (const l of layers.API) archLines.push(l);
  archLines.push("  end");

  archLines.push("  subgraph Agent[Sistema Agente]");
  for (const l of layers.Agent) archLines.push(l);
  archLines.push("  end");

  archLines.push("  subgraph Lib[Bibliotecas]");
  for (const l of layers.Lib) archLines.push(l);
  archLines.push("  end");

  archLines.push("  subgraph DB[Base de Datos]");
  for (const l of layers.Database) archLines.push(l);
  archLines.push("  end");

  // Relations between layers
  archLines.push("");
  archLines.push("  %% Cross-layer connections");
  for (const rel of allRelations.slice(0, 50)) {
    const srcLabel = getItemLabel(rel.source, results);
    const tgtLabel = getItemLabel(rel.target, results);
    if (srcLabel && tgtLabel) {
      archLines.push(`  ${srcLabel} -->|${rel.type}| ${tgtLabel}`);
    }
  }

  const archContent = archLines.join("\n");
  fs.writeFileSync(path.join(diagramDir, "architecture.mmd"), archContent, "utf-8");

  // ── Database ER diagram ──
  const prismaResult = results.get("prisma");
  if (prismaResult && prismaResult.items.length > 0) {
    const erLines: string[] = [];
    erLines.push("erDiagram");

    for (const item of prismaResult.items) {
      const fields = item.metadata.fields as Record<string, string>[] || [];
      erLines.push(`  ${item.name} {`);
      for (const f of fields) {
        const type = f.type || "String";
        const pk = f.attributes?.includes("@id") ? " PK" : "";
        const required = f.required === "true" ? "" : " optional";
        erLines.push(`    ${type} ${f.name}${pk}${required}`);
      }
      erLines.push("  }");
    }

    for (const rel of prismaResult.relations) {
      const src = escapeMermaid(rel.source.replace("model:", ""));
      const tgt = escapeMermaid(rel.target.replace("model:", ""));
      const type = rel.type === "belongs_to" ? "||--o{" : "||--o{";
      erLines.push(`  ${src} ${type} ${tgt} : "${rel.metadata?.through || ""}"`);
    }

    fs.writeFileSync(path.join(diagramDir, "database.mmd"), erLines.join("\n"), "utf-8");
  }

  // ── Dependencies diagram ──
  const depLines: string[] = [];
  depLines.push("graph LR");
  depLines.push("  %% Module dependencies");

  const added = new Set<string>();
  for (const [, result] of results) {
    for (const item of result.items) {
      const label = escapeMermaid(item.id.replace(/[^a-zA-Z0-9:]/g, "_"));
      if (!added.has(label)) {
        depLines.push(`  ${label}["${item.id}"]`);
        added.add(label);
      }
      for (const dep of item.dependencies.slice(0, 5)) {
        const depLabel = escapeMermaid("dep_" + dep.replace(/[^a-zA-Z0-9]/g, "_"));
        if (!added.has(depLabel)) {
          depLines.push(`  ${depLabel}["${dep}"]`);
          added.add(depLabel);
        }
        depLines.push(`  ${label} --> ${depLabel}`);
      }
    }
  }

  fs.writeFileSync(path.join(diagramDir, "dependencies.mmd"), depLines.join("\n"), "utf-8");
}

function getLayer(type: string): string {
  switch (type) {
    case "page":
    case "layout":
    case "component":
      return "Presentation";
    case "route":
      return "API";
    case "agent-module":
    case "agent":
      return "Agent";
    case "model":
      return "Database";
    case "config":
      return "Config";
    default:
      return "Lib";
  }
}

function getItemLabel(id: string, results: Map<string, AnalyzerResult>): string | null {
  for (const [, result] of results) {
    for (const item of result.items) {
      if (item.id === id) {
        const label = escapeMermaid(item.name.replace(/[^a-zA-Z0-9]/g, "_"));
        return `${getLayer(item.type)}_${label}`;
      }
    }
  }
  return null;
}

import * as fs from "fs";
import * as path from "path";
import type { AnalyzerResult, AnalyzerItem, Relation } from "../analyzer.interface";

function buildIdToPathMap(results: Map<string, AnalyzerResult>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [, result] of results) {
    for (const item of result.items) {
      // Key: full item ID (e.g. "model:Material", "route:/api/materials")
      const linkPath = item.path.replace(/\.(ts|tsx)$/, "").replace(/\\/g, "/");
      map.set(item.id, linkPath);
      // Also key by just the bare name (for short references like "Material")
      const bareName = item.id.replace(/^[^:]+:/, "");
      if (bareName !== item.id) {
        map.set(bareName, linkPath);
      }
    }
  }
  return map;
}

function obsidianLink(id: string, idToPath: Map<string, string>): string {
  // Try to resolve via the ID-to-path map first
  if (idToPath.has(id)) {
    return `[[${idToPath.get(id)}]]`;
  }
  // Fallback: strip prefix and check again
  const bareName = id.replace(/^[^:]+:/, "");
  if (idToPath.has(bareName)) {
    return `[[${idToPath.get(bareName)}]]`;
  }
  // Last resort: use the bare name as-is
  return `[[${bareName}]]`;
}

function findRelated(id: string, allRelations: Relation[]): string[] {
  return allRelations
    .filter((r) => r.source === id || r.target === id)
    .map((r) => (r.source === id ? r.target : r.source));
}

/** Map item types to their architecture documentation note */
const ARCHITECTURE_BACKLINKS: Record<string, string> = {
  "model": "architecture/database",
  "route": "architecture/backend",
  "page": "architecture/frontend",
  "layout": "architecture/frontend",
  "loading": "architecture/frontend",
  "agent-module": "architecture/agents",
  "module": "architecture/backend",
  "automation": "architecture/agents",
  "config": "architecture/overview",
  "mcp": "architecture/agents",
};

function generateItemDoc(item: AnalyzerItem, relatedIds: string[], idToPath: Map<string, string>): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push(`type: ${item.type}`);
  lines.push(`tags: [${item.type}]`);
  lines.push(`aliases: [${item.name}]`);
  lines.push(`module: ${item.name}`);
  lines.push(`status: active`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${item.name}`);
  lines.push("");
  lines.push(item.description || `Módulo: ${item.name}`);
  lines.push("");
  lines.push("## Información");
  lines.push("");
  lines.push(`- **Tipo:** \`${item.type}\``);
  lines.push(`- **Ruta:** \`${item.path}\``);
  lines.push(`- **ID:** \`${item.id}\``);
  lines.push("");

  if (item.metadata && Object.keys(item.metadata).length > 0) {
    lines.push("## Metadatos");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(item.metadata, null, 2));
    lines.push("```");
    lines.push("");
  }

  // Always add architecture backlink based on item type
  const archLink = ARCHITECTURE_BACKLINKS[item.type];

  if (relatedIds.length > 0 || archLink) {
    lines.push("## Relacionado");
    lines.push("");

    // Architecture backlink first (maps item type → architecture doc)
    if (archLink) {
      lines.push(`- [[${archLink}|${item.type}]] — Arquitectura de ${item.type}s`);
    }

    // Then other related items from the relationship graph
    for (const rid of relatedIds) {
      lines.push(`- ${obsidianLink(rid, idToPath)}`);
    }
    lines.push("");
  }

  if (item.dependencies.length > 0) {
    lines.push("## Dependencias");
    lines.push("");
    for (const dep of item.dependencies) {
      lines.push(`- \`${dep}\``);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function generateDocs(
  results: Map<string, AnalyzerResult>,
  allRelations: Relation[],
  outputDir: string
): void {
  const docDir = path.join(outputDir, "docs-vault");
  fs.mkdirSync(docDir, { recursive: true });

  // Build lookup map: item ID → file path for Obsidian wikilinks
  const idToPath = buildIdToPathMap(results);

  for (const [, result] of results) {
    for (const item of result.items) {
      const related = findRelated(item.id, allRelations);
      const content = generateItemDoc(item, related, idToPath);

      // Each item gets its own .md file
      const itemPath = item.path.replace(/\.(ts|tsx)$/, ".md");
      const targetPath = path.join(docDir, itemPath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, content, "utf-8");
    }
  }
}

import * as fs from "fs";
import * as path from "path";
import type { AnalyzerResult, Relation, AnalyzerItem } from "./analyzer.interface";

export interface ImpactReport {
  file: string;
  timestamp: string;
  endpoints: string[];
  agents: string[];
  components: string[];
  databaseModels: string[];
  tests: string[];
  automations: string[];
  integrations: string[];
  relatedModules: string[];
  relationChains: { source: string; target: string; type: string }[];
  summary: string;
}

function loadResults(): Map<string, AnalyzerResult> | null {
  const indexPath = path.join(process.cwd(), "docs-vault", ".index");
  if (!fs.existsSync(indexPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    const results = new Map<string, AnalyzerResult>();
    for (const [key, val] of Object.entries(raw.analyzers as Record<string, any>)) {
      results.set(key, val as AnalyzerResult);
    }
    return results;
  } catch {
    return null;
  }
}

function matchItem(filePath: string, item: AnalyzerItem): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const itemPath = item.path.replace(/\\/g, "/");
  // Exact match
  if (itemPath === normalizedPath) return true;
  // Handle relative paths (e.g., "src/lib/agent/dispatcher.ts" matches item with that path)
  if (normalizedPath.endsWith("/" + itemPath) || itemPath.endsWith("/" + normalizedPath)) return true;

  // For route files, match by the API path prefix
  const fileBase = path.basename(normalizedPath);
  const fileDir = path.dirname(normalizedPath);
  if (fileBase === "route.ts" && itemPath === "route.ts") {
    // Both are generic "route.ts", match by directory
    return itemPath === normalizedPath || itemPath === normalizedPath.replace(/\\/g, "/");
  }

  return false;
}

function findItemForFile(filePath: string, results: Map<string, AnalyzerResult>): AnalyzerItem | null {
  const normalizedPath = filePath.replace(/\\/g, "/");
  for (const result of results.values()) {
    for (const item of result.items) {
      const itemPath = item.path.replace(/\\/g, "/");
      if (itemPath === normalizedPath) return item;
    }
  }
  return null;
}

export function analyzeImpact(filePath: string): ImpactReport {
  const results = loadResults();
  if (!results) {
    return {
      file: filePath,
      timestamp: new Date().toISOString(),
      endpoints: [],
      agents: [],
      components: [],
      databaseModels: [],
      tests: [],
      automations: [],
      integrations: [],
      relatedModules: [],
      relationChains: [],
      summary: "ERROR: No se pudo cargar .index. Ejecutar npm run docs primero.",
    };
  }

  const normalizedPath = filePath.replace(/\\/g, "/");
  const item = findItemForFile(normalizedPath, results);
  const fileName = path.basename(normalizedPath);
  const fileNameLower = fileName.toLowerCase();

  // Collect all items
  const allItems = [...results.values()].flatMap((r) => r.items);
  const allRelations: Relation[] = [...results.values()].flatMap((r) => r.relations);

  // Direct matches by path
  const directMatches = allItems.filter((i) => matchItem(normalizedPath, i));

  // Fuzzy matches by name/content reference (skip generic terms)
  const genericTerms = ["route", "page", "index", "layout", "loading", "error", "api", "lib", "src"];
  const nameBase = fileName.replace(/\.[^/.]+$/, "").toLowerCase();
  const nameHits: AnalyzerItem[] = [];
  if (!genericTerms.includes(nameBase) && nameBase.length > 2) {
    for (const i of allItems) {
      if (directMatches.includes(i)) continue;
      if (
        i.name.toLowerCase().includes(nameBase) ||
        (i.description || "").toLowerCase().includes(nameBase) ||
        i.path.toLowerCase().includes(nameBase)
      ) {
        nameHits.push(i);
      }
    }
  }

  const matchedItems = [...directMatches, ...nameHits];

  // Find relation chains (what imports/references this file)
  const relationChains = allRelations.filter((r) => {
    const targetMatch = matchedItems.some((m) => r.target === m.id);
    const sourceMatch = matchedItems.some((m) => r.source === m.id);
    return targetMatch || sourceMatch;
  });

  // Extract affected modules through relations
  const indirectlyAffected: string[] = [];
  for (const rel of relationChains) {
    const sourceItem = allItems.find((i) => i.id === rel.source);
    const targetItem = allItems.find((i) => i.id === rel.target);
    if (sourceItem && matchedItems.some((m) => m.id === rel.target) && !matchedItems.includes(sourceItem)) {
      indirectlyAffected.push(sourceItem.path);
    }
    if (targetItem && matchedItems.some((m) => m.id === rel.source) && !matchedItems.includes(targetItem)) {
      indirectlyAffected.push(targetItem.path);
    }
  }

  // Classify impacts
  const endpoints: string[] = [];
  const agents: string[] = [];
  const components: string[] = [];
  const databaseModels: string[] = [];
  const tests: string[] = [];
  const automations: string[] = [];
  const integrations: string[] = [];

  const allAffected = [...matchedItems.map((i) => i.path), ...indirectlyAffected];

  for (const p of allAffected) {
    const lower = p.toLowerCase();
    if (p.includes("route.ts") || lower.includes("api/")) {
      endpoints.push(p);
    }
    if (lower.includes("agent/") || lower.includes("tool")) {
      agents.push(p);
    }
    if (lower.includes("components/") && !lower.includes(".test.")) {
      components.push(p);
    }
    if (lower.startsWith("prisma/") || lower.includes("schema.prisma")) {
      // Find related models
      const modelItems = results.get("prisma")?.items ?? [];
      for (const m of modelItems) {
        if (!databaseModels.includes(m.name)) databaseModels.push(m.name);
      }
    }
    if (lower.includes(".test.")) {
      tests.push(p);
    }
    if (lower.includes("automation") || lower.includes("workflow") || lower.includes("scheduler")) {
      automations.push(p);
    }
    if (lower.includes("monday") || lower.includes("integrat")) {
      integrations.push(p);
    }
  }

  // Deduplicate
  const unique = (arr: string[]) => [...new Set(arr)];

  const sumEndpoints = unique(endpoints).length;
  const sumAgents = unique(agents).length;
  const sumComponents = unique(components).length;
  const sumDB = unique(databaseModels).length;
  const sumTests = unique(tests).length;
  const sumAutomations = unique(automations).length;
  const sumIntegrations = unique(integrations).length;

  let summary = `Se verán afectados:\n`;
  if (sumEndpoints > 0) summary += `  • ${sumEndpoints} endpoints\n`;
  if (sumAgents > 0) summary += `  • ${sumAgents} agentes IA\n`;
  if (sumComponents > 0) summary += `  • ${sumComponents} componentes React\n`;
  if (sumDB > 0) summary += `  • ${sumDB} tablas Prisma\n`;
  if (sumTests > 0) summary += `  • ${sumTests} tests\n`;
  if (sumAutomations > 0) summary += `  • ${sumAutomations} automatizaciones\n`;
  if (sumIntegrations > 0) summary += `  • ${sumIntegrations} integraciones\n`;
  if (sumEndpoints + sumAgents + sumComponents + sumDB + sumTests + sumAutomations + sumIntegrations === 0) {
    summary = "No se detectaron módulos afectados. Cambio de bajo impacto.";
  }

  return {
    file: normalizedPath,
    timestamp: new Date().toISOString(),
    endpoints: unique(endpoints),
    agents: unique(agents),
    components: unique(components),
    databaseModels: unique(databaseModels),
    tests: unique(tests),
    automations: unique(automations),
    integrations: unique(integrations),
    relatedModules: unique(allAffected),
    relationChains,
    summary,
  };
}

// ── CLI Entry Point ──
// Usage: npx tsx scripts/impact.ts -- src/lib/agent/dispatcher.ts

if (require.main === module) {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--");
  const targetFile = fileIdx >= 0 ? args[fileIdx + 1] : args[0];

  if (!targetFile) {
    console.error("Usage: npx tsx scripts/impact.ts -- <file-path>");
    process.exit(1);
  }

  const report = analyzeImpact(targetFile);
  console.log("=== Impact Analysis ===");
  console.log("File:", report.file);
  console.log("---");
  console.log(report.summary);
  console.log("---");
  if (report.endpoints.length > 0) console.log("Endpoints:", report.endpoints.join(", "));
  if (report.agents.length > 0) console.log("Agents:", report.agents.join(", "));
  if (report.components.length > 0) console.log("Components:", report.components.join(", "));
  if (report.databaseModels.length > 0) console.log("DB Models:", report.databaseModels.join(", "));
  if (report.tests.length > 0) console.log("Tests:", report.tests.join(", "));
  if (report.automations.length > 0) console.log("Automations:", report.automations.join(", "));
  if (report.integrations.length > 0) console.log("Integrations:", report.integrations.join(", "));
}

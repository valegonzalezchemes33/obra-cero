// ============================================================
// Project Intelligence System — Watch Mode
// Detects file changes and incrementally regenerates docs.
// ============================================================

import * as fs from "fs";
import * as path from "path";
import { scanFiles } from "./lib/project-scanner";
import { runAllAnalyzers } from "./lib/orchestrator";
import { buildIndex } from "./lib/index-builder";
import { generateDocs } from "./lib/generators/docs-generator";
import { generateMermaidDiagrams } from "./lib/generators/mermaid-generator";
import { generateIndexPages } from "./lib/generators/index-generator";
import { generateAiOutput } from "./lib/generators/ai-generator";
import { mergeRelations } from "./lib/orchestrator";
import type { Analyzer, AnalyzerResult } from "./lib/analyzer.interface";

const analyzers: Analyzer[] = [
  require("./lib/analyzers/prisma.analyzer").prismaAnalyzer,
  require("./lib/analyzers/pages.analyzer").pagesAnalyzer,
  require("./lib/analyzers/routes.analyzer").routesAnalyzer,
  require("./lib/analyzers/agent.analyzer").agentAnalyzer,
  require("./lib/analyzers/modules.analyzer").modulesAnalyzer,
  require("./lib/analyzers/config.analyzer").configAnalyzer,
  require("./lib/analyzers/mcp.analyzer").mcpAnalyzer,
  require("./lib/analyzers/automations.analyzer").automationsAnalyzer,
];

// Map file extensions/paths to analyzer names
const analyzerMap: Record<string, string[]> = {
  "schema.prisma": ["prisma"],
  ".ts": ["agent", "modules", "mcp", "automations"],
  ".tsx": ["pages"],
  "route.ts": ["routes"],
  ".json": ["config"],
};

function getAffectedAnalyzers(filePath: string): string[] {
  const fileName = path.basename(filePath);
  if (fileName === "schema.prisma") return ["prisma"];
  if (fileName === "route.ts") return ["routes"];
  if (fileName.endsWith(".tsx") && !filePath.includes("api/")) return ["pages"];
  if (fileName.endsWith(".ts")) {
    const affected = ["agent", "modules", "mcp", "automations"];
    // Only re-run relevant analyzers
    if (filePath.startsWith("src/lib/agent")) return ["agent"];
    if (filePath.startsWith("src/lib/tools")) return ["agent"];
    if (filePath.includes("workflow") || filePath.includes("automation") || filePath.includes("scheduler")) return ["automations"];
    if (filePath.startsWith("mcp-bridge")) return ["mcp"];
    if (filePath.startsWith("src/lib")) return ["modules"];
    return affected;
  }
  if (fileName.endsWith(".json")) return ["config"];
  return [];
}

let cachedResults = new Map<string, AnalyzerResult>();
let fullScanDone = false;

async function regenerate(affectedAnalyzers: string[], changedFile?: string) {
  const rootDir = process.cwd();
  const outputDir = rootDir;

  console.log(`[docs-watch] Regenerating (${affectedAnalyzers.join(", ")})...`);

  // Full scan on first run, then incremental file list is fine
  const allFiles = fullScanDone ? scanFiles(rootDir) : scanFiles(rootDir);
  fullScanDone = true;

  // Only run affected analyzers (or all if empty)
  const toRun = affectedAnalyzers.length === 0
    ? analyzers
    : analyzers.filter((a) => affectedAnalyzers.includes(a.name));

  const newResults = await runAllAnalyzers(toRun, allFiles);

  // Merge: update only the changed analyzers' results
  for (const [key, val] of newResults) {
    cachedResults.set(key, val);
  }

  const allRelations = mergeRelations(cachedResults);

  // Regenerate index
  const index = buildIndex(cachedResults, outputDir);

  // Regenerate docs for affected items + their dependents
  generateDocs(cachedResults, allRelations, outputDir);

  // Regenerate index pages
  generateIndexPages(cachedResults, allRelations, outputDir);

  // Regenerate diagrams
  generateMermaidDiagrams(cachedResults, allRelations, outputDir);

  // Regenerate .ai/ memory layer
  generateAiOutput(cachedResults, allRelations, index, outputDir);

  console.log(`[docs-watch] Done. (${index.global.statistics.total} items)`);
}

async function main() {
  console.log("[docs-watch] Starting initial full scan...");
  await regenerate([], undefined);

  const rootDir = process.cwd();
  const watchedDirs = [
    path.join(rootDir, "src"),
    path.join(rootDir, "prisma"),
    path.join(rootDir, "mcp-bridge"),
  ];

  console.log("[docs-watch] Watching for changes...");

  for (const dir of watchedDirs) {
    if (!fs.existsSync(dir)) continue;
    fs.watch(dir, { recursive: true }, async (eventType, fileName) => {
      if (!fileName) return;

      const fullPath = path.join(dir, fileName);
      if (!fs.existsSync(fullPath)) return; // Deleted file, skip

      const affected = getAffectedAnalyzers(fileName);
      if (affected.length === 0) return;

      // Debounce: wait 300ms to avoid rapid triggers
      await new Promise((r) => setTimeout(r, 300));

      try {
        await regenerate(affected, fileName);
      } catch (err) {
        console.error(`[docs-watch] Error regenerating for ${fileName}:`, err);
      }
    });
  }

  console.log("[docs-watch] Watching. Press Ctrl+C to stop.");
  // Keep process alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("[docs-watch] Fatal error:", err);
  process.exit(1);
});

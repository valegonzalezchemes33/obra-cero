// ============================================================
// Project Intelligence System — Documentation Generator
// Scans the project, analyzes modules, generates docs + index.
// ============================================================

import * as path from "path";
import { scanFiles } from "./lib/project-scanner";
import { runAllAnalyzers } from "./lib/orchestrator";
import { buildIndex } from "./lib/index-builder";
import { generateDocs } from "./lib/generators/docs-generator";
import { generateMermaidDiagrams } from "./lib/generators/mermaid-generator";
import { generateIndexPages } from "./lib/generators/index-generator";
import { generateAiOutput } from "./lib/generators/ai-generator";
import { mergeRelations } from "./lib/orchestrator";
import type { Analyzer } from "./lib/analyzer.interface";

// ── Import all analyzers ──
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

async function main() {
  const rootDir = process.cwd();
  const outputDir = rootDir; // Generate docs/ inside project root

  console.log("[scan-docs] Scanning project files...");
  const allFiles = scanFiles(rootDir);
  console.log(`[scan-docs] Found ${allFiles.length} files.`);

  console.log("[scan-docs] Running analyzers...");
  const results = await runAllAnalyzers(analyzers, allFiles);

  const allRelations = mergeRelations(results);

  console.log("[scan-docs] Generating .index...");
  const index = buildIndex(results, outputDir);
  console.log(`[scan-docs] Statistics:`, index.global.statistics);

  console.log("[scan-docs] Generating Markdown docs...");
  generateDocs(results, allRelations, outputDir);

  console.log("[scan-docs] Generating index pages...");
  generateIndexPages(results, allRelations, outputDir);

  console.log("[scan-docs] Generating Mermaid diagrams...");
  generateMermaidDiagrams(results, allRelations, outputDir);

  console.log("[scan-docs] Generating .ai/ memory layer...");
  generateAiOutput(results, allRelations, index, outputDir);

  console.log("[scan-docs] Done.");
}

main().catch((err) => {
  console.error("[scan-docs] Fatal error:", err);
  process.exit(1);
});

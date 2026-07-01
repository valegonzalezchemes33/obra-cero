import * as fs from "fs";
import * as path from "path";
import type { AnalyzerResult, ProjectIndex } from "./analyzer.interface";
import { mergeRelations, computeStatistics } from "./orchestrator";

export function buildIndex(
  results: Map<string, AnalyzerResult>,
  outputDir: string
): ProjectIndex {
  const index: ProjectIndex = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    project: {
      name: "ObraCero",
      description: "Sistema CRM interno con Agente IA para la construcción",
    },
    analyzers: Object.fromEntries(results),
    global: {
      relations: mergeRelations(results),
      statistics: computeStatistics(results),
    },
  };

  const docsDir = path.join(outputDir, "docs-vault");
  const indexPath = path.join(docsDir, ".index");
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8");

  return index;
}

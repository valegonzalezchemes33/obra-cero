import type { Analyzer, AnalyzerResult } from "./analyzer.interface";

export async function runAllAnalyzers(
  analyzers: Analyzer[],
  allFiles: string[]
): Promise<Map<string, AnalyzerResult>> {
  const results = new Map<string, AnalyzerResult>();

  await Promise.all(
    analyzers.map(async (a) => {
      try {
        const result = await a.analyze(allFiles);
        results.set(a.name, result);
      } catch (err) {
        console.error(`[orchestrator] Analyzer "${a.name}" failed:`, err);
        results.set(a.name, { type: a.name, items: [], relations: [] });
      }
    })
  );

  return results;
}

export function mergeRelations(results: Map<string, AnalyzerResult>) {
  const all: { source: string; target: string; type: string; metadata?: any }[] = [];
  for (const result of results.values()) {
    all.push(...result.relations);
  }
  return all;
}

export function computeStatistics(results: Map<string, AnalyzerResult>): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const result of results.values()) {
    for (const item of result.items) {
      const key = item.type;
      stats[key] = (stats[key] || 0) + 1;
    }
  }
  stats["total"] = Object.values(stats).reduce((a, b) => a + b, 0);
  return stats;
}

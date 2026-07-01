// ============================================================
// Analyzer Interface — Contract for all Project Intelligence analyzers
// Each analyzer handles one domain and can be added independently.
// ============================================================

export interface AnalyzerItem {
  id: string;
  type: string;
  path: string;
  name: string;
  description?: string;
  metadata: Record<string, any>;
  dependencies: string[];
}

export interface Relation {
  source: string;
  target: string;
  type: string;
  metadata?: Record<string, any>;
}

export interface AnalyzerResult {
  type: string;
  items: AnalyzerItem[];
  relations: Relation[];
}

export interface Analyzer {
  readonly name: string;
  readonly description: string;
  analyze(allFiles: string[]): Promise<AnalyzerResult>;
}

export interface DocsGenerator {
  readonly name: string;
  generate(result: AnalyzerResult, allResults: AnalyzerResult[], outputDir: string): Promise<void>;
}

// ---- Index types ----

export interface ProjectIndex {
  version: string;
  generatedAt: string;
  project: {
    name: string;
    description: string;
  };
  analyzers: Record<string, AnalyzerResult>;
  global: {
    relations: Relation[];
    statistics: Record<string, number>;
  };
}

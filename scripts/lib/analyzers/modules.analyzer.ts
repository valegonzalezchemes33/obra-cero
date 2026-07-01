import * as fs from "fs";
import * as path from "path";
import type { Analyzer, AnalyzerResult, AnalyzerItem, Relation } from "../analyzer.interface";

export const modulesAnalyzer: Analyzer = {
  name: "modules",
  description: "Analyzes source modules: libraries, utilities, services",

  async analyze(allFiles: string[]): Promise<AnalyzerResult> {
    const items: AnalyzerItem[] = [];
    const relations: Relation[] = [];

    const excludeDirs = ["src/app", "src/components", "src/lib/agent", "src/lib/tools"];
    const moduleFiles = allFiles.filter(
      (f) =>
        f.startsWith("src/lib/") &&
        f.endsWith(".ts") &&
        !f.endsWith(".test.ts") &&
        !excludeDirs.some((d) => f.startsWith(d))
    );

    for (const file of moduleFiles) {
      const content = fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");
      const moduleName = file.replace("src/lib/", "").replace(".ts", "");
      const id = `module:${moduleName}`;

      const exports: string[] = [];
      const exportRegex = /export\s+(?:async\s+)?function\s+(\w+)|export\s+(?:const|let|var)\s+(\w+)|export\s+default\s+(?:async\s+)?function\s+(\w+)/g;
      let m: RegExpExecArray | null;
      while ((m = exportRegex.exec(content)) !== null) {
        exports.push(m[1] || m[2] || m[3]);
      }

      const imports: string[] = [];
      const importRegex = /from\s+["']([^"']+)["']/g;
      while ((m = importRegex.exec(content)) !== null) {
        imports.push(m[1]);
      }

      items.push({
        id,
        type: "module",
        path: file,
        name: moduleName,
        description: `Library module: ${moduleName}`,
        metadata: {
          exports,
          importCount: imports.length,
          lineCount: content.split("\n").length,
        },
        dependencies: imports
          .filter((imp) => imp.startsWith("@/") || imp.startsWith("../") || imp.startsWith("./"))
          .filter((imp) => !imp.endsWith(".css")),
      });
    }

    return { type: "modules", items, relations };
  },
};

import * as fs from "fs";
import * as path from "path";
import type { Analyzer, AnalyzerResult, AnalyzerItem, Relation } from "../analyzer.interface";

export const automationsAnalyzer: Analyzer = {
  name: "automations",
  description: "Analyzes workflow engine, automation rules, and scheduler",

  async analyze(allFiles: string[]): Promise<AnalyzerResult> {
    const items: AnalyzerItem[] = [];
    const relations: Relation[] = [];

    const automationFiles = allFiles.filter(
      (f) =>
        f.includes("workflow") ||
        f.includes("automation") ||
        f.includes("scheduler")
    );

    for (const file of automationFiles) {
      const content = fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");
      const moduleName = file.replace("src/lib/", "").replace(".ts", "");
      const id = `automation:${moduleName}`;

      const exports: string[] = [];
      const exportRegex = /export\s+(?:async\s+)?function\s+(\w+)|export\s+(?:const|let|var)\s+(\w+)/g;
      let m: RegExpExecArray | null;
      while ((m = exportRegex.exec(content)) !== null) {
        exports.push(m[1] || m[2]);
      }

      const imports: string[] = [];
      const importRegex = /from\s+["']([^"']+)["']/g;
      while ((m = importRegex.exec(content)) !== null) {
        imports.push(m[1]);
      }

      items.push({
        id,
        type: "automation",
        path: file,
        name: moduleName,
        description: `Automation module: ${moduleName}`,
        metadata: {
          exports,
          lineCount: content.split("\n").length,
        },
        dependencies: imports
          .filter((imp) => imp.startsWith("@/") || imp.startsWith("../") || imp.startsWith("./"))
          .filter((imp) => !imp.endsWith(".css")),
      });
    }

    return { type: "automations", items, relations };
  },
};

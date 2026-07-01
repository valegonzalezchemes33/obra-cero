import * as fs from "fs";
import * as path from "path";
import type { Analyzer, AnalyzerResult, AnalyzerItem, Relation } from "../analyzer.interface";

export const configAnalyzer: Analyzer = {
  name: "config",
  description: "Analyzes configuration files: package.json, tsconfig, next.config, etc.",

  async analyze(allFiles: string[]): Promise<AnalyzerResult> {
    const items: AnalyzerItem[] = [];
    const relations: Relation[] = [];

    const configFiles = [
      "package.json",
      "tsconfig.json",
      "next.config.ts",
      "vercel.json",
      "Dockerfile",
      "Caddyfile",
      ".env.example",
      ".gitignore",
      "components.json",
    ];

    for (const file of configFiles) {
      if (!allFiles.includes(file)) continue;
      
      const content = fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");
      let description = "";
      let metadata: Record<string, any> = {};

      if (file === "package.json") {
        try {
          const pkg = JSON.parse(content);
          description = pkg.description || "Project package.json";
          metadata = {
            name: pkg.name,
            version: pkg.version,
            scripts: Object.keys(pkg.scripts || {}),
            dependencies: Object.keys(pkg.dependencies || {}),
            devDependencies: Object.keys(pkg.devDependencies || {}),
          };
          items.push({
            id: `config:${file}`,
            type: "config",
            path: file,
            name: "package.json",
            description,
            metadata,
            dependencies: [],
          });
          continue;
        } catch { /* ignore parse errors */ }
      }

      items.push({
        id: `config:${file}`,
        type: "config",
        path: file,
        name: file,
        description: `Configuration file: ${file}`,
        metadata: { lineCount: content.split("\n").length },
        dependencies: [],
      });
    }

    return { type: "config", items, relations };
  },
};

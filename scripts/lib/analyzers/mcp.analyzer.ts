import * as fs from "fs";
import * as path from "path";
import type { Analyzer, AnalyzerResult, AnalyzerItem, Relation } from "../analyzer.interface";

export const mcpAnalyzer: Analyzer = {
  name: "mcp",
  description: "Analyzes MCP bridge and integration files",

  async analyze(allFiles: string[]): Promise<AnalyzerResult> {
    const items: AnalyzerItem[] = [];
    const relations: Relation[] = [];

    const mcpFiles = allFiles.filter(
      (f) =>
        f.startsWith("mcp-bridge/") ||
        f.includes("mcp") ||
        f.includes("MCP")
    );

    for (const file of mcpFiles) {
      const content = fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");
      const id = `mcp:${file.replace("mcp-bridge/", "")}`;
      const lineCount = content.split("\n").length;

      const imports: string[] = [];
      const importRegex = /from\s+["']([^"']+)["']/g;
      let m: RegExpExecArray | null;
      while ((m = importRegex.exec(content)) !== null) {
        imports.push(m[1]);
      }

      items.push({
        id,
        type: "mcp",
        path: file,
        name: file,
        description: `MCP integration: ${file}`,
        metadata: { lineCount, imports },
        dependencies: imports.filter((imp) => !imp.startsWith("express") && !imp.startsWith("cors")),
      });
    }

    return { type: "mcp", items, relations };
  },
};

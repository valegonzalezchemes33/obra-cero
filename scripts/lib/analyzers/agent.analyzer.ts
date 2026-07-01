import * as fs from "fs";
import * as path from "path";
import type { Analyzer, AnalyzerResult, AnalyzerItem, Relation } from "../analyzer.interface";

export const agentAnalyzer: Analyzer = {
  name: "agent",
  description: "Analyzes AI agent modules: intents, handlers, tools, capabilities",

  async analyze(allFiles: string[]): Promise<AnalyzerResult> {
    const items: AnalyzerItem[] = [];
    const relations: Relation[] = [];

    const agentFiles = allFiles.filter(
      (f) =>
        f.startsWith("src/lib/agent/") ||
        f === "src/lib/agent.ts" ||
        f === "src/lib/agent-extended.ts" ||
        f === "src/lib/agent-intents.ts" ||
        f === "src/lib/agent-memory.ts" ||
        f === "src/lib/agent-dispatcher.ts"
    );

    // Also include tool files
    const toolFiles = allFiles.filter(
      (f) => f.startsWith("src/lib/tools/") || f === "src/lib/tool-registry.ts" || f === "src/lib/tool-execution.ts"
    );

    const allRelevant = [...agentFiles, ...toolFiles];

    for (const file of allRelevant) {
      const content = fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");
      const moduleName = file.replace("src/lib/", "").replace(".ts", "");
      const id = `agent:${moduleName}`;

      // Detect exports
      const exports: string[] = [];
      const exportRegex = /export\s+(?:async\s+)?function\s+(\w+)|export\s+(?:const|let|var)\s+(\w+)/g;
      let m: RegExpExecArray | null;
      while ((m = exportRegex.exec(content)) !== null) {
        exports.push(m[1] || m[2]);
      }

      // Detect imports
      const imports: string[] = [];
      const importRegex = /from\s+["']([^"']+)["']/g;
      while ((m = importRegex.exec(content)) !== null) {
        imports.push(m[1]);
      }

      // Detect intent patterns
      const intentCount = file.includes("intents") ? (content.match(/intent:\s*"/g) || []).length : 0;

      items.push({
        id,
        type: "agent-module",
        path: file,
        name: moduleName,
        description: `Agent module: ${moduleName}`,
        metadata: {
          exports,
          importCount: imports.length,
          lineCount: content.split("\n").length,
          intentCount,
          isTool: file.startsWith("src/lib/tools/"),
          isHandler: file.includes("handlers"),
          isDispatcher: file.includes("dispatcher"),
          isAutomation: file.includes("automation"),
        },
        dependencies: imports
          .filter((imp) => imp.startsWith("@/") || imp.startsWith("../") || imp.startsWith("./"))
          .filter((imp) => !imp.endsWith(".css")),
      });
    }

    // Create relations between agent modules
    for (const item of items) {
      for (const dep of item.dependencies) {
        const targetId = `agent:${dep.replace("@/lib/", "").replace(".ts", "")}`;
        if (items.some((i) => i.id === targetId)) {
          relations.push({ source: item.id, target: targetId, type: "imports" });
        }
      }
    }

    return { type: "agent", items, relations };
  },
};

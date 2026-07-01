import * as fs from "fs";
import * as path from "path";
import type { Analyzer, AnalyzerResult, AnalyzerItem, Relation } from "../analyzer.interface";

export const routesAnalyzer: Analyzer = {
  name: "routes",
  description: "Analyzes API route files for HTTP methods, schemas, and auth",

  async analyze(allFiles: string[]): Promise<AnalyzerResult> {
    const items: AnalyzerItem[] = [];
    const relations: Relation[] = [];
    const routeFiles = allFiles.filter((f) => f.startsWith("src/app/api/") && f.endsWith("/route.ts"));

    for (const file of routeFiles) {
      const content = fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");
      const methods: string[] = [];
      const imports: string[] = [];

      // Detect exported HTTP methods
      const exportRegex = /export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\b/g;
      let m: RegExpExecArray | null;
      while ((m = exportRegex.exec(content)) !== null) {
        methods.push(m[1]);
      }
      // Also detect const exports
      const constExportRegex = /export\s+(?:const|let|var)\s+(GET|POST|PATCH|PUT|DELETE)\b/g;
      while ((m = constExportRegex.exec(content)) !== null) {
        if (!methods.includes(m[1])) methods.push(m[1]);
      }

      // Detect imports
      const importRegex = /from\s+["']([^"']+)["']/g;
      while ((m = importRegex.exec(content)) !== null) {
        imports.push(m[1]);
      }

      // Detect auth
      const hasAuth = content.includes("requireSession") || content.includes("requireSession(");

      // Extract schema names
      const schemaMatch = content.match(/(\w+Schema)/g);
      const schemas = [...new Set(schemaMatch || [])];

      // Extract route path from file path
      const routePath = file
        .replace("src/app/api/", "/api/")
        .replace("/route.ts", "")
        .replace(/\[(\w+)\]/g, ":$1");

      const id = `route:${routePath}`;

      items.push({
        id,
        type: "route",
        path: file,
        name: routePath,
        description: `API ${methods.join("/")} ${routePath}`,
        metadata: {
          methods,
          schemas,
          hasAuth,
          imports,
        },
        dependencies: imports
          .filter((imp) => imp.startsWith("@/") || imp.startsWith("../") || imp.startsWith("./"))
          .filter((imp) => !imp.endsWith(".css") && !imp.startsWith("@/lib/validation")),
      });

      // Link to model if route path matches
      const modelName = routePath.split("/")[2]?.replace(/:id$/, "");
      if (modelName) {
        const singular = modelName.replace(/s$/, "");
        relations.push({
          source: id,
          target: `model:${singular.charAt(0).toUpperCase() + singular.slice(1)}`,
          type: "operates_on",
        });
      }
    }

    return { type: "routes", items, relations };
  },
};

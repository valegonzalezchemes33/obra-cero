import * as fs from "fs";
import * as path from "path";
import type { Analyzer, AnalyzerResult, AnalyzerItem, Relation } from "../analyzer.interface";

export const pagesAnalyzer: Analyzer = {
  name: "pages",
  description: "Analyzes Next.js page files and layouts",

  async analyze(allFiles: string[]): Promise<AnalyzerResult> {
    const items: AnalyzerItem[] = [];
    const relations: Relation[] = [];

    const pageFiles = allFiles.filter(
      (f) =>
        (f.endsWith("/page.tsx") || f.endsWith("/layout.tsx") || f.endsWith("/loading.tsx")) &&
        f.startsWith("src/app/") &&
        !f.startsWith("src/app/api/")
    );

    for (const file of pageFiles) {
      const content = fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");
      const fileName = path.basename(file);
      const type = fileName === "layout.tsx" ? "layout" : fileName === "loading.tsx" ? "loading" : "page";

      // Extract route path
      const routePath = file
        .replace("src/app", "")
        .replace(/\/[^/]+\.tsx$/, "")
        .replace(/\[(\w+)\]/g, ":$1") || "/";

      const id = `${type}:${routePath}`;

      // Detect imports
      const imports: string[] = [];
      const importRegex = /from\s+["']([^"']+)["']/g;
      let m: RegExpExecArray | null;
      while ((m = importRegex.exec(content)) !== null) {
        imports.push(m[1]);
      }

      // Detect component name
      const exportMatch = content.match(/export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/);
      const componentName = exportMatch?.[1] || routePath.split("/").filter(Boolean).pop() || "Home";

      items.push({
        id,
        type,
        path: file,
        name: routePath === "/" ? "Home" : routePath.split("/").filter(Boolean).pop() || "Home",
        description: `${type === "layout" ? "Layout" : type === "loading" ? "Loading" : "Page"} for ${routePath}`,
        metadata: {
          routePath,
          componentName,
          fileName,
          imports,
        },
        dependencies: imports
          .filter((imp) => imp.startsWith("@/") || imp.startsWith("../") || imp.startsWith("./"))
          .filter((imp) => !imp.endsWith(".css")),
      });

      // Relation with parent layout
      if (type === "page") {
        const parts = routePath.split("/").filter(Boolean);
        for (let i = parts.length; i >= 0; i--) {
          const parentPath = "/" + parts.slice(0, i).join("/");
          const layoutId = `layout:${parentPath}`;
          if (items.some((it) => it.id === layoutId)) {
            relations.push({ source: id, target: layoutId, type: "rendered_by" });
            break;
          }
        }
      }
    }

    return { type: "pages", items, relations };
  },
};

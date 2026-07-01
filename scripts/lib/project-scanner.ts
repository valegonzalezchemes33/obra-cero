import * as fs from "fs";
import * as path from "path";

const DEFAULT_IGNORE = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".obsidian",
  ".claude",
  ".github",
  "mcp-bridge/node_modules",
  "scripts/lib",
  "docs-vault",
  ".ai",
];

export function scanFiles(
  rootDir: string,
  ignorePatterns: string[] = DEFAULT_IGNORE
): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true }) as fs.Dirent[];
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relative = path.relative(rootDir, fullPath).replace(/\\/g, "/");

      if (ignorePatterns.some((p) => relative.startsWith(p) || relative.includes(`/${p}/`))) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        results.push(relative);
      }
    }
  }

  walk(rootDir);
  return results.sort();
}

import * as fs from "fs";
import * as path from "path";
import { initBrain, query, getToolNames } from "./core";

export async function generateHealthReport(): Promise<void> {
  await initBrain();

  const response = await query({ intent: "health" });
  const health = response.data;

  // Write to .ai/health/
  const healthDir = path.join(process.cwd(), ".ai", "health");
  fs.mkdirSync(healthDir, { recursive: true });

  // Always write latest
  fs.writeFileSync(
    path.join(healthDir, "latest.json"),
    JSON.stringify(health, null, 2),
    "utf-8"
  );

  // Also write timestamped version
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  fs.writeFileSync(
    path.join(healthDir, ts + ".json"),
    JSON.stringify(health, null, 2),
    "utf-8"
  );

  // Write markdown summary
  const md = `# Project Health Report

**Generated:** ${health.generatedAt}
**Change ID:** ${health.changeId}
**Status:** ${health.overall.toUpperCase()}

## Metrics
| Metric | Value |
|--------|-------|
| Build | ${health.buildStatus} |
| Tests | ${health.testStatus} |
| Modules | ${health.moduleCount} |
| Routes | ${health.routeCount} |
| DB Models | ${health.modelCount} |
| Agents | ${health.agentCount} |
| Dead Code (potential) | ${health.deadCodeCount} |
| Circular Dependencies | ${health.circularDepCount} |
| Feedback Entries | ${health.feedbackCount} |
| Feedback Success Rate | ${health.feedbackSuccessRate}% |

## Warnings
${health.warnings.length > 0 ? health.warnings.map((w: string) => "- " + w).join("\n") : "None"}

## Overall
**${health.overall === "healthy" ? "✅ Healthy" : health.overall === "warning" ? "⚠️ Warning" : "❌ Critical"}**
`;

  fs.writeFileSync(path.join(healthDir, "latest.md"), md, "utf-8");
  console.log(`[brain-health] Report written to .ai/health/latest.json`);
}

// CLI
if (require.main === module) {
  generateHealthReport().catch(console.error);
}

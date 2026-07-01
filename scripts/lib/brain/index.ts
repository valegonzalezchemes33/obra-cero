import { initBrain, query, getToolNames, registerTool } from "./core";
import type { BrainQuery, BrainResponse } from "./types";

// ── Backward-compatible exports ──

export { ProjectBrain } from "../brain";

// ── New unified API ──

/**
 * Unified entry point for all Project Brain queries.
 * Every agent calls this single function regardless of intent.
 */
export async function ask(q: BrainQuery): Promise<BrainResponse> {
  await initBrain();
  return query(q);
}

/**
 * CLI entry point: maps command → intent
 */
async function main() {
  await initBrain();

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("Project Brain v2 — Unified Intelligence Platform");
    console.log("");
    console.log("Usage:");
    console.log("  npx tsx scripts/brain/ <intent> [target] [options]");
    console.log("");
    console.log("Intents:");
    console.log("  context                  → Project context");
    console.log("  search <query>           → Semantic search");
    console.log("  architecture             → Architecture explanation");
    console.log("  analyze <target>         → Impact analysis");
    console.log("  plan <feature>           → Feature estimation (add --design for blueprint)");
    console.log("  module <path>            → Module summary");
    console.log("  health                   → Project health metrics");
    console.log("  feedback <task>          → Register feedback (use --result, --success)");
    console.log("  mcp                      → Start MCP server");
    console.log("");
    console.log("Also available: npm run brain <intent> ...");
    return;
  }

  const command = args[0];

  if (command === "mcp") {
    const { startMcpServer } = await import("./mcp-server");
    startMcpServer(parseInt(process.env.BRAIN_PORT || "3721", 10));
    return;
  }

  // Map CLI commands to intents
  const intentMap: Record<string, string> = {
    context: "context",
    search: "search",
    architecture: "architecture",
    analyze: "analyze",
    plan: args.includes("design") ? "design" : args.includes("before-change") || args.includes("beforechange") ? "before-change" : "plan",
    "before-change": "before-change",
    "beforechange": "before-change",
    module: "module",
    health: "health",
    feedback: "feedback",
    "dead-code": "dead-code",
    "circular-deps": "circular-deps",
    "unused-routes": "unused-routes",
  };

  const intent = intentMap[command];
  if (!intent) {
    console.error("Unknown command:", command);
    console.error("Run without arguments for usage.");
    process.exit(1);
  }

  // Build target, excluding mode flags
  const skipWords = new Set(["design", "estimate", "before-change", "beforechange"]);
  const target = args.slice(1).filter((a) => !skipWords.has(a)).join(" ");
  const options: Record<string, any> = {};

  // Parse --flags (handle npm stripping by also checking args after position)
  let designMode = false;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--design" || args[i] === "design" || args[i] === "--mode=design") designMode = true;
    if (args[i] === "--success") options.success = true;
    if (args[i] === "--result" && args[i + 1]) options.result = args[++i];
    if (args[i] === "--duration" && args[i + 1]) options.duration = parseInt(args[++i], 10);
  }
  if (designMode) options.mode = "design";

  if (intent === "feedback" && !options.result) {
    options.result = "completed";
    options.success = true;
  }

  const response = await query({
    intent: intent as any,
    target,
    options,
  });

  if (!response.success) {
    console.error("Brain query failed:", response.warnings.join(", "));
    process.exit(1);
  }

  // Pretty-print based on intent
  if (typeof response.data === "string") {
    console.log(response.data);
  } else if (intent === "context" || intent === "health") {
    console.log(JSON.stringify(response.data, null, 2));
  } else if (intent === "analyze") {
    console.log(response.data.summary || JSON.stringify(response.data, null, 2));
    console.log("Risk:", response.data.risk?.toUpperCase());
  } else if (intent === "plan" || intent === "design") {
    console.log("Feature:", response.data.feature);
    console.log("Risk:", response.data.risk?.toUpperCase());
    console.log("Agent:", response.data.recommendedAgent);
    console.log("Modules:", response.data.affectedModules, "| Routes:", response.data.affectedRoutes,
      "| DB:", response.data.affectedDBModels, "| Agents:", response.data.affectedAgents);
    if (response.data.suggestedArchitecture) {
      console.log("\n" + response.data.suggestedArchitecture.join("\n"));
    }
  } else if (intent === "search") {
    if (response.data.results?.length === 0) {
      console.log("No results for:", target);
    } else {
      for (const r of response.data.results || []) {
        console.log(`[${r.type}] ${r.item} (score: ${r.score})`);
        console.log("  " + r.context);
      }
      console.log(`--- ${response.data.total} results ---`);
    }
  } else if (intent === "module") {
    console.log(response.data.details || "No data");
  } else {
    console.log(JSON.stringify(response.data, null, 2));
  }

  if (response.warnings.length > 0) {
    console.log("\nWarnings:", response.warnings.join("; "));
  }
}

if (require.main === module) {
  main().catch(console.error);
}

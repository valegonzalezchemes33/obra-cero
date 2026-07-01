import * as fs from "fs";
import * as path from "path";
import type { BrainMemory, FeedbackEntry } from "./types";

const AI_DIR = "docs-vault/.ai";

export async function loadMemory(): Promise<BrainMemory> {
  const aiDir = path.join(process.cwd(), AI_DIR);

  const knowledge: Record<string, any> = {};
  const knowledgeDir = path.join(aiDir, "knowledge");
  if (fs.existsSync(knowledgeDir)) {
    for (const f of fs.readdirSync(knowledgeDir)) {
      if (f.endsWith(".json")) {
        try {
          knowledge[f.replace(".json", "")] = JSON.parse(
            fs.readFileSync(path.join(knowledgeDir, f), "utf-8")
          );
        } catch { /* skip */ }
      }
    }
  }

  // Load state
  let state: Record<string, any> = {};
  const statePath = path.join(aiDir, "PROJECT_STATE.json");
  if (fs.existsSync(statePath)) {
    try {
      state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    } catch { /* skip */ }
  }

  // Load architecture markdown
  const architecture: Record<string, string> = {};
  const archDir = path.join(aiDir, "architecture");
  if (fs.existsSync(archDir)) {
    for (const f of fs.readdirSync(archDir)) {
      if (f.endsWith(".md")) {
        architecture[f.replace(".md", "")] = fs.readFileSync(
          path.join(archDir, f), "utf-8"
        );
      }
    }
  }

  // Load memory markdown
  const memory: Record<string, string> = {};
  const memDir = path.join(aiDir, "memory");
  if (fs.existsSync(memDir)) {
    for (const f of fs.readdirSync(memDir)) {
      if (f.endsWith(".md")) {
        memory[f.replace(".md", "")] = fs.readFileSync(
          path.join(memDir, f), "utf-8"
        );
      }
    }
  }

  // Load health
  let health: Record<string, any> = {};
  const healthPath = path.join(aiDir, "health", "latest.json");
  if (fs.existsSync(healthPath)) {
    try {
      health = JSON.parse(fs.readFileSync(healthPath, "utf-8"));
    } catch { /* skip */ }
  }

  // Load feedback entries
  const feedback: FeedbackEntry[] = [];
  const feedbackDir = path.join(aiDir, "feedback");
  if (fs.existsSync(feedbackDir)) {
    const files = fs.readdirSync(feedbackDir).filter((f) => f.endsWith(".json")).sort();
    for (const f of files.slice(-50)) { // Last 50 entries
      try {
        feedback.push(JSON.parse(fs.readFileSync(path.join(feedbackDir, f), "utf-8")));
      } catch { /* skip */ }
    }
  }

  return { state, knowledge, architecture, memory, health, feedback };
}

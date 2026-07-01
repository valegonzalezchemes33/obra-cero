import * as fs from "fs";
import * as path from "path";
import { analyzeImpact, type ImpactReport } from "./impact";

// ── Types ──

export interface ProjectContext {
  name: string;
  version: string;
  stack: string[];
  stats: Record<string, number>;
  agents: string[];
  health: string;
  changeId: number;
  lastUpdated: string;
  pendingRefactors: string[];
}

export interface SearchResult {
  type: string;
  item: string;
  context: string;
  relevance: number;
}

export interface FeatureEstimate {
  feature: string;
  relatedConcepts: string[];
  affectedModules: number;
  affectedRoutes: number;
  affectedDBModels: number;
  affectedAgents: number;
  risk: "low" | "medium" | "high";
  reusablePatterns: number;
  recommendedAgent: string;
  estimatedFiles: number;
}

export interface FeatureDesign extends FeatureEstimate {
  suggestedArchitecture: string[];
  patterns: { name: string; location: string }[];
  databaseImpact: string[];
  routeImpact: string[];
  decisionHistory: string[];
}

export interface DeadCodeItem {
  module: string;
  exportName: string;
  type: string;
  reason: string;
}

export interface UnusedRoute {
  path: string;
  method: string;
  reason: string;
}

export interface CircularDependency {
  chain: string[];
}

// ── Project Brain ──

export class ProjectBrain {
  private data: Record<string, any> = {};
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    const aiDir = path.join(process.cwd(), "docs-vault", ".ai");

    // Load knowledge JSON files
    const knowledgeFiles = [
      "knowledge/project.json",
      "knowledge/modules.json",
      "knowledge/routes.json",
      "knowledge/database.json",
      "knowledge/agents.json",
      "knowledge/automation.json",
      "knowledge/dependencies.json",
      "knowledge/semantic-index.json",
    ];

    for (const kf of knowledgeFiles) {
      const fp = path.join(aiDir, kf);
      if (fs.existsSync(fp)) {
        try {
          this.data[kf] = JSON.parse(fs.readFileSync(fp, "utf-8"));
        } catch {
          this.data[kf] = null;
        }
      }
    }

    // Load state
    const statePath = path.join(aiDir, "PROJECT_STATE.json");
    if (fs.existsSync(statePath)) {
      try {
        this.data["state"] = JSON.parse(fs.readFileSync(statePath, "utf-8"));
      } catch { /* ignore */ }
    }

    // Load architecture markdown (keep as raw text)
    const archDir = path.join(aiDir, "architecture");
    if (fs.existsSync(archDir)) {
      this.data["architecture"] = {};
      for (const f of fs.readdirSync(archDir)) {
        if (f.endsWith(".md")) {
          this.data["architecture"][f.replace(".md", "")] = fs.readFileSync(
            path.join(archDir, f),
            "utf-8"
          );
        }
      }
    }

    // Load memory markdown
    const memDir = path.join(aiDir, "memory");
    if (fs.existsSync(memDir)) {
      this.data["memory"] = {};
      for (const f of fs.readdirSync(memDir)) {
        if (f.endsWith(".md")) {
          this.data["memory"][f.replace(".md", "")] = fs.readFileSync(
            path.join(memDir, f),
            "utf-8"
          );
        }
      }
    }

    this.loaded = true;
  }

  private ensureLoaded(): void {
    if (!this.loaded) throw new Error("ProjectBrain not loaded. Call .load() first.");
  }

  // ── Public API ──

  async getContext(): Promise<ProjectContext> {
    this.ensureLoaded();
    const state = this.data["state"] || {};
    const project = this.data["knowledge/project.json"] || {};
    const modules = this.data["knowledge/modules.json"] || {};

    return {
      name: project.name || "ObraCero",
      version: project.version || state.version || "0.0.0",
      stack: [
        "Next.js",
        "Prisma",
        "Groq LLM",
        "Tailwind CSS",
        "shadcn/ui",
      ],
      stats: state.stats || {},
      agents: state.agents || [],
      health: state.health || "unknown",
      changeId: state.changeId || 0,
      lastUpdated: state.lastUpdated || "unknown",
      pendingRefactors: state.pendingRefactors || [],
    };
  }

  async explainArchitecture(): Promise<string> {
    this.ensureLoaded();
    const arch = this.data["architecture"] || {};
    const parts: string[] = [];

    if (arch["overview"]) parts.push(arch["overview"].split("\n").slice(0, 20).join("\n") + "\n[...]");
    if (arch["backend"]) {
      const lines = arch["backend"].split("\n");
      const routeLines = lines.filter((l: string) => l.startsWith("| `") || l.startsWith("|   "));
      parts.push("### Backend\n" + routeLines.slice(0, 25).join("\n") + (routeLines.length > 25 ? "\n[...]" : ""));
    }
    if (arch["database"]) {
      const lines = arch["database"].split("\n");
      const modelLines = lines.filter((l: string) => l.startsWith("| `"));
      parts.push("### Database\n" + modelLines.slice(0, 20).join("\n") + (modelLines.length > 20 ? "\n[...]" : ""));
    }
    if (arch["agents"]) {
      const lines = arch["agents"].split("\n");
      const agentLines = lines.filter((l: string) => l.startsWith("- **"));
      parts.push("### Agents (" + agentLines.length + " modules)");
    }

    return parts.join("\n\n") || "No architecture data available.";
  }

  async searchKnowledge(query: string): Promise<SearchResult[]> {
    this.ensureLoaded();
    const results: SearchResult[] = [];
    const q = query.toLowerCase();

    // Search semantic index concepts
    const si = this.data["knowledge/semantic-index.json"];
    if (si?.concepts) {
      for (const c of si.concepts) {
        if (
          c.concept.toLowerCase().includes(q) ||
          c.aliases?.some((a: string) => a.toLowerCase().includes(q)) ||
          c.description?.toLowerCase().includes(q)
        ) {
          results.push({
            type: "concept",
            item: c.concept,
            context: c.description + " | routes: " + (c.routes?.length || 0) + ", modules: " + (c.relatedModules?.length || 0),
            relevance: 10,
          });
        }
        // Match through related modules
        for (const mod of c.relatedModules || []) {
          if (mod.toLowerCase().includes(q)) {
            results.push({
              type: "module",
              item: mod,
              context: "Related to concept: " + c.concept,
              relevance: 5,
            });
          }
        }
      }
    }

    // Search business terms
    if (si?.businessTerms) {
      for (const bt of si.businessTerms) {
        if (
          bt.term.toLowerCase().includes(q) ||
          bt.aliases?.some((a: string) => a.toLowerCase().includes(q)) ||
          bt.description?.toLowerCase().includes(q)
        ) {
          results.push({
            type: "business-term",
            item: bt.term,
            context: bt.description + " | related: " + (bt.relatedConcepts?.join(", ") || "none"),
            relevance: 9,
          });
        }
      }
    }

    // Search routes
    const routes = this.data["knowledge/routes.json"];
    if (routes?.routes) {
      for (const r of routes.routes) {
        if (
          r.path?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.id?.toLowerCase().includes(q)
        ) {
          results.push({
            type: "route",
            item: r.id || r.path,
            context: r.description + " (method: " + r.method + ")",
            relevance: 7,
          });
        }
      }
    }

    // Search database models
    const db = this.data["knowledge/database.json"];
    if (db?.models) {
      for (const m of db.models) {
        if (m.name?.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q)) {
          results.push({
            type: "database-model",
            item: m.name,
            context: m.description + " (" + (m.fields?.length || 0) + " fields)",
            relevance: 8,
          });
        }
        // Search fields
        for (const f of m.fields || []) {
          if (f.name?.toLowerCase().includes(q)) {
            results.push({
              type: "field",
              item: m.name + "." + f.name,
              context: f.type + (f.required ? " (required)" : " (optional)"),
              relevance: 3,
            });
          }
        }
      }
    }

    // Search agents
    const agents = this.data["knowledge/agents.json"];
    if (agents?.modules) {
      for (const mod of agents.modules) {
        for (const item of mod.items || []) {
          if (
            item.name?.toLowerCase().includes(q) ||
            item.description?.toLowerCase().includes(q)
          ) {
            results.push({
              type: "agent",
              item: item.name,
              context: item.description + " (capabilities: " + (item.capabilities?.join(", ") || "none") + ")",
              relevance: 6,
            });
          }
        }
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);
    return results.slice(0, 30);
  }

  async findModulesUsing(concept: string): Promise<string[]> {
    this.ensureLoaded();
    const q = concept.toLowerCase();
    const modules = new Set<string>();

    // From semantic index
    const si = this.data["knowledge/semantic-index.json"];
    if (si?.concepts) {
      for (const c of si.concepts) {
        if (
          c.concept.toLowerCase() === q ||
          c.concept.toLowerCase().includes(q) ||
          q.includes(c.concept.toLowerCase()) ||
          c.aliases?.some((a: string) => a.toLowerCase() === q || a.toLowerCase().includes(q))
        ) {
          for (const mod of c.relatedModules || []) modules.add(mod);
          for (const agent of c.agents || []) modules.add("agent: " + agent);
        }
      }
    }

    // Search all knowledge items for string match
    const allText = JSON.stringify(this.data).toLowerCase();
    if (allText.includes(q)) {
      // Find specific mentions in modules
      const mods = this.data["knowledge/modules.json"];
      if (mods?.modules) {
        for (const m of mods.modules) {
          if (
            m.name?.toLowerCase().includes(q) ||
            m.path?.toLowerCase().includes(q) ||
            m.description?.toLowerCase().includes(q)
          ) {
            modules.add(m.path);
          }
        }
      }

      // Find in routes
      const routes = this.data["knowledge/routes.json"];
      if (routes?.routes) {
        for (const r of routes.routes) {
          if (
            r.path?.toLowerCase().includes(q) ||
            r.description?.toLowerCase().includes(q)
          ) {
            modules.add(r.path);
          }
        }
      }
    }

    return [...modules].sort();
  }

  async whatBreaksIf(target: string): Promise<{
    summary: string;
    endpoints: string[];
    agents: string[];
    components: string[];
    databaseModels: string[];
    tests: string[];
    automations: string[];
    integrations: string[];
    risk: "low" | "medium" | "high";
  }> {
    this.ensureLoaded();

    // If it's a file path, use the impact analysis engine
    if (target.includes("/") || target.includes("\\") || target.includes(".ts")) {
      const report = analyzeImpact(target);
      const totalImpact =
        report.endpoints.length +
        report.agents.length +
        report.components.length +
        report.databaseModels.length +
        report.tests.length +
        report.automations.length +
        report.integrations.length;
      return {
        summary: report.summary,
        endpoints: report.endpoints,
        agents: report.agents,
        components: report.components,
        databaseModels: report.databaseModels,
        tests: report.tests,
        automations: report.automations,
        integrations: report.integrations,
        risk: totalImpact > 15 ? "high" : totalImpact > 5 ? "medium" : "low",
      };
    }

    // If it's a concept, search semantic index
    const q = target.toLowerCase();
    const modules = await this.findModulesUsing(target);
    const allModulesText = modules.join(" ").toLowerCase();

    const endpoints: string[] = [];
    const agents: string[] = [];
    const components: string[] = [];
    const tests: string[] = [];
    const automations: string[] = [];
    const integrations: string[] = [];

    for (const mod of modules) {
      const ml = mod.toLowerCase();
      if (ml.includes("api/") || ml.includes("route.ts")) endpoints.push(mod);
      if (ml.includes("agent") || ml.includes("tool")) agents.push(mod);
      if (ml.includes("components/") && !ml.includes(".test.")) components.push(mod);
      if (ml.includes(".test.")) tests.push(mod);
      if (ml.includes("automation") || ml.includes("workflow")) automations.push(mod);
      if (ml.includes("monday") || ml.includes("integrat")) integrations.push(mod);
    }

    // Find database models
    const dbModels: string[] = [];
    const db = this.data["knowledge/database.json"];
    if (db?.models) {
      for (const m of db.models) {
        if (
          m.name?.toLowerCase().includes(q) ||
          q.includes(m.name?.toLowerCase() || "") ||
          allModulesText.includes(m.name?.toLowerCase() || "")
        ) {
          dbModels.push(m.name);
        }
      }
    }

    const totalImpact = endpoints.length + agents.length + components.length +
      dbModels.length + tests.length + automations.length + integrations.length;

    return {
      summary: "Se verán afectados:\n" +
        (endpoints.length > 0 ? "  • " + endpoints.length + " endpoints\n" : "") +
        (agents.length > 0 ? "  • " + agents.length + " agentes IA\n" : "") +
        (components.length > 0 ? "  • " + components.length + " componentes React\n" : "") +
        (dbModels.length > 0 ? "  • " + dbModels.length + " tablas Prisma\n" : "") +
        (tests.length > 0 ? "  • " + tests.length + " tests\n" : "") +
        (automations.length > 0 ? "  • " + automations.length + " automatizaciones\n" : "") +
        (integrations.length > 0 ? "  • " + integrations.length + " integraciones\n" : "") +
        (totalImpact === 0 ? "  Sin impacto directo detectado" : ""),
      endpoints: [...new Set(endpoints)],
      agents: [...new Set(agents)],
      components: [...new Set(components)],
      databaseModels: [...new Set(dbModels)],
      tests: [...new Set(tests)],
      automations: [...new Set(automations)],
      integrations: [...new Set(integrations)],
      risk: totalImpact > 15 ? "high" : totalImpact > 5 ? "medium" : "low",
    };
  }

  async estimateFeature(feature: string): Promise<FeatureEstimate> {
    this.ensureLoaded();

    // Tokenize the feature name into searchable terms
    const terms = feature
      .toLowerCase()
      .split(/[\s_\-/]+/)
      .filter((t) => t.length > 2);

    // Find related concepts in semantic index
    const relatedConcepts: string[] = [];
    const si = this.data["knowledge/semantic-index.json"];
    const allConcepts = si?.concepts || [];
    const businessTerms = si?.businessTerms || [];

    for (const term of terms) {
      for (const c of allConcepts) {
        if (
          c.concept.toLowerCase().includes(term) ||
          term.includes(c.concept.toLowerCase()) ||
          c.aliases?.some((a: string) => a.toLowerCase().includes(term))
        ) {
          if (!relatedConcepts.includes(c.concept)) relatedConcepts.push(c.concept);
        }
      }
      for (const bt of businessTerms) {
        if (
          bt.term.toLowerCase().includes(term) ||
          bt.aliases?.some((a: string) => a.toLowerCase().includes(term))
        ) {
          if (!relatedConcepts.includes(bt.term)) relatedConcepts.push(bt.term);
        }
        // Also check relatedConcepts of business terms
        if (bt.relatedConcepts) {
          for (const rc of bt.relatedConcepts) {
            if (rc.toLowerCase().includes(term) && !relatedConcepts.includes(rc)) {
              relatedConcepts.push(rc);
            }
          }
        }
      }
    }

    // Count affected modules, routes, agents
    const affectedModules = new Set<string>();
    const affectedRoutes = new Set<string>();
    const affectedAgents = new Set<string>();
    const affectedDBModels = new Set<string>();

    for (const concept of relatedConcepts) {
      const c = allConcepts.find((cx: any) => cx.concept === concept);
      if (c) {
        for (const m of c.relatedModules || []) affectedModules.add(m);
        for (const r of c.routes || []) affectedRoutes.add(r);
        for (const a of c.agents || []) affectedAgents.add(a);
        for (const db of c.databaseModels || []) affectedDBModels.add(db);
      }
    }

    // Also search knowledge by terms
    for (const term of terms) {
      const mods = await this.findModulesUsing(term);
      for (const m of mods) affectedModules.add(m);
    }

    // Count reusable patterns
    const patterns = this.data["memory/patterns"] || "";
    const patternCount = (patterns.match(/## /g) || []).length;

    // Estimate risk
    const total = affectedModules.size + affectedAgents.size;
    const risk: "low" | "medium" | "high" =
      total > 20 ? "high" : total > 8 ? "medium" : "low";

    // Recommend agent based on feature terms
    let recommendedAgent = "InternalAgent";
    for (const term of terms) {
      if (
        term.includes("ocr") ||
        term.includes("document") ||
        term.includes("factur") ||
        term.includes("certific")
      ) {
        recommendedAgent = "DocumentAgent";
      }
      if (term.includes("monday") || term.includes("calendar") || term.includes("sync")) {
        recommendedAgent = "InternalAgent";
      }
    }

    return {
      feature,
      relatedConcepts,
      affectedModules: affectedModules.size,
      affectedRoutes: affectedRoutes.size,
      affectedDBModels: affectedDBModels.size,
      affectedAgents: affectedAgents.size,
      risk,
      reusablePatterns: Math.max(0, patternCount - 4),
      recommendedAgent,
      estimatedFiles: total + affectedRoutes.size + affectedDBModels.size,
    };
  }

  async designFeature(feature: string): Promise<FeatureDesign> {
    const estimate = await this.estimateFeature(feature);

    // Build architecture suggestion
    const terms = feature.toLowerCase().split(/[\s_\-/]+/).filter((t) => t.length > 2);
    const suggestedArchitecture: string[] = [];

    // Database
    suggestedArchitecture.push("📦 Prisma model: " + terms.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(""));
    suggestedArchitecture.push("├── fields: id, code, name, ...");
    suggestedArchitecture.push("├── relations: " + estimate.relatedConcepts.join(", "));
    suggestedArchitecture.push("└── indexes: code (unique)");

    // API
    suggestedArchitecture.push("");
    suggestedArchitecture.push("🌐 API Routes:");
    suggestedArchitecture.push("├── GET    /api/" + terms[0] + "        → list");
    suggestedArchitecture.push("├── POST   /api/" + terms[0] + "        → create");
    suggestedArchitecture.push("├── GET    /api/" + terms[0] + "/[id]   → detail");
    suggestedArchitecture.push("├── PATCH  /api/" + terms[0] + "/[id]   → update");
    suggestedArchitecture.push("└── DELETE /api/" + terms[0] + "/[id]   → delete");

    // UI
    suggestedArchitecture.push("");
    suggestedArchitecture.push("🖥️ UI Components (pages):");
    suggestedArchitecture.push("├── " + terms.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join("") + "Page");
    suggestedArchitecture.push("├── " + terms.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join("") + "Form");
    suggestedArchitecture.push("└── " + terms.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join("") + "DetailModal");

    // Agent
    suggestedArchitecture.push("");
    suggestedArchitecture.push("🤖 Agent integration:");
    suggestedArchitecture.push("├── handlers: handle" + terms.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join("") + "()");
    suggestedArchitecture.push("└── intents: \"" + terms[0] + "\"");
    suggestedArchitecture.push("");
    suggestedArchitecture.push("⚡ Recomendación: Usar CRUD factory + " + estimate.recommendedAgent);

    // Collect existing patterns
    const patternsList: { name: string; location: string }[] = [];
    const patterns = this.data["memory/patterns"] || "";
    const patternLines = (patterns as string).split("\n");
    for (let i = 0; i < patternLines.length; i++) {
      if (patternLines[i].startsWith("## ")) {
        const name = patternLines[i].replace("## ", "").trim();
        const locLine = patternLines[i + 1] || "";
        const location = locLine.replace("- **Location:** ", "").replace("`", "").replace("`", "").trim();
        if (name && name !== "Common Abstractions Across Modules") {
          patternsList.push({ name, location });
        }
      }
    }

    // Decision history
    const decisionHistory: string[] = [];
    const decisions = this.data["memory/decisions"] || "";
    const decisionLines = (decisions as string).split("\n");
    for (let i = 0; i < decisionLines.length; i++) {
      if (decisionLines[i].startsWith("## ")) {
        decisionHistory.push(decisionLines[i].replace("## ", "").trim());
      }
    }

    // Database impact
    const dbImpact = estimate.relatedConcepts.length > 0
      ? ["New table for " + feature, "Relations with: " + estimate.relatedConcepts.join(", ")]
      : ["New table for " + feature];

    // Route impact
    const routeImpact = [
      "New CRUD routes for /api/" + terms[0],
      "Integration with existing routes of: " + (estimate.relatedConcepts.join(", ") || "none"),
    ];

    return {
      ...estimate,
      suggestedArchitecture,
      patterns: patternsList,
      databaseImpact: dbImpact,
      routeImpact,
      decisionHistory,
    };
  }

  async findDeadCode(): Promise<DeadCodeItem[]> {
    this.ensureLoaded();

    const dead: DeadCodeItem[] = [] as DeadCodeItem[];

    // For each analyzer item with exports, check if any export is imported by another item
    const aiDir = path.join(process.cwd(), "docs-vault", ".ai");
    const indexFile = path.join(process.cwd(), "docs-vault", ".index");
    if (!fs.existsSync(indexFile)) return [];

    const index = JSON.parse(fs.readFileSync(indexFile, "utf-8"));
    const allItems: { type: string; name: string; path: string; exports?: string[]; dependencies?: string[] }[] = [];

    for (const [type, result] of Object.entries(index.analyzers as Record<string, any>)) {
      for (const item of result.items || []) {
        allItems.push({
          type,
          name: item.name,
          path: item.path,
          exports: item.metadata?.exports,
          dependencies: item.dependencies,
        });
      }
    }

    // Check each item's exports against all other items' dependencies
    for (const item of allItems) {
      if (!item.exports || item.exports.length === 0) continue;

      for (const exp of item.exports) {
        // Check if any other item imports this export
        const isUsed = allItems.some(
          (other) =>
            other.path !== item.path &&
            (other.dependencies || []).some(
              (dep) => dep.includes(item.name.split("/").pop()!) || dep.includes(exp)
            )
        );

        if (!isUsed) {
          // Check if it's a React component (likely used in pages/templates)
          const isReactComponent = item.path.includes("components/") && exp[0] === exp[0]?.toUpperCase();
          if (!isReactComponent) {
            dead.push({
              module: item.path,
              exportName: exp,
              type: item.type,
              reason: !isUsed
                ? "Export no importado por ningún otro módulo"
                : "Verificar: posible código no utilizado",
            });
          }
        }
      }
    }

    return dead.slice(0, 30);
  }

  async findUnusedRoutes(): Promise<UnusedRoute[]> {
    this.ensureLoaded();

    const routes = this.data["knowledge/routes.json"];
    if (!routes?.routes) return [];

    const allText = JSON.stringify(this.data).toLowerCase();
    const unused: UnusedRoute[] = [];

    for (const r of routes.routes) {
      const routePath = r.path?.toLowerCase() || "";
      const routeId = r.id?.toLowerCase() || "";

      // Check if route is referenced by any knowledge or architecture content
      const isReferenced =
        allText.includes(routePath.replace(/\\/g, "/")) ||
        allText.includes(routeId) ||
        routePath.includes("health") || // health endpoint is expected to be unused
        routePath.includes("seed"); // seed endpoint is admin-only

      // Routes are always "referenced" by their own definition
      // Check if there's external reference
      const aiDir = path.join(process.cwd(), "docs-vault", ".ai");
      const knowledgeDir = path.join(aiDir, "knowledge");
      let externalRefs = 0;
      if (fs.existsSync(knowledgeDir)) {
        for (const f of fs.readdirSync(knowledgeDir)) {
          if (f.endsWith(".json") && f !== "routes.json") {
            const content = fs.readFileSync(path.join(knowledgeDir, f), "utf-8").toLowerCase();
            if (content.includes(routePath.replace(/\\/g, "/")) || content.includes(routeId)) {
              externalRefs++;
            }
          }
        }
      }

      if (externalRefs === 0 && !isReferenced) {
        unused.push({
          path: r.path,
          method: r.method || "?",
          reason: "Sin referencias externas en knowledge/",
        });
      }
    }

    return unused;
  }

  async findCircularDependencies(): Promise<CircularDependency[]> {
    this.ensureLoaded();

    const deps = this.data["knowledge/dependencies.json"];
    if (!deps?.codeRelations) return [];

    // Build adjacency list
    const graph = new Map<string, string[]>();
    for (const rel of deps.codeRelations) {
      if (!graph.has(rel.source)) graph.set(rel.source, []);
      graph.get(rel.source)!.push(rel.target);
    }

    // DFS with cycle detection
    const cycles: CircularDependency[] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const pathStack: string[] = [];

    function dfs(node: string) {
      visited.add(node);
      recStack.add(node);
      pathStack.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = pathStack.indexOf(neighbor);
          const cycle = pathStack.slice(cycleStart).concat(neighbor);
          if (!cycles.some((c) => JSON.stringify(c.chain) === JSON.stringify(cycle))) {
            cycles.push({ chain: cycle });
          }
        }
      }

      pathStack.pop();
      recStack.delete(node);
    }

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles.slice(0, 20);
  }

  async summarizeModule(modulePath: string): Promise<string> {
    this.ensureLoaded();

    const q = modulePath.toLowerCase();
    const parts: string[] = [];
    parts.push("## Module: " + modulePath);

    // Find in modules
    const mods = this.data["knowledge/modules.json"];
    if (mods?.modules) {
      for (const m of mods.modules) {
        if (m.path?.toLowerCase() === q || m.name?.toLowerCase() === q) {
          parts.push("Type: " + (m.type || "unknown"));
          parts.push("Description: " + (m.description || "No description"));
          if (m.dependencies?.length) {
            parts.push("Dependencies: " + m.dependencies.join(", "));
          }
        }
      }
    }

    // Find routes
    const routes = this.data["knowledge/routes.json"];
    if (routes?.routes) {
      const routeMatches = routes.routes.filter(
        (r: any) => r.path?.toLowerCase().includes(q) || r.id?.toLowerCase().includes(q)
      );
      if (routeMatches.length > 0) {
        parts.push("Routes:");
        for (const r of routeMatches) {
          parts.push("  " + r.method + " " + r.id + " (auth: " + r.auth + ")");
        }
      }
    }

    // Find agents
    const agents = this.data["knowledge/agents.json"];
    if (agents?.modules) {
      for (const mod of agents.modules) {
        for (const item of mod.items || []) {
          if (item.path?.toLowerCase().includes(q) || item.id?.toLowerCase().includes(q)) {
            parts.push("Agent module: " + item.name + " (" + (item.description || "No description") + ")");
          }
        }
      }
    }

    if (parts.length === 1) {
      parts.push("No se encontró información para: " + modulePath);
    }

    return parts.join("\n");
  }
}

// ── CLI Entry Point ──

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("Project Brain — Knowledge Engine for ObraCero");
    console.log("");
    console.log("Usage:");
    console.log("  npx tsx scripts/brain.ts <command> [args...]");
    console.log("");
    console.log("Commands:");
    console.log("  context                    → Project context summary");
    console.log("  architecture               → Architecture overview");
    console.log("  search <query>             → Search all knowledge");
    console.log("  modules-using <concept>    → Find modules using a concept");
    console.log("  what-breaks <target>       → Impact analysis");
    console.log("  estimate <feature>         → Feature impact estimation");
    console.log("  design <feature>           → Feature design blueprint");
    console.log("  dead-code                  → Find potentially unused code");
    console.log("  unused-routes              → Find potentially unused routes");
    console.log("  circular-deps              → Find circular dependencies");
    console.log("  module <path>              → Summarize a module");
    return;
  }

  const brain = new ProjectBrain();
  await brain.load();
  const command = args[0];

  switch (command) {
    case "context": {
      const ctx = await brain.getContext();
      console.log(JSON.stringify(ctx, null, 2));
      break;
    }
    case "architecture": {
      const arch = await brain.explainArchitecture();
      console.log(arch);
      break;
    }
    case "search": {
      const query = args.slice(1).join(" ");
      const results = await brain.searchKnowledge(query);
      if (results.length === 0) {
        console.log("No results found for:", query);
      } else {
        for (const r of results) {
          console.log(`[${r.type}] ${r.item} (relevance: ${r.relevance})`);
          console.log("  " + r.context);
          console.log();
        }
        console.log(`--- ${results.length} results ---`);
      }
      break;
    }
    case "modules-using": {
      const concept = args.slice(1).join(" ");
      const modules = await brain.findModulesUsing(concept);
      console.log("Modules using '" + concept + "':");
      if (modules.length === 0) console.log("  None found");
      else modules.forEach((m) => console.log("  • " + m));
      console.log("--- " + modules.length + " modules ---");
      break;
    }
    case "what-breaks": {
      const target = args.slice(1).join(" ");
      const report = await brain.whatBreaksIf(target);
      console.log("Impact Analysis for: " + target);
      console.log("Risk: " + report.risk.toUpperCase());
      console.log(report.summary);
      console.log();
      if (report.endpoints.length > 0) console.log("Endpoints:", report.endpoints.length);
      if (report.agents.length > 0) console.log("Agents:", report.agents.length);
      if (report.components.length > 0) console.log("Components:", report.components.length);
      if (report.databaseModels.length > 0) console.log("DB Models:", report.databaseModels.length);
      if (report.tests.length > 0) console.log("Tests:", report.tests.length);
      if (report.automations.length > 0) console.log("Automations:", report.automations.length);
      if (report.integrations.length > 0) console.log("Integrations:", report.integrations.length);
      break;
    }
    case "estimate": {
      const feature = args.slice(1).join(" ");
      const est = await brain.estimateFeature(feature);
      console.log("Feature Estimate: " + feature);
      console.log(JSON.stringify(est, null, 2));
      break;
    }
    case "design": {
      const feature = args.slice(1).join(" ");
      const design = await brain.designFeature(feature);
      console.log("Feature Design: " + feature);
      console.log("Risk: " + design.risk.toUpperCase());
      console.log("Recommended agent: " + design.recommendedAgent);
      console.log("Affected: " + design.affectedModules + " modules, " +
        design.affectedRoutes + " routes, " +
        design.affectedDBModels + " DB models, " +
        design.affectedAgents + " agents");
      console.log("Estimated files to create/modify: " + design.estimatedFiles);
      console.log("Reusable patterns: " + design.reusablePatterns);
      console.log();
      console.log("Suggested Architecture:");
      console.log(design.suggestedArchitecture.join("\n"));
      break;
    }
    case "dead-code": {
      const dead = await brain.findDeadCode();
      if (dead.length === 0) {
        console.log("No dead code detected.");
      } else {
        console.log("Potentially dead code (" + dead.length + " items):");
        for (const d of dead) {
          console.log("  • " + d.module + " → " + d.exportName + " (" + d.reason + ")");
        }
      }
      break;
    }
    case "unused-routes": {
      const unused = await brain.findUnusedRoutes();
      if (unused.length === 0) {
        console.log("No potentially unused routes found.");
      } else {
        console.log("Potentially unused routes:");
        for (const u of unused) {
          console.log("  • " + u.method + " " + u.path + " (" + u.reason + ")");
        }
      }
      break;
    }
    case "circular-deps": {
      const cycles = await brain.findCircularDependencies();
      if (cycles.length === 0) {
        console.log("No circular dependencies detected.");
      } else {
        console.log("Circular dependencies (" + cycles.length + "):");
        for (const c of cycles) {
          console.log("  " + c.chain.join(" → "));
        }
      }
      break;
    }
    case "module": {
      const modPath = args.slice(1).join(" ");
      const summary = await brain.summarizeModule(modPath);
      console.log(summary);
      break;
    }
    default: {
      console.log("Unknown command: " + command);
      console.log("Run without arguments for usage.");
    }
  }
}

// Run on import
if (require.main === module) {
  main().catch(console.error);
}

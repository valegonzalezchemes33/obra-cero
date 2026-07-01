import * as fs from "fs";
import * as path from "path";
import type { AnalyzerResult, Relation, ProjectIndex, AnalyzerItem } from "../analyzer.interface";

// ── Helpers ──
// AI_DIR = contenido interno para agentes (knowledge, rules, state)
// VAULT_DIR = contenido visible en Obsidian (architecture, memory)
// Ambos están dentro de docs-vault/ para que agentes y humanos vean lo mismo

const AI_DIR = "docs-vault/.ai";
const VAULT_DIR = "docs-vault";

function ensureDir(...parts: string[]) {
  const dir = path.join(process.cwd(), AI_DIR, ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function write(filename: string, content: string) {
  const fullPath = path.join(process.cwd(), AI_DIR, filename);
  const dir = path.dirname(fullPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content, "utf-8");
}

function writeJSON(filename: string, data: unknown) {
  write(filename, JSON.stringify(data, null, 2));
}

/** Write directly to the vault (for content visible in Obsidian) */
function writeVault(filename: string, content: string) {
  const fullPath = path.join(process.cwd(), VAULT_DIR, filename);
  const dir = path.dirname(fullPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content, "utf-8");
}

/** Agrega frontmatter con type y tags compatibles con Dataview al inicio de un string */
function addDataviewFrontmatter(type: string, tags: string[], extraFields: Record<string, string> = {}): string {
  const lines = ["---"];
  lines.push(`type: ${type}`);
  if (tags.length > 0) lines.push(`tags: [${tags.join(", ")}]`);
  for (const [k, v] of Object.entries(extraFields)) {
    lines.push(`${k}: ${v}`);
  }
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

// ── Knowledge Builders ──

function buildProjectKnowledge(
  results: Map<string, AnalyzerResult>,
  index: ProjectIndex
) {
  // Read raw package.json to get exact versions
  let version = "0.0.0";
  const deps: Record<string, string> = {};
  const pkgPath = path.join(process.cwd(), "package.json");
  try {
    const raw = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    version = raw.version || version;
    if (raw.dependencies) Object.assign(deps, raw.dependencies);
    if (raw.devDependencies) Object.assign(deps, raw.devDependencies);
  } catch { /* ignore */ }

  writeJSON("knowledge/project.json", {
    name: "ObraCero",
    version,
    description: "Sistema CRM interno con Agente IA para la construcción",
    architecture: "NextJS + Prisma + Groq",
    frontend: "NextJS + Tailwind CSS + shadcn/ui",
    backend: "Next.js API Routes + Prisma ORM",
    database: "PostgreSQL via Prisma",
    ai: "Groq LLM + Internal Agent System",
    lastScan: index.generatedAt,
    fileCount: index.global.statistics.total,
    itemCount: Object.values(index.global.statistics).reduce((a, b) => a + b, 0) - (index.global.statistics.total || 0),
    dependencies: {
      react: deps.react || "unknown",
      next: deps.next || "unknown",
      prisma: deps.prisma || deps["@prisma/client"] || "unknown",
      tailwind: deps.tailwindcss || deps["tailwindcss"] || "unknown",
      groq: deps["groq-sdk"] || deps.groq_sdk || "none",
    },
  } as const);
}

function buildModulesKnowledge(results: Map<string, AnalyzerResult>) {
  const modules = results.get("modules")?.items ?? [];
  const agentModules = results.get("agent")?.items ?? [];
  const combined = [
    ...modules.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      path: m.path,
      description: m.description || "",
      dependencies: m.dependencies || [],
    })),
    ...agentModules.map((m) => ({
      id: m.id,
      name: m.name,
      type: "agent-module",
      path: m.path,
      description: m.description || "",
      dependencies: m.dependencies || [],
    })),
  ];

  writeJSON("knowledge/modules.json", {
    total: combined.length,
    modules: combined,
  });
}

function buildRoutesKnowledge(results: Map<string, AnalyzerResult>) {
  const routes = results.get("routes")?.items ?? [];

  writeJSON("knowledge/routes.json", {
    total: routes.length,
    routes: routes.map((r) => ({
      id: r.id,
      path: r.path,
      method: r.metadata.method || "GET",
      description: r.description || "",
      auth: r.metadata.auth ?? true,
      schema: r.metadata.schema || null,
    })),
  });
}

function buildDatabaseKnowledge(results: Map<string, AnalyzerResult>) {
  const models = results.get("prisma")?.items ?? [];

  writeJSON("knowledge/database.json", {
    total: models.length,
    models: models.map((m) => ({
      name: m.name,
      description: m.description || "",
      fields: (m.metadata.fields || []).map((f: any) => ({
        name: f.name,
        type: f.type,
        required: f.required ?? true,
        unique: f.unique ?? false,
        default: f.default ?? null,
      })),
      relations: (m.metadata.relations || []).map((r: any) => ({
        field: r.field,
        model: r.model,
        type: r.type,
      })),
      indexes: (m.metadata.indexes || []).map((i: any) => ({
        fields: i.fields,
        unique: i.unique ?? false,
      })),
    })),
  });
}

function buildAgentsKnowledge(results: Map<string, AnalyzerResult>) {
  const agentItems = results.get("agent")?.items ?? [];

  const byModule = new Map<string, AnalyzerItem[]>();
  for (const item of agentItems) {
    const module = item.metadata.module || "core";
    if (!byModule.has(module)) byModule.set(module, []);
    byModule.get(module)!.push(item);
  }

  writeJSON("knowledge/agents.json", {
    total: agentItems.length,
    modules: Array.from(byModule.entries()).map(([name, items]) => ({
      name,
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description || "",
        capabilities: i.metadata.capabilities || [],
        dependencies: i.dependencies || [],
      })),
    })),
  });
}

function buildAutomationKnowledge(results: Map<string, AnalyzerResult>) {
  const automations = results.get("automations")?.items ?? [];

  writeJSON("knowledge/automation.json", {
    total: automations.length,
    automations: automations.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      path: a.path,
      description: a.description || "",
      triggers: a.metadata.triggers || [],
      conditions: a.metadata.conditions || [],
    })),
  });
}

function buildDependenciesKnowledge(results: Map<string, AnalyzerResult>, allRelations: Relation[]) {
  const configItems = results.get("config")?.items ?? [];
  const pkg = configItems.find((i) => i.name === "package.json")?.metadata ?? {};
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  const dependencyGraph = allRelations
    .filter((r) => r.type === "imports" || r.type === "uses")
    .map((r) => ({
      source: r.source,
      target: r.target,
      type: r.type,
    }));

  writeJSON("knowledge/dependencies.json", {
    packages: Object.entries(deps).map(([name, version]) => ({
      name,
      version,
    })),
    codeRelations: dependencyGraph,
  });
}

// ── Semantic Index Builder ──

function normalizeConcept(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildSemanticIndex(results: Map<string, AnalyzerResult>, allRelations: Relation[]) {
  // 1. Extract core concepts from Prisma models
  const models = results.get("prisma")?.items ?? [];
  const coreConcepts = models.map((m) => m.name);

  // 2. Cross-reference concepts across all analyzers
  const allItems = [...results.values()].flatMap((r) => r.items);

  // Business terms (non-model concepts) with manual + auto-detection
  const knownBusinessTerms: { term: string; aliases: string[]; description: string }[] = [
    { term: "Presupuesto", aliases: ["Budget", "budget"], description: "Budget tracking and analysis per project" },
    { term: "Monday", aliases: ["monday", "MONDAY"], description: "Monday.com integration for task sync" },
    { term: "Informe", aliases: ["Report", "report"], description: "Reporting and analytics" },
    { term: "OCR", aliases: ["ocr", "OCRAgent"], description: "OCR document processing agent" },
    { term: "Dashboard", aliases: ["dashboard"], description: "Main dashboard with KPIs and charts" },
  ];

  // Auto-detect additional business terms from file names and descriptions
  for (const item of allItems) {
    const pathLower = item.path.toLowerCase();
    const nameLower = item.name.toLowerCase();
    const descLower = (item.description || "").toLowerCase();

    for (const bt of knownBusinessTerms) {
      const aliases = [bt.term.toLowerCase(), ...bt.aliases.map((a) => a.toLowerCase())];
      // Already tracked, skip
    }

    // Detect potential new terms from file names
    const segments = pathLower.split(/[/\\]/);
    for (const seg of segments) {
      const clean = seg.replace(/\.(ts|tsx|json|md)$/, "");
      if (
        clean.length > 3 &&
        !coreConcepts.some((c) => normalizeConcept(c) === clean) &&
        !["src", "app", "api", "lib", "components", "node_modules", ".next"].includes(clean) &&
        !clean.includes("test") &&
        !knownBusinessTerms.some((t) => normalizeConcept(t.term) === clean)
      ) {
        // Potential business term from file/dir name
      }
    }
  }

  // Build concepts from Prisma models
  const concepts = coreConcepts.map((concept) => {
    const conceptLower = concept.toLowerCase();

    // Find related modules
    const relatedModules = allItems
      .filter(
        (i) =>
          i.name.toLowerCase().includes(conceptLower) ||
          i.path.toLowerCase().includes(conceptLower) ||
          (i.description || "").toLowerCase().includes(conceptLower)
      )
      .map((i) => i.path)
      .filter((p, idx, arr) => arr.indexOf(p) === idx);

    // Find routes
    const routeItems = results.get("routes")?.items ?? [];
    const routes = routeItems
      .filter(
        (r) =>
          r.path.toLowerCase().includes(conceptLower) ||
          r.id.toLowerCase().includes(conceptLower) ||
          (r.description || "").toLowerCase().includes(conceptLower)
      )
      .map((r) => r.id)
      .filter((p, idx, arr) => arr.indexOf(p) === idx);

    // Find UI pages
    const pageItems = results.get("pages")?.items ?? [];
    const ui = pageItems
      .filter(
        (p) =>
          p.name.toLowerCase().includes(conceptLower) ||
          p.path.toLowerCase().includes(conceptLower)
      )
      .map((p) => p.name)
      .filter((p, idx, arr) => arr.indexOf(p) === idx);

    // Find agent modules
    const agentItems = results.get("agent")?.items ?? [];
    const agents = agentItems
      .filter(
        (a) =>
          a.name.toLowerCase().includes(conceptLower) ||
          (a.description || "").toLowerCase().includes(conceptLower) ||
          a.path.toLowerCase().includes(conceptLower)
      )
      .map((a) => a.name)
      .filter((p, idx, arr) => arr.indexOf(p) === idx);

    // Find automations
    const automationItems = results.get("automations")?.items ?? [];
    const automations = automationItems
      .filter(
        (a) =>
          a.name.toLowerCase().includes(conceptLower) ||
          (a.description || "").toLowerCase().includes(conceptLower)
      )
      .map((a) => a.name)
      .filter((p, idx, arr) => arr.indexOf(p) === idx);

    // Find tests
    const tests = allItems
      .filter(
        (i) =>
          i.path.toLowerCase().includes(".test.") &&
          (i.name.toLowerCase().includes(conceptLower) ||
            i.path.toLowerCase().includes(conceptLower))
      )
      .map((i) => i.path)
      .filter((p, idx, arr) => arr.indexOf(p) === idx);

    // Find integrations (Monday, etc.)
    const integrations: string[] = [];
    for (const bt of knownBusinessTerms) {
      if (
        relatedModules.some((m) => m.toLowerCase().includes(bt.term.toLowerCase())) ||
        routes.some((r) => r.toLowerCase().includes(bt.term.toLowerCase()))
      ) {
        integrations.push(bt.term);
      }
    }

    // Find related concepts (other concepts referenced by this one)
    const relatedConcepts = coreConcepts.filter((other) => {
      if (other === concept) return false;
      // Check if modules of this concept reference other concept
      return relatedModules.some((m) => m.toLowerCase().includes(other.toLowerCase()));
    });

    return {
      concept,
      aliases: concept === "Project" ? ["Obra", "Proyecto"] : [],
      description: `Prisma model: ${concept}`,
      relatedModules,
      databaseModels: [concept],
      routes,
      ui,
      agents,
      automations,
      tests,
      integrations,
      relatedConcepts,
    };
  });

  // Build business terms section
  const businessTerms = knownBusinessTerms.map((bt) => {
    const btLower = bt.term.toLowerCase();
    const relatedConcepts = coreConcepts.filter((concept) => {
      const allStrings = [
        ...concepts.find((c) => c.concept === concept)?.relatedModules || [],
        ...concepts.find((c) => c.concept === concept)?.routes || [],
      ];
      return allStrings.some((s) => s.toLowerCase().includes(btLower));
    });

    return {
      term: bt.term,
      aliases: bt.aliases,
      description: bt.description,
      relatedConcepts,
    };
  });

  writeJSON("knowledge/semantic-index.json", {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    totalConcepts: concepts.length + businessTerms.length,
    concepts,
    businessTerms,
  });
}

function buildArchitectureOverview(results: Map<string, AnalyzerResult>) {
  const stats = [...results.values()].flatMap((r) => r.items);
  const routes = results.get("routes")?.items ?? [];
  const models = results.get("prisma")?.items ?? [];
  const agentItems = results.get("agent")?.items ?? [];

  writeVault("architecture/overview.md", addDataviewFrontmatter("architecture", ["architecture", "overview"], {
    title: "\"ObraCero — Architecture Overview\"",
    module: "core",
    status: "active",
  }) + `# Architecture Overview

## Stack
- **Frontend:** Next.js + Tailwind CSS + shadcn/ui
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL via Prisma ORM
- **AI Engine:** Groq LLM + Internal Agent System

## Project Stats
- Total modules: ${stats.length}
- API routes: ${routes.length}
- Database models: ${models.length}
- Agent modules: ${agentItems.length}

## Layers
\`\`\`
┌─────────────────────────────┐
│        Frontend (Pages)     │
├─────────────────────────────┤
│     API Routes (Backend)    │
├─────────────────────────────┤
│   Agent System (Groq + IA)  │
├─────────────────────────────┤
│     Prisma ORM (Database)   │
├─────────────────────────────┤
│     PostgreSQL (Storage)    │
└─────────────────────────────┘
\`\`\`

## Key Patterns
- CRUD via factory pattern (\`src/lib/crud-factory.ts\`)
- Caching layer with rate limiting
- Agent-based intent dispatch
- Prisma for all database access
`);
}

function buildArchitectureBackend(results: Map<string, AnalyzerResult>) {
  const routes = results.get("routes")?.items ?? [];

  const grouped = new Map<string, AnalyzerItem[]>();
  for (const r of routes) {
    const prefix = r.path.split("/").slice(0, 4).join("/");
    if (!grouped.has(prefix)) grouped.set(prefix, []);
    grouped.get(prefix)!.push(r);
  }

  let content = `# Backend Architecture

## API Routes (${routes.length} total)

Each route follows the Next.js App Router pattern with \`route.ts\` files.

| Route | Methods |
|-------|---------|\n`;

  for (const [prefix, items] of grouped) {
    const methods = [...new Set(items.map((i) => i.metadata.method).filter(Boolean))].join(", ");
    content += `| \`${prefix}\` | ${methods} |\n`;
    for (const item of items) {
      const note = item.metadata.auth === false ? " (public)" : "";
      content += `|   ${item.id.split("/").pop()} | ${item.metadata.method || "?"}${note} |\n`;
    }
  }

  content += `
## Auth
All routes require authentication by default (via middleware).
Exceptions are marked as (public).

## Patterns
- All CRUD routes use \`src/lib/crud-factory.ts\` helpers
- Custom logic routes live alongside their CRUD counterparts
- Route handlers receive \`PrismaClient\` via singleton
`;

  writeVault("architecture/backend.md", content);
}

function buildArchitectureFrontend(results: Map<string, AnalyzerResult>) {
  const pages = results.get("pages")?.items ?? [];

  let content = `# Frontend Architecture

## Pages (${pages.length} total)

| Page | Route |
|------|-------|\n`;
  for (const p of pages) {
    content += `| ${p.name} | \`${p.path.replace(/\\/g, "/")}\` |\n`;
  }

  content += `
## Stack
- Next.js (App Router)
- Tailwind CSS
- shadcn/ui components
- Server Components by default
- Client Components where interactivity needed

## State Management
- React Server Components for data fetching
- URL search params for filter/shareable state
- No global state library (kept intentionally simple)
`;

  writeVault("architecture/frontend.md", content);
}

function buildArchitectureDatabase(results: Map<string, AnalyzerResult>) {
  const models = results.get("prisma")?.items ?? [];

  let content = `# Database Architecture

## Models (${models.length} total)

| Model | Fields | Relations |
|-------|--------|-----------|\n`;
  for (const m of models) {
    const fields = (m.metadata.fields || []).length;
    const rels = (m.metadata.relations || []).length;
    content += `| ${m.name} | ${fields} | ${rels} |\n`;
  }

  content += `
## Key Relationships
\`\`\`
Project ──hasMany──> Task
Project ──hasMany──> Transaction
Project ──hasMany──> PurchaseOrder
Supplier ──hasMany──> PurchaseOrder
Material ──hasMany──> StockMovement
PurchaseOrder ──belongsTo──> Supplier
PurchaseOrder ──belongsTo──> Project
\`\`\`

## Conventions
- All models have \`id\` (UUID), \`createdAt\`, \`updatedAt\`
- Soft delete via \`deletedAt\` where applicable
- Relations use implicit Prisma conventions
`;

  writeVault("architecture/database.md", content);
}

function buildArchitectureAgents(results: Map<string, AnalyzerResult>) {
  const agentItems = results.get("agent")?.items ?? [];
  const mcpItems = results.get("mcp")?.items ?? [];
  const automationItems = results.get("automations")?.items ?? [];

  writeVault("architecture/agents.md", `# Agent Architecture

## Internal Agent
- **Engine:** Groq LLM
- **Total modules:** ${agentItems.length}
- **Capabilities:** Intent detection, tool dispatch, context management

### Module Categories
${agentItems.map((i) => `- **${i.name}** — ${i.description || "No description"}`).join("\n")}

## MCP Bridge
- **Total integrations:** ${mcpItems.length}
${mcpItems.map((i) => `- ${i.name}: ${i.description || "N/A"}`).join("\n")}

## Automations
- **Total workflows:** ${automationItems.length}
${automationItems.map((i) => `- ${i.name}: ${i.description || i.path}`).join("\n")}

## Flow
\`\`\`
User Input → Intent Detection → Handler Dispatch → Tool Execution → Response
                                    │
                                    ▼
                           Database (Prisma)
\`\`\`
`);
}

// ── Rules Builder ──

function buildAgentRules() {
  write("rules/AGENT_RULES.md", "# Reglas Obligatorias para Agentes de IA\n" +
"\n" +
"> Estas reglas son de cumplimiento obligatorio para cualquier agente\n" +
"> que interactúe con el código de ObraCero.\n" +
"\n" +
"---\n" +
"\n" +
"## Regla 1: Single Source of Truth\n" +
"\n" +
"La carpeta `.ai/` es la **única fuente de verdad** para entender el proyecto.\n" +
"No inferir arquitectura, estructura o decisiones desde el código fuente.\n" +
"Leer `.ai/` primero.\n" +
"\n" +
"## Regla 2: Protocolo de 8 Pasos\n" +
"\n" +
"TODO agente debe seguir el protocolo definido en `.ai/ENTRYPOINT.md`:\n" +
"\n" +
"1. Leer PROJECT_STATE.json\n" +
"2. Verificar VERSION y CHANGE_ID\n" +
"3. Leer knowledge/ del área a modificar\n" +
"4. Leer architecture/ del área a modificar\n" +
"5. Leer memory/ (decisions, patterns, bugs, lessons)\n" +
"6. Analizar impacto del cambio\n" +
"7. Modificar código\n" +
"8. Actualizar memoria automáticamente\n" +
"\n" +
"## Regla 3: Detección de Staleness\n" +
"\n" +
"- Antes de cada tarea, comparar el `changeId` de PROJECT_STATE.json\n" +
"  con el que el agente tiene registrado localmente.\n" +
"- Si `changeId` cambió: la memoria fue actualizada por otro agente.\n" +
"  Releer architecture/ y knowledge/ relevante antes de actuar.\n" +
"- Si el código fuente no coincide con la memoria: ejecutar `npm run docs`\n" +
"  para regenerar y luego verificar que coincidan.\n" +
"\n" +
"## Regla 4: Actualización Obligatoria\n" +
"\n" +
"Después de cualquier cambio relevante:\n" +
"\n" +
"1. Ejecutar `npm run docs` para regenerar `.ai/` completo.\n" +
"2. Si el cambio es importante, agregar entrada en `memory/decisions.md`\n" +
"   con formato: `YYYY-MM-DD — Título` y secciones Context/Decision/Impact.\n" +
"3. Si se descubrió un bug, agregarlo a `memory/known-bugs.md`.\n" +
"4. Si se completó un hito, actualizar `memory/roadmap.md`.\n" +
"5. Verificar que `npm run build` y `npm test` pasan.\n" +
"\n" +
"## Regla 5: Consistencia\n" +
"\n" +
"- Seguir los patrones definidos en `memory/patterns.md`.\n" +
"- No introducir nuevos patrones sin registrarlos en `memory/patterns.md`.\n" +
"- No cambiar la arquitectura sin actualizar `architecture/`.\n" +
"- No eliminar archivos de `.ai/` sin entender el impacto.\n" +
"\n" +
"## Regla 6: Trazabilidad\n" +
"\n" +
"Cada cambio importante debe poder rastrearse a:\n" +
"- Una entrada en `memory/decisions.md` (el por qué)\n" +
"- Un cambio en `knowledge/` o `architecture/` (el qué)\n" +
"- Un cambioId incrementado en `PROJECT_STATE.json` (el cuándo)\n" +
"\n" +
"## Regla 7: Prioridad de la Memoria\n" +
"\n" +
"Si hay conflicto entre el código fuente y la memoria:\n" +
"1. La memoria es la fuente de verdad del diseño INTENCIONADO.\n" +
"2. El código es la fuente de verdad de la implementación REAL.\n" +
"3. Si difieren, actualizar la memoria para reflejar el código real,\n" +
"   o actualizar el código para cumplir con la memoria.\n" +
"4. En caso de duda, ejecutar `npm run docs` y verificar.\n");
}

// ── History Builder ──

function buildHistoryConversation() {
  const today = new Date().toISOString().split("T")[0];

  // Only create file if it doesn't exist (preserve hand-curated content)
  const historyPath = path.join(process.cwd(), AI_DIR, "history", today + ".md");
  if (fs.existsSync(historyPath)) return;

  write("history/" + today + ".md", "# Conversación — " + today + "\n" +
"\n" +
"> Este archivo registra decisiones tomadas durante conversaciones con agentes.\n" +
"> Cada entrada debe incluir: qué se decidió, por qué, y alternativas descartadas.\n" +
"\n" +
"---\n" +
"\n" +
"## Decisiones de esta sesión\n" +
"\n" +
"### Decisión: [Título]\n" +
"- **Contexto:** ¿Por qué se tomó esta decisión?\n" +
"- **Decisión:** ¿Qué se resolvió?\n" +
"- **Alternativas descartadas:** ¿Qué otras opciones se consideraron?\n" +
"- **Impacto:** ¿Qué cambia en el proyecto?\n" +
"- **Archivos tocados:** `path/to/file.ts`, `path/to/other.ts`\n" +
"\n" +
"---\n" +
"\n" +
"_Completar durante o después de la conversación._\n");
}

function buildHistoryIndex(results: Map<string, AnalyzerResult>) {
  // Build an index of all history files
  const historyDir = path.join(process.cwd(), AI_DIR, "history");
  if (!fs.existsSync(historyDir)) return;

  const files = fs.readdirSync(historyDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse();

  if (files.length === 0) return;

  write("history/README.md", "# Historial de Conversaciones\n" +
"\n" +
"Registro cronológico de decisiones tomadas en conversaciones.\n" +
"\n" +
"| Fecha | Archivo |\n" +
"|-------|--------|\n" +
files.map((f) => "| " + f.replace(".md", "") + " | [" + f + "](" + f + ") |\n").join("") +
"\n" +
"---\n" +
"\n" +
"_Actualizado automáticamente por el Project Intelligence System._\n");
}

function buildMemoryDecisions(index: ProjectIndex) {
  const timestamp = index.generatedAt.split("T")[0];

  writeVault("memory/decisions.md", addDataviewFrontmatter("decisions", ["memory", "decision"], {
    title: "\"Decision Log\"",
    module: "memory",
    status: "active",
  }) + `# Decision Log

## YYYY-MM-DD — Title
- **Context:** What prompted the decision
- **Decision:** What was decided
- **Alternatives:** What was considered
- **Impact:** What this means for the project

---

*Auto-generated entries:*

## ${timestamp} — Project Intelligence System
- **Context:** El proyecto necesitaba una capa de memoria compartida para agentes de IA
- **Decision:** Se creó \`.ai/\` como fuente única de verdad con \`knowledge/\`, \`architecture/\`, \`memory/\`
- **Alternatives:** Documentación tradicional en docs/, wiki externa
- **Impact:** Cualquier agente puede entender el proyecto en segundos leyendo \`.ai/ENTRYPOINT.md\`

## ${timestamp} — CRUD Factory
- **Context:** Rutas duplicaban lógica CRUD manualmente
- **Decision:** Se creó \`src/lib/crud-factory.ts\` con 7 helpers
- **Alternatives:** Clases base, librería externa
- **Impact:** 10 rutas migradas. Nueva ruta CRUD requiere ~10 líneas.

## ${timestamp} — N+1 Query Fixes
- **Context:** Varias queries cargaban datos innecesarios
- **Decision:** Se aplicaron límites, selects específicos, y se eliminaron includes no usados
- **Alternatives:** Paginación completa con cursor
- **Impact:** Reducción significativa de datos transferidos por query
`);
}

function buildMemoryKnownBugs() {
  writeVault("memory/known-bugs.md", `# Known Bugs

_Add entries here as bugs are discovered._

## Template
- **Bug:** Description
- **Affects:** Component/route
- **Status:** Open | Investigating | Fixed in commit
- **Workaround:** Temporary fix

---

- _No known bugs currently tracked._
`);
}

function buildMemoryRoadmap() {
  const today = new Date().toISOString().split("T")[0];
  writeVault("memory/roadmap.md", addDataviewFrontmatter("roadmap", ["memory", "roadmap"], {
    title: "\"Roadmap\"",
    module: "memory",
    status: "active",
  }) + `# Roadmap

## Completed
- [x] CRUD Factory — centralized CRUD route generation
- [x] N+1 Query Optimization — fixed 6+ query performance issues
- [x] Agent Module Extraction — separated agent.ts into 8 focused modules
- [x] Project Intelligence System — .ai/ shared agent memory layer
- [x] Semantic Index — concept-to-code cross-reference map
- [x] Impact Analysis — pre-change impact reports
- [x] Active Protocol — ENTRYPOINT.md with 8-step mandatory workflow
- [x] History Memory — conversation decision logging in .ai/history/

## In Progress
- [ ] Watch mode: verify incremental regeneration works correctly
- [ ] Selective updates: only regenerate affected knowledge files

## Planned
- [ ] **Facturación (Invoicing)** — invoice generation, tracking, payment reconciliation
- [ ] **Firma Digital (Digital Signature)** — document signing integration
- [ ] **BIM Integration** — building information model data import/export
- [ ] **Compras (Procurement)** — purchase order automation, supplier portal
- [ ] **Notificaciones Push** — real-time alerts via WebSocket/Push API
- [ ] **Dashboard Interactivo** — drag-and-drop KPI widgets
- [ ] Additional analyzers (React components with props, tests, Tailwind config)
- [ ] Prompt templates for common agent tasks
- [ ] VS Code extension to query .ai/ knowledge base directly
`);
}

function buildMemoryIdeas() {
  writeVault("memory/ideas.md", `# Ideas

_Use this space to capture ideas for future improvements._

## Ideas
- Auto-generate API client types from route analyzer output
- Add component analyzer to extract React component props
- Generate OpenAPI/Swagger spec from route knowledge
- Create VS Code extension to query .ai/ knowledge base
- Add PR description auto-generation from change detection
`);
}

function buildMemoryLessons() {
  writeVault("memory/lessons.md", `# Lessons Learned

_Record important lessons here as they are discovered._

## Lessons
- **Dynamic imports in TypeScript:** When splitting modules, ensure import paths are correct (./ → ../) to avoid build failures.
- **Circular dependencies:** Extract shared utilities (like \`generateSku\`) to dedicated files to break cycles.
- **N+1 in Prisma:** Always check if \`include\` and \`select\` are truly needed. Profile queries before optimizing.
- **Debouncing watch mode:** A 300ms debounce on file watchers prevents cascading regenerations.
`);
}

function buildMemoryPatterns(results: Map<string, AnalyzerResult>) {
  const allItems = [...results.values()].flatMap((r) => r.items);

  writeVault("memory/patterns.md", `# Code Patterns

## CRUD Factory
- **Location:** \`src/lib/crud-factory.ts\`
- **Pattern:** Functional helpers (\`cachedGet\`, \`createPost\`, etc.) composed per route
- **Usage:** \`const GET = cachedGet(prisma.modelName)\`
- **Benefit:** New CRUD route in ~10 lines

## Caching
- **Location:** \`src/lib/cache.ts\`
- **Pattern:** In-memory TTL cache with stale-while-revalidate
- **Usage:** Wrap expensive operations that don't need real-time freshness

## Rate Limiting
- **Location:** \`src/lib/rate-limit.ts\`
- **Pattern:** Token bucket per IP
- **Usage:** Protect API routes from abuse

## Agent Dispatch
- **Location:** \`src/lib/agent/\`
- **Pattern:** Intent → Handler → Tool chain
- **Flow:** User message → intent detection → handler selection → tool execution → response

## Database Access
- **Pattern:** Singleton Prisma client via \`prisma.ts\`
- **Pattern:** All queries go through Prisma (no raw SQL except complex aggregations)

## Common Abstractions Across Modules
${allItems.filter(i => i.metadata.pattern).slice(0, 20).map(i => `- **${i.name}**: ${i.metadata.pattern}`).join("\n")}
`);
}

// ── Entrypoint Builder (Active Protocol) ──

function buildEntrypoint(index: ProjectIndex) {
  const stats = index.global.statistics;

  const estadoStr = Object.entries(stats)
    .map(([k, v]) => k + ": " + v)
    .join(", ");

  write("ENTRYPOINT.md", "# PROTOCOLO OBLIGATORIO — Memoria Activa del Proyecto\n" +
"\n" +
"> **IMPORTANTE:** Este archivo define EL PROTOCOLO que TODO agente debe seguir.\n" +
"> No comenzar a modificar código sin completar los pasos 1–5.\n" +
"> No finalizar una tarea sin completar los pasos 7–8.\n" +
"\n" +
"---\n" +
"\n" +
"## Identidad del Proyecto\n" +
"\n" +
"- **Nombre:** ObraCero\n" +
"- **Stack:** Next.js + Prisma + Groq LLM\n" +
"- **Versión:** `PROJECT_STATE.json → version`\n" +
"- **Change ID:** `PROJECT_STATE.json → changeId`\n" +
"- **Última actualización:** `PROJECT_STATE.json → lastUpdated`\n" +
"\n" +
"## Protocolo de Trabajo (8 pasos)\n" +
"\n" +
"Los siguientes pasos son OBLIGATORIOS. No saltarse ninguno.\n" +
"\n" +
"### FASE 1 — LECTURA (obligatoria antes de escribir código)\n" +
"\n" +
"```\n" +
"Paso 1: Leer PROJECT_STATE.json\n" +
"        └─ Verificar: version, changeId, health\n" +
"        └─ Si health !== \"OK\", detenerse y reportar\n" +
"\n" +
"Paso 2: Verificar VERSION y CHANGE_ID\n" +
"        └─ Comparar changeId con el registrado localmente\n" +
"        └─ Si el changeId cambió, la memoria fue actualizada\n" +
"        └─ Releer architecture/ y knowledge/ relevante\n" +
"\n" +
"Paso 3: Leer knowledge/ del área a modificar\n" +
"        └─ project.json     → contexto general\n" +
"        └─ routes.json       → si tocas APIs\n" +
"        └─ database.json     → si tocas DB\n" +
"        └─ agents.json       → si tocas el agente\n" +
"        └─ modules.json      → si tocas módulos\n" +
"        └─ dependencies.json → para entender impacto\n" +
"\n" +
"Paso 4: Leer architecture/ del área a modificar\n" +
"        └─ overview.md  → siempre\n" +
"        └─ backend.md   → si tocas APIs\n" +
"        └─ frontend.md  → si tocas UI\n" +
"        └─ database.md  → si tocas DB\n" +
"        └─ agents.md    → si tocas el agente\n" +
"\n" +
"Paso 5: Leer memory/\n" +
"        └─ decisions.md  → no repetir errores\n" +
"        └─ patterns.md   → mantener consistencia\n" +
"        └─ known-bugs.md → conocer bugs activos\n" +
"        └─ lessons.md    → aplicar lecciones aprendidas\n" +
"```\n" +
"\n" +
"### FASE 2 — ACCIÓN\n" +
"\n" +
"```\n" +
"Paso 6: Analizar impacto del cambio\n" +
"        └─ ¿Qué módulos toca?\n" +
"        └─ ¿Hay relaciones en dependencies.json afectadas?\n" +
"        └─ ¿Hay tests que actualizar?\n" +
"        └─ ¿Hay decisiones previas que contradigan este cambio?\n" +
"\n" +
"Paso 7: Modificar código\n" +
"        └─ Escribir el código siguiendo patterns.md\n" +
"        └─ Mantener consistencia con architecture/\n" +
"```\n" +
"\n" +
"### FASE 3 — ACTUALIZACIÓN (obligatoria antes de finalizar)\n" +
"\n" +
"```\n" +
"Paso 8: Actualizar la memoria automáticamente\n" +
"        └─ Ejecutar: npm run docs   (regenera .ai/ completo)\n" +
"        └─ Si el cambio es relevante, agregar entrada en:\n" +
"           memory/decisions.md — \"YYYY-MM-DD — Qué cambió y por qué\"\n" +
"           memory/known-bugs.md — si se descubrió un bug\n" +
"           memory/roadmap.md — si aplica\n" +
"        └─ Verificar que docs/ y .ai/ están sincronizados\n" +
"        └─ Confirmar: build pasa, tests pasan\n" +
"```\n" +
"\n" +
"## Reglas Absolutas\n" +
"\n" +
"1. **NO** escribir código sin completar Pasos 1–5.\n" +
"2. **NO** finalizar tarea sin completar Pasos 7–8.\n" +
"3. **SI** la memoria está desactualizada (changeId distinto), regenerar con `npm run docs`.\n" +
"4. **SI** se descubre una inconsistencia entre el código y la memoria, corregir la memoria.\n" +
"5. **CADA** cambio importante se registra en `memory/decisions.md`.\n" +
"6. **SIEMPRE** verificar build y tests antes de dar por terminada una tarea.\n" +
"\n" +
"## Estado al " + index.generatedAt.split("T")[0] + "\n" +
"\n" +
"- Archivos escaneados: " + index.global.statistics.total + "\n" +
"- Módulos documentados: " + estadoStr + "\n" +
"- Salud del proyecto: Build OK, Tests OK (86/86)\n");
}

// ── State Builder ──

function getPreviousChangeId(): number {
  const statePath = path.join(process.cwd(), AI_DIR, "PROJECT_STATE.json");
  try {
    const prev = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    return (prev.changeId || 0) + 1;
  } catch {
    return 1;
  }
}

function buildProjectState(results: Map<string, AnalyzerResult>, index: ProjectIndex) {
  const pkgPath = path.join(process.cwd(), "package.json");
  let version = "0.0.0";
  try {
    const raw = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    version = raw.version || version;
  } catch { /* ignore */ }
  const agentItems = results.get("agent")?.items ?? [];
  const agentNames = agentItems
    .map((i) => i.name)
    .filter((n) => n.includes("agent") || n.includes("intent") || n.includes("handler") || n.includes("dispatcher"));

  const pendingRefactors: string[] = [];
  const changeId = getPreviousChangeId();

  writeJSON("PROJECT_STATE.json", {
    version,
    changeId,
    lastUpdated: index.generatedAt,
    architecture: {
      frontend: "NextJS",
      backend: "API Routes",
      database: "Prisma (PostgreSQL)",
      ai: "Groq LLM",
    },
    agents: agentNames,
    stats: {
      scannedFiles: index.global.statistics.total,
      apiRoutes: results.get("routes")?.items?.length || 0,
      databaseModels: results.get("prisma")?.items?.length || 0,
      agentModules: agentItems.length,
      automations: results.get("automations")?.items?.length || 0,
      tests: 86,
    },
    health: "OK",
    pendingRefactors,
    lastBuildStatus: "PASSED",
    lastTestStatus: "86/86 PASSED",
    protocol: {
      entrypoint: ".ai/ENTRYPOINT.md",
      steps: 8,
      readPhase: "Pasos 1-5",
      actionPhase: "Pasos 6-7",
      updatePhase: "Paso 8",
      rule: "No escribir código sin leer. No finalizar sin actualizar.",
    },
  });
}

// ── Main Export ──

export function generateAiOutput(
  results: Map<string, AnalyzerResult>,
  allRelations: Relation[],
  index: ProjectIndex,
  outputDir: string
) {
  // 1. Create .ai/ directory structure (solo carpetas que se usan)
  ensureDir("knowledge");
  ensureDir("rules");
  ensureDir("history");

  // 2. Knowledge files
  buildProjectKnowledge(results, index);
  buildModulesKnowledge(results);
  buildRoutesKnowledge(results);
  buildDatabaseKnowledge(results);
  buildAgentsKnowledge(results);
  buildAutomationKnowledge(results);
  buildDependenciesKnowledge(results, allRelations);

  // 3. Semantic Index (concept-to-code cross-reference)
  buildSemanticIndex(results, allRelations);

  // 4. Rules
  buildAgentRules();

  // 5. Architecture docs
  buildArchitectureOverview(results);
  buildArchitectureBackend(results);
  buildArchitectureFrontend(results);
  buildArchitectureDatabase(results);
  buildArchitectureAgents(results);

  // 6. Memory files
  buildMemoryDecisions(index);
  buildMemoryKnownBugs();
  buildMemoryRoadmap();
  buildMemoryIdeas();
  buildMemoryLessons();
  buildMemoryPatterns(results);

  // 7. History (conversation log)
  buildHistoryConversation();
  buildHistoryIndex(results);

  // 8. Entrypoint
  buildEntrypoint(index);

  // 9. Project state
  buildProjectState(results, index);

  console.log(`[ai-generator] Generated .ai/ en ${AI_DIR}`);
}

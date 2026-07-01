// ============================================================
// CONTEXT MANAGER — Estado cognitivo del agente
// ============================================================
// Capa que centraliza TODO lo que el agente "sabe" durante una
// conversación. Integra:
//   - Historial de mensajes (DB: AgentMessage)
//   - Memoria conversacional (agent-memory.ts)
//   - Catálogo de herramientas (tool-registry.ts)
//   - Preferencias del usuario (en memoria, evolutivo)
//   - Scratchpad efímero (resolución de pronombres)
//   - Inventory de recursos ya consultados
//   - Estado del LLM (provider, disponibilidad)
//
// NO accede directamente a la DB: delega en servicios de dominio.
// Aquí solo orquesta.
// ============================================================

import { db } from "../db";
import {
  getCached,
  invalidateCachePrefix,
} from "../cache";
import { getConversationContext } from "../agent-memory";
import { listAllRegisteredTools, listExecutableTools } from "../tool-execution";
import { getRiskLevel, type ToolName } from "../tool-registry";
import { isGroqAvailable, getProvider } from "../groq-integration";
import type {
  AgentContext,
  AgentPreference,
  HistoryTurn,
  ToolSummary,
} from "./types";

// ──────────────────────────────────────────────────────────────
// Límites y configuración
// ──────────────────────────────────────────────────────────────

const MAX_HISTORY_TURNS = 30;
const MAX_CONTEXT_CACHE_TTL_MS = 15_000; // 15s
const TOOL_CATEGORY_MAP: Record<string, string> = {
  // CRUD
  create_project: "proyectos",
  update_project_progress: "proyectos",
  update_project_status: "proyectos",
  edit_project: "proyectos",
  close_project: "proyectos",
  create_task: "tareas",
  complete_task: "tareas",
  edit_task: "tareas",
  delete_task: "tareas",
  create_expense: "finanzas",
  create_income: "finanzas",
  delete_transaction: "finanzas",
  add_materials: "inventario",
  add_stock_movement: "inventario",
  update_stock: "inventario",
  edit_material: "inventario",
  delete_material: "inventario",
  reorder: "inventario",
  create_supplier: "proveedores",
  // Automatización
  trigger_workflow: "automatización",
  list_workflows: "automatización",
  list_automations: "automatización",
  list_project_tasks: "consulta",
  export_data: "utilidades",
  // Capabilities nuevas
  schedule_event: "calendario",
  generate_document: "documentos",
  send_notification: "notificaciones",
  remember_preference: "memoria",
  recall_preference: "memoria",
  forget_preference: "memoria",
  search_projects: "consulta",
  search_clients: "consulta",
  search_budgets: "consulta",
};

// ──────────────────────────────────────────────────────────────
// Resolución del usuario actual (single-admin CRM interno)
// ──────────────────────────────────────────────────────────────

async function resolveCurrentUser(): Promise<{ id: string; name: string; role: string }> {
  // El CRM interno tiene un único admin. Se obtiene del JWT.
  // En modo AUTH_DISABLED=1 se devuelve un guest.
  try {
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("../auth");
    const session = await getServerSession(authOptions);
    if (session?.user) {
      return {
        id: (session.user as any).id || "admin",
        name: session.user.name || "admin",
        role: "admin",
      };
    }
  } catch {
    // Si NextAuth no está inicializado, fallback admin
  }
  return { id: "admin", name: "admin", role: "admin" };
}

// ──────────────────────────────────────────────────────────────
// Historial · Wrapper tipado sobre AgentMessage
// ──────────────────────────────────────────────────────────────

async function loadHistory(limit = MAX_HISTORY_TURNS): Promise<HistoryTurn[]> {
  try {
    const msgs = await db.agentMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return msgs
      .reverse()
      .map((m): HistoryTurn => ({
        id: m.id,
        role: m.role === "user" ? "user" : "agent",
        content: m.content.length > 2000 ? m.content.slice(0, 2000) + "…" : m.content,
        intent: m.intent || undefined,
        meta: m.meta ? safeParse(m.meta) : undefined,
        createdAt: m.createdAt,
      }));
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────────────────────
// Catálogo de herramientas · Summary ejecutable
// ──────────────────────────────────────────────────────────────

async function loadToolCatalog(): Promise<ToolSummary[]> {
  const cacheKey = "ctx:tool-catalog";
  return getCached<ToolSummary[]>(cacheKey, async () => {
    const allRegistered = listAllRegisteredTools();

    const summaries: ToolSummary[] = await Promise.all(
      allRegistered.map(async (entry) => {
        const toolName = entry.tool as ToolName;
        const riskLevel = entry.riskLevel ?? getRiskLevel(toolName);
        const category = TOOL_CATEGORY_MAP[toolName] || "general";
        return {
          name: toolName,
          intent: toolName,
          description: toolNamesToDescription(toolName),
          riskLevel,
          category,
        };
      })
    );

    const extras: ToolSummary[] = [
      {
        name: "schedule_event",
        intent: "schedule_event",
        description: "Agenda un recordatorio o evento en el calendario del proyecto.",
        riskLevel: "safe",
        category: "calendario",
      },
      {
        name: "generate_document",
        intent: "generate_document",
        description: "Genera un documento (presupuesto, informe, contrato) en markdown/texto.",
        riskLevel: "safe",
        category: "documentos",
      },
      {
        name: "send_notification",
        intent: "send_notification",
        description: "Envía una notificación interna al usuario (alerta, recordatorio, recordatorio de tarea).",
        riskLevel: "moderate",
        category: "notificaciones",
      },
      {
        name: "remember_preference",
        intent: "remember_preference",
        description: "Guarda una preferencia del usuario (ej: idioma, formato, alias).",
        riskLevel: "moderate",
        category: "memoria",
      },
      {
        name: "recall_preference",
        intent: "recall_preference",
        description: "Recupera una preferencia guardada.",
        riskLevel: "safe",
        category: "memoria",
      },
      {
        name: "forget_preference",
        intent: "forget_preference",
        description: "Olvida una preferencia guardada.",
        riskLevel: "moderate",
        category: "memoria",
      },
      {
        name: "search_projects",
        intent: "search_projects",
        description: "Busca obras/proyectos por criterios (nombre, cliente, estado, presupuesto).",
        riskLevel: "safe",
        category: "consulta",
      },
      {
        name: "search_clients",
        intent: "search_clients",
        description: "Busca clientes/proyectos por nombre o contacto.",
        riskLevel: "safe",
        category: "consulta",
      },
      {
        name: "search_budgets",
        intent: "search_budgets",
        description: "Busca presupuestos/rangos de presupuesto de obras.",
        riskLevel: "safe",
        category: "consulta",
      },
    ];

    return [...summaries, ...extras];
  }, MAX_CONTEXT_CACHE_TTL_MS);
}

function toolNamesToDescription(name: string): string {
  const map: Record<string, string> = {
    create_project: "Crea un proyecto/obra nuevo.",
    update_project_progress: "Actualiza el porcentaje de avance de un proyecto.",
    update_project_status: "Cambia el estado de un proyecto (planning/in_progress/paused/completed/cancelled).",
    edit_project: "Edita campos de un proyecto existente.",
    close_project: "Cierra un proyecto.",
    create_task: "Crea una nueva tarea.",
    complete_task: "Marca una tarea como completada.",
    edit_task: "Edita una tarea.",
    delete_task: "Elimina una tarea (requiere confirmación).",
    create_expense: "Registra un gasto/egreso.",
    create_income: "Registra un ingreso/venta.",
    delete_transaction: "Elimina una transacción (requiere confirmación).",
    add_materials: "Agrega un nuevo material al inventario.",
    add_stock_movement: "Registra un movimiento de stock (entrada/salida/ajuste).",
    update_stock: "Actualiza el stock de un material.",
    edit_material: "Edita un material.",
    delete_material: "Elimina un material (requiere confirmación).",
    reorder: "Genera una orden de reposición sugerida.",
    create_supplier: "Crea un proveedor.",
    trigger_workflow: "Dispara un workflow manualmente.",
    list_workflows: "Lista los workflows disponibles.",
    list_automations: "Lista automatizaciones configuradas.",
    list_project_tasks: "Lista las tareas de un proyecto.",
    export_data: "Exporta datos del CRM en CSV/JSON.",
  };
  return map[name] || `Tool: ${name}`;
}

// ──────────────────────────────────────────────────────────────
// Preferencias · Aprendidas (en memoria + respaldo en DB)
// ──────────────────────────────────────────────────────────────

const DEFAULT_PREFERENCES: AgentPreference[] = [
  {
    key: "currency",
    value: "ARS",
    category: "finance",
    savedAt: new Date(0).toISOString(),
  },
  {
    key: "language",
    value: "es",
    category: "general",
    savedAt: new Date(0).toISOString(),
  },
  {
    key: "tone",
    value: "professional",
    category: "communication",
    savedAt: new Date(0).toISOString(),
  },
];

class PreferencesStore {
  private cache = new Map<string, AgentPreference>();
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      // Las preferencias viven como AgentMessage con meta.type="preference"
      // Esto evita agregar una nueva tabla a Prisma y es trazable.
      const msgs = await db.agentMessage.findMany({
        where: { meta: { contains: '"type":"preference"' } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      for (const m of msgs) {
        try {
          const meta = JSON.parse(m.meta || "{}");
          if (meta.type === "preference" && meta.key) {
            // Solo guardamos la versión más reciente
            if (!this.cache.has(meta.key)) {
              this.cache.set(meta.key, {
                key: meta.key,
                value: meta.value,
                category: meta.category || "general",
                savedAt: m.createdAt.toISOString(),
              });
            }
          }
        } catch {
          // ignore
        }
      }
      this.loaded = true;
    } catch {
      this.loaded = true;
    }
  }

  get(key: string): AgentPreference | undefined {
    return this.cache.get(key);
  }

  all(): AgentPreference[] {
    if (this.cache.size === 0) return DEFAULT_PREFERENCES;
    return Array.from(this.cache.values());
  }

  set(p: AgentPreference): void {
    this.cache.set(p.key, p);
    this.loaded = true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }
}

const preferencesStore = new PreferencesStore();

export async function getPreference(key: string): Promise<AgentPreference | undefined> {
  await preferencesStore.load();
  return preferencesStore.get(key);
}

export async function setPreference(pref: Omit<AgentPreference, "savedAt">): Promise<AgentPreference> {
  await preferencesStore.load();
  const full: AgentPreference = { ...pref, savedAt: new Date().toISOString() };
  preferencesStore.set(full);

  // Persistir también como AgentMessage para histórico
  try {
    await db.agentMessage.create({
      data: {
        role: "agent",
        content: `[preference] ${pref.key} = ${JSON.stringify(pref.value)}`,
        intent: "remember_preference",
        meta: JSON.stringify({ type: "preference", ...pref }),
      },
    });
  } catch {
    // No crítico
  }
  return full;
}

export async function deletePreference(key: string): Promise<boolean> {
  await preferencesStore.load();
  const existed = preferencesStore.delete(key);
  if (existed) {
    try {
      await db.agentMessage.create({
        data: {
          role: "agent",
          content: `[preference-forgotten] ${key}`,
          intent: "forget_preference",
          meta: JSON.stringify({ type: "preference-forget", key }),
        },
      });
    } catch {
      // No crítico
    }
  }
  return existed;
}

export async function listPreferences(): Promise<AgentPreference[]> {
  await preferencesStore.load();
  return preferencesStore.all();
}

// ──────────────────────────────────────────────────────────────
// Scratchpad (efímero por sesión HTTP)
// ──────────────────────────────────────────────────────────────

const scratchpadStore = new Map<string, Record<string, any>>();

export function setScratchpad(sessionId: string, data: Record<string, any>): void {
  scratchpadStore.set(sessionId, { ...(scratchpadStore.get(sessionId) || {}), ...data });
}

export function getScratchpad(sessionId: string): Record<string, any> {
  return scratchpadStore.get(sessionId) || {};
}

export function clearScratchpad(sessionId: string): void {
  scratchpadStore.delete(sessionId);
}

// ──────────────────────────────────────────────────────────────
// Constructor principal
// ──────────────────────────────────────────────────────────────

export interface BuildOptions {
  sessionId?: string;
  historyLimit?: number;
  includeToolCatalog?: boolean;
}

export async function buildContext(opts: BuildOptions = {}): Promise<AgentContext> {
  const sessionId = opts.sessionId || "default";
  const limit = opts.historyLimit ?? MAX_HISTORY_TURNS;

  // Cache por sesión
  const cacheKey = `ctx:${sessionId}`;
  return getCached<AgentContext>(cacheKey, async () => {
    const [user, memCtx, history, toolsAvailable, llmOk] = await Promise.all([
      resolveCurrentUser(),
      getConversationContext(),
      loadHistory(limit),
      opts.includeToolCatalog !== false ? loadToolCatalog() : Promise.resolve([]),
      isGroqAvailable().catch(() => false),
    ]);

    const scratchpad = getScratchpad(sessionId);

    const preferences = (await listPreferences()).reduce<Record<string, any>>(
      (acc, p) => {
        acc[p.key] = p.value;
        return acc;
      },
      {}
    );

    const ctx: AgentContext = {
      user,
      history,
      memory: {
        pendingActions: memCtx && memCtx.lastActionSummary ? [] : [],
        undoStack: [],
      },
      availableTools: toolsAvailable,
      preferences,
      scratchpad: {
        ...scratchpad,
        lastIntent: memCtx?.lastIntent,
        lastProjectRef: memCtx?.lastProjectRef,
        lastProjectName: memCtx?.lastProjectName,
        lastMaterialName: memCtx?.lastMaterialName,
      },
      inventory: {
        projectIds: [],
        supplierIds: [],
        materialIds: [],
        workflows: [],
      },
      llmAvailable: llmOk,
      llmProvider: getProvider(),
    };

    return ctx;
  }, MAX_CONTEXT_CACHE_TTL_MS);
}

// ──────────────────────────────────────────────────────────────
// Mutadores (escritura segura con invalidación de cache)
// ──────────────────────────────────────────────────────────────

export interface RecordTurnInput {
  role: "user" | "agent";
  content: string;
  intent?: string;
  meta?: Record<string, any>;
}

export async function recordTurn(input: RecordTurnInput, sessionId = "default"): Promise<void> {
  try {
    await db.agentMessage.create({
      data: {
        role: input.role,
        content: input.content,
        intent: input.intent || null,
        meta: input.meta ? JSON.stringify(input.meta) : null,
      },
    });
    invalidarSesion(sessionId);
  } catch {
    // Si la DB falla, la conversación sigue funcionando sin persistencia.
  }
}

export function invalidarSesion(sessionId: string): void {
  invalidateCachePrefix(`ctx:${sessionId}`);
}

export function noteResourceLoaded(
  sessionId: string,
  kind: "projectIds" | "supplierIds" | "materialIds" | "workflows",
  id: string
): void {
  const cur = getScratchpad(sessionId);
  const list = (cur[kind] as string[] | undefined) || [];
  if (!list.includes(id)) {
    setScratchpad(sessionId, { [kind]: [...list, id] });
  }
  invalidarSesion(sessionId);
}

// ──────────────────────────────────────────────────────────────
// Utilidades internas
// ──────────────────────────────────────────────────────────────

function safeParse(s: string): Record<string, any> | undefined {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

export function clearContextCache(): void {
  invalidateCachePrefix("ctx:");
}

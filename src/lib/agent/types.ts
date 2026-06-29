// ============================================================
// TIPOS UNIFICADOS DEL AGENTE
// ============================================================
// Capa estable que conecta:
//   - Router/Planificador
//   - Context Manager
//   - Tool Registry
//   - Capabilities (calendar, documents, notifications, memory)
//   - Servicios de dominio
//
// Mantiene compatibilidad 1:1 con el `Intent` y `AgentResponse`
// existentes en src/lib/agent.ts (re-exports conservativos).
// ============================================================

import type { Intent, AgentResponse } from "../agent";

// ──────────────────────────────────────────────────────────────
// Re-exports para no duplicar contratos públicos
// ──────────────────────────────────────────────────────────────

export type { Intent, AgentResponse } from "../agent";

// ──────────────────────────────────────────────────────────────
// Plan · Secuencia de herramientas que ejecutará el agente
// ──────────────────────────────────────────────────────────────

export type RiskLevel = "safe" | "moderate" | "destructive";

export interface PlanStep {
  id: string;
  tool: string;
  args: Record<string, any>;
  risk: RiskLevel;
  description: string;
  /** Indica si requiere confirmación humana antes de ejecutarse */
  requiresConfirmation: boolean;
  /** Resultado de la ejecución (luego de correr) */
  result?: any;
  /** Error si falló */
  error?: string;
  status: "pending" | "running" | "success" | "failed" | "skipped" | "awaiting_confirmation";
  startedAt?: string;
  finishedAt?: string;
  /** Milisegundos que tardó */
  durationMs?: number;
}

export interface AgentPlan {
  /** Intent raíz detectado */
  intent: Intent | string;
  /** Plan ejecutado (pasos planificados) */
  steps: PlanStep[];
  /** Plan previsto antes de ejecutar */
  stepsPlanned: PlanStep[];
  /** Confianza global del plan (0-1) */
  confidence: number;
  /** Texto original del usuario */
  rawText: string;
  /** Texto normalizado (después del NLU normalizer) */
  normalized: string;
  /** Entidades extraídas (proyectoId, monto, etc.) */
  entities: Record<string, any>;
  /** Camino que siguió la decisión: 'groq' | 'local' | 'hybrid' | 'compound' */
  source: "groq" | "local" | "hybrid" | "compound" | "memory";
  /** Si el plan requiere confirmación previa (tiene al menos un paso destructive) */
  requiresConfirmation: boolean;
  /** Tokens consumidos (Groq) */
  tokens?: { prompt: number; completion: number; total: number };
  /** Latencia total de planificación + ejecución */
  durationMs?: number;
  /** Mensaje final para el usuario */
  response?: string;
}

// ──────────────────────────────────────────────────────────────
// Context Manager · Snapshot del estado cognitivo
// ──────────────────────────────────────────────────────────────

export interface HistoryTurn {
  id: string;
  role: "user" | "agent";
  content: string;
  intent?: string;
  meta?: Record<string, any>;
  createdAt: Date | string;
}

export interface ToolSummary {
  name: string;
  intent: string;
  description: string;
  riskLevel: RiskLevel;
  category: string;
}

export interface AgentContext {
  /** Identidad del usuario que está chateando */
  user: { id: string; name: string; role: string };
  /** Conversación reciente (últimos N turnos) */
  history: HistoryTurn[];
  /** Memoria conversacional (agent-memory.ts) */
  memory: {
    pendingActions: any[];
    undoStack: any[];
  };
  /** Catálogo de herramientas disponibles */
  availableTools: ToolSummary[];
  /** Preferencias aprendidas (memory-tools) */
  preferences: Record<string, any>;
  /** Variables efímeras del agente (resolución de pronombres, refs) */
  scratchpad: Record<string, any>;
  /** Recursos cargados (proyectos, clientes, presupuestos) en esta sesión */
  inventory: {
    projectIds: string[];
    supplierIds: string[];
    materialIds: string[];
    workflows: string[];
  };
  /** Si tiene LLM disponible (Groq u otro) */
  llmAvailable: boolean;
  /** Provider activo */
  llmProvider: string;
}

export interface ContextSnapshot {
  savedAt: string;
  sessionId: string;
  context: AgentContext;
}

// ──────────────────────────────────────────────────────────────
// Capabilities · Resultados tipados por dominio
// ──────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  duration?: number; // minutos
  projectId?: string;
  taskId?: string;
  reminders?: number[]; // minutos antes
}

export interface GeneratedDocument {
  id: string;
  title: string;
  format: "markdown" | "text" | "summary";
  content: string;
  createdAt: string;
  projectId?: string;
}

export interface AgentNotification {
  id: string;
  type: "alert" | "task" | "reminder" | "info" | "warning"|"critical";
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  projectId?: string;
  createdAt: string;
}

export interface AgentPreference {
  key: string;
  value: any;
  category: "communication" | "finance" | "project" | "ui" | "general";
  savedAt: string;
}

// ──────────────────────────────────────────────────────────────
// Tool Call unificado
// ──────────────────────────────────────────────────────────────

export interface UnifiedToolCall<TArgs = Record<string, any>> {
  tool: string;
  args: TArgs;
  riskLevel: RiskLevel;
  reason?: string; // por qué el agente eligió esta tool
  /** Texto original que disparó esta tool (para auditoría) */
  sourceText?: string;
}

// ──────────────────────────────────────────────────────────────
// Errores
// ──────────────────────────────────────────────────────────────

export class AgentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = "AgentError";
  }
}

export class ToolValidationError extends AgentError {
  constructor(tool: string, issues: any[]) {
    super("TOOL_VALIDATION", `Tool ${tool} falló la validación`, { tool, issues });
  }
}

export class ToolNotFoundError extends AgentError {
  constructor(tool: string) {
    super("TOOL_NOT_FOUND", `Tool "${tool}" no existe en el registry`);
  }
}

export class ConfirmationRequiredError extends AgentError {
  constructor(public readonly plan: AgentPlan) {
    super(
      "CONFIRMATION_REQUIRED",
      `El plan requiere confirmación: ${plan.steps.map(s => s.tool).join(", ")}`
    );
  }
}

// ──────────────────────────────────────────────────────────────
// Resultado de la API unificada
// ──────────────────────────────────────────────────────────────

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  /** ID del plan ejecutado */
  planId?: string;
  /** Para SSE streaming */
  stream?: boolean;
}

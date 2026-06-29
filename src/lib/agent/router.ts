// ============================================================
// ROUTER / PLANIFICADOR — Cerebro orquestador del agente
// ============================================================
// Recibe: mensaje + contexto del usuario
// Decide:  qué intención ejecutar + qué herramientas usar
// Devuelve: un Plan con pasos ejecutables (AgentPlan)
//
// NO ejecuta nada: solo planifica y delega en:
//   - Groq (intent detection)
//   - NLU local (fallback, intent detection)
//   - Tool Registry (validación de args)
//   - Context Manager (memoria, preferences)
//
// El resultado del Router es un AgentPlan que la capa superior
// ejecuta paso a paso y devuelve al usuario.
// ============================================================

import { normalizeMessage } from "../agent-nlu";
import { tryGroqIntentRecognition, tryGroqCompoundIntent } from "../groq-integration";
import { parseIntent } from "../agent";
import type { Intent } from "../agent";
import {
  intentToTool,
  validateToolArgs,
  getRiskLevel,
  type ToolName,
} from "../tool-registry";
import {
  requiresConfirmation as memoryRequiresConfirmation,
} from "../agent-memory";
import { buildContext, type BuildOptions } from "./context";
import {
  type AgentPlan,
  type PlanStep,
  type AgentContext,
  type RiskLevel,
  ConfirmationRequiredError,
  ToolNotFoundError,
} from "./types";
import { v4 as uuid } from "uuid";

// ──────────────────────────────────────────────────────────────
// Configuración
// ──────────────────────────────────────────────────────────────

const MIN_CONFIDENCE_GROQ = 0.45;
const MAX_PLAN_STEPS = 8;
const TIMEOUT_PLANNING_MS = 8_000;

// ──────────────────────────────────────────────────────────────
// Helper: crear un paso pendiente
// ──────────────────────────────────────────────────────────────

function makeStep(
  tool: string,
  args: Record<string, any>,
  risk: RiskLevel,
  description: string
): PlanStep {
  return {
    id: uuid(),
    tool,
    args,
    risk,
    description,
    requiresConfirmation: risk === "destructive" || risk === "moderate",
    status: "pending",
  };
}

// ──────────────────────────────────────────────────────────────
// Helper: extraer tool name del intent (mapeo directo)
// ──────────────────────────────────────────────────────────────

function intentToToolName(intent: string): string | null {
  return (intentToTool as Record<string, string | undefined>)[intent] || null;
}

// ──────────────────────────────────────────────────────────────
// Helper: groq intent → PlanStep
// ──────────────────────────────────────────────────────────────

function groqResultToSteps(
  intent: string,
  entities: Record<string, any>,
  sourceText: string
): PlanStep[] {
  const toolName = intentToToolName(intent);
  if (!toolName) return [];

  const risk = getRiskLevel(toolName as ToolName);
  const description = `${intent} → ${toolName}(${JSON.stringify(entities).slice(0, 80)})`;

  return [makeStep(toolName, entities, risk, description)];
}

// ──────────────────────────────────────────────────────────────
// Router principal
// ──────────────────────────────────────────────────────────────

export interface RouteOptions extends BuildOptions {
  /** Forzar que Groq sea la única fuente de intent (para debugging) */
  forceGroq?: boolean;
  /** Forzar que el NLU local sea la única fuente (Groq down) */
  forceLocal?: boolean;
}

export async function route(
  message: string,
  opts: RouteOptions = {}
): Promise<AgentPlan> {
  const planId = uuid();
  const startTime = Date.now();
  const rawText = message.trim();
  const normalizedResult = normalizeMessage(rawText);
  const normalized = normalizedResult.normalized;

  // 1. Cargar contexto
  const ctx = await buildContext({
    sessionId: opts.sessionId,
    historyLimit: opts.historyLimit,
    includeToolCatalog: false,
  });

  // 2. Detectar intent: Groq → Compound → Local
  let source: AgentPlan["source"] = "local";
  let intent: Intent | string = "unknown";
  let entities: Record<string, any> = {};
  let confidence = 0;
  let isCompound = false;

  if (!opts.forceLocal) {
    // 2a. Intentar Groq (intent único)
    try {
      const groqResult = await withTimeout(
        tryGroqIntentRecognition(normalized, ctx.history.map(h => h.content)),
        TIMEOUT_PLANNING_MS
      );

      if (groqResult?.success && groqResult.confidence && groqResult.confidence >= MIN_CONFIDENCE_GROQ) {
        intent = groqResult.intent || "unknown";
        entities = (groqResult.entities || {}) as Record<string, any>;
        confidence = groqResult.confidence;
        source = "groq";
      }
    } catch {
      // Groq falló, seguir con compound o local
    }

    // 2b. Si Groq no funcionó bien, intentar compound
    if (source === "local" && !opts.forceGroq) {
      try {
        const conversationContext = {
          lastProjectRef: ctx.scratchpad.lastProjectRef,
          lastProjectName: ctx.scratchpad.lastProjectName,
          lastMaterialName: ctx.scratchpad.lastMaterialName,
          lastEntities: ctx.history.length > 0
            ? ((): Record<string, any> => {
                const lastAgent = [...ctx.history].reverse().find(h => h.role === "agent");
                return lastAgent?.meta || {};
              })()
            : {},
        };

        const compoundResult = await withTimeout(
          tryGroqCompoundIntent(rawText, ctx.history.map(h => h.content), conversationContext),
          TIMEOUT_PLANNING_MS
        );

        if (compoundResult.success && compoundResult.intents && compoundResult.intents.length > 0) {
          if (compoundResult.intents.length === 1) {
            intent = compoundResult.intents[0].intent as Intent;
            entities = (compoundResult.intents[0].entities || {}) as Record<string, any>;
            confidence = compoundResult.intents[0].confidence || 0.8;
            source = "groq";
          } else {
            // Múltiples intents = plan compuesto
            isCompound = true;
            source = "compound";
            intent = "unknown";
          }
        }
      } catch {
        // Compound falló
      }
    }
  }

  // 3. Si Groq no detectó nada, usar NLU local
  if (source === "local" && !opts.forceGroq) {
    try {
      const parsed = parseIntent(normalized);
      if (parsed.intent !== "unknown" || parsed.confidence > 0.3) {
        intent = parsed.intent;
        entities = parsed.entities as Record<string, any>;
        confidence = parsed.confidence;
        source = "local";
      }
    } catch {
      // NLU local también falló
    }
  }

  // 4. Construir los pasos del plan
  const stepsPlanned: PlanStep[] = [];

  if (isCompound) {
    // Plan compuesto: procesar como múltiples intents
    try {
      const conversationContext = {
        lastProjectRef: ctx.scratchpad.lastProjectRef,
        lastProjectName: ctx.scratchpad.lastProjectName,
        lastEntities: {},
      };
      const compoundResult = await tryGroqCompoundIntent(
        rawText,
        ctx.history.map(h => h.content),
        conversationContext
      );

      if (compoundResult.success && compoundResult.intents) {
        for (const ci of compoundResult.intents) {
          const toolSteps = groqResultToSteps(ci.intent as string, ci.entities || {}, rawText);
          for (const step of toolSteps) {
            if (stepsPlanned.length >= MAX_PLAN_STEPS) break;
            stepsPlanned.push(step);
          }
        }
      }
    } catch {
      // Si compound falla, al menos registrar el paso
    }
  } else {
    // Plan simple: un solo intent
    const toolName = intentToToolName(intent as string);
    if (toolName) {
      // Validar args de entrada con Zod
      const validation = validateToolArgs(toolName as ToolName, entities);
      const risk = getRiskLevel(toolName as ToolName);

      if (!validation.ok) {
        // Args inválidos: el plan tiene un solo paso que falla la validación
        stepsPlanned.push({
          id: uuid(),
          tool: toolName,
          args: entities,
          risk,
          description: `Validar args para ${toolName}`,
          requiresConfirmation: false,
          status: "pending",
          error: `Parámetros inválidos: ${validation.errors.join(", ")}`,
        });
      } else {
        const requiresConfirm = memoryRequiresConfirmation(intent as Intent) || risk === "destructive";
        stepsPlanned.push(makeStep(
          toolName,
          validation.args ?? entities,
          risk,
          `Ejecutar ${intent} via ${toolName}`
        ));

        // Si requiere confirmación, marcar el paso como awaitin_confirmation
        if (requiresConfirm) {
          stepsPlanned[stepsPlanned.length - 1].status = "awaiting_confirmation";
        }
      }
    } else if (intent !== "unknown") {
      // Intent sin tool mapping: lo manejan los handlers internos
      stepsPlanned.push(makeStep(
        `__handler__:${intent}`,
        entities,
        "safe",
        `Handler interno: ${intent}`
      ));
    }
  }

  // 5. Calcular si el plan requiere confirmación global
  const requiresConfirmation = stepsPlanned.some(
    s => s.requiresConfirmation || s.status === "awaiting_confirmation"
  );

  const plan: AgentPlan = {
    intent,
    steps: [],
    stepsPlanned,
    confidence,
    rawText,
    normalized: normalizedResult.wasNormalized ? normalized : rawText,
    entities,
    source,
    requiresConfirmation,
    durationMs: Date.now() - startTime,
  };

  return plan;
}

// ──────────────────────────────────────────────────────────────
// Ejecutar un plan paso a paso (no destructivo para el router)
// ──────────────────────────────────────────────────────────────

export async function executePlan(
  plan: AgentPlan,
  executeStep: (step: PlanStep) => Promise<{ ok: boolean; result: any; error?: string }>
): Promise<AgentPlan> {
  const executed: PlanStep[] = [];
  const startTime = Date.now();

  for (const step of plan.stepsPlanned) {
    if (executed.length >= MAX_PLAN_STEPS) break;

    // Si requiere confirmación previa y no se obtuvo, skip
    if (step.status === "awaiting_confirmation") {
      executed.push({ ...step, status: "skipped", error: "_requires_confirmation" });
      continue;
    }

    const startedAt = new Date().toISOString();
    try {
      const result = await executeStep(step);
      executed.push({
        ...step,
        status: result.ok ? "success" : "failed",
        result: result.result,
        error: result.error,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - new Date(startedAt).getTime(),
      });
    } catch (err: any) {
      executed.push({
        ...step,
        status: "failed",
        error: err.message || "Error desconocido",
        startedAt,
        finishedAt: new Date().toISOString(),
      });
    }
  }

  return {
    ...plan,
    steps: executed,
    durationMs: Date.now() - startTime,
  };
}

// ──────────────────────────────────────────────────────────────
// Utilidades
// ──────────────────────────────────────────────────────────────

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        controller.signal.addEventListener("abort", () => reject(new Error("timeout")))
      ),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export function getPlanSummary(plan: AgentPlan): string {
  const stepNames = plan.steps.map(s => s.tool).join(" → ");
  return `[${plan.source.toUpperCase()}] ${plan.intent} | Confianza: ${(plan.confidence * 100).toFixed(0)}% | Pasos: ${stepNames || "ninguno"}`;
}
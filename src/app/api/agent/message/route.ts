// ============================================================
// API: /api/agent/message — Endpoint unificado del agente
// ============================================================
// Usa la arquitectura de Router + Planner + Tool Execution.
//
// Flujo:
//   1. route() → AgentPlan (pasos planificados)
//   2. Validar args de cada paso
//   3. Si algún paso requiere confirmación → devolver plan pendiente
//   4. Si todo ok → ejecutar con executeToolCall()
//   5. Enriquecer respuesta con Groq (si disponible)
//   6. Persistir en AgentMessage
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { route } from "@/lib/agent/router";
import { executePlan } from "@/lib/agent/router";
import { executeToolCall } from "@/lib/tool-execution";
import { recordTurn } from "@/lib/agent/context";
import { enrichQueryWithGroq, enrichActionResponseWithGroq } from "@/lib/agent-dispatcher";
import type { Intent } from "@/lib/agent";
import type { AgentPlan, PlanStep } from "@/lib/agent/types";
import { v4 as uuid } from "uuid";
import { checkRateLimit, auditLog, sanitizeForGroq } from "@/lib/agent/audit";
import { requireAgentApiKey, agentApiKeyRequiredResponse } from "@/lib/api-utils";

const SESSION_HEADER = "x-session-id";

// ─── POST /api/agent/message ────────────────────────────────

export async function POST(req: NextRequest) {
  if (!requireAgentApiKey(req)) return agentApiKeyRequiredResponse();
  const planId = uuid();
  const sessionId = req.headers.get(SESSION_HEADER) || "default";
  const rateCheck = checkRateLimit(sessionId);
  if (!rateCheck.allowed) {
    await auditLog({ type: "rate_limited", sessionId });
    return NextResponse.json(
      {
        error: "Demasiadas requests. Probá de nuevo en unos segundos.",
        _rateLimited: true,
        retryAfter: rateCheck.resetIn,
      },
      { status: 429 }
    );
  }
  const startTime = Date.now();

  try {
    const body = await req.json();
    const rawMessage: string = body.message || "";
    const confirmedPlan: AgentPlan | null = body.confirmedPlan || null;

    if (!rawMessage.trim() && !confirmedPlan) {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
    }

    // 1. Si el usuario ya confirmó un plan, ejecutarlo directamente
    if (confirmedPlan) {
      const result = await executeConfirmedPlan(confirmedPlan, rawMessage, sessionId, startTime);
      return NextResponse.json({
        ...result,
        planId,
        _confirmedExecution: true,
      });
    }

    // 2. Planificar con el Router
    const plan = await route(rawMessage, { sessionId });

    // Audit: plan created
    auditLog({
      type: "plan_created",
      intent: plan.intent as string,
      source: plan.source,
      confidence: plan.confidence,
      sessionId,
      metadata: { stepCount: plan.stepsPlanned.length, requiresConfirmation: plan.requiresConfirmation },
    }).catch(() => {});

    // 3. Si el plan tiene pasos que requieren confirmación, devolver el plan
    if (plan.requiresConfirmation && plan.stepsPlanned.length > 0) {
      // Audit: confirmation requested
      auditLog({
        type: "confirmation_requested",
        intent: plan.intent as string,
        sessionId,
        metadata: { steps: plan.stepsPlanned.map((s: any) => s.tool) },
      }).catch(() => {});
      const confirmationText = buildConfirmationPrompt(plan);
      return NextResponse.json({
        text: confirmationText,
        intent: plan.intent as string,
        planId,
        plan,
        _requiresConfirmation: true,
        suggestions: ["Sí, confirmar", "No, cancelar"],
      });
    }

    // 4. Si no hay pasos planificados (Groq no detectó intent),
    //    делегировать al flujo existente (processAgentMessage)
    if (plan.stepsPlanned.length === 0 || plan.intent === "unknown") {
      const { processAgentMessage } = await import("@/lib/agent");
      const response = await processAgentMessage(rawMessage);
      return NextResponse.json({
        ...response,
        planId,
        _fallbackToLegacy: true,
      });
    }

    // 5. Ejecutar el plan
    // Audit: plan execution started
    auditLog({
      type: "plan_executed",
      intent: plan.intent as string,
      sessionId,
      success: true,
      metadata: { stepCount: plan.stepsPlanned.length },
    }).catch(() => {});
    const executedPlan = await executePlan(plan, async (step: PlanStep) => {
      const result = await executeToolCall(
        { tool: step.tool as any, args: step.args, rawText: plan.rawText },
        { rawText: plan.rawText }
      );
      return { ok: result.ok, result: result.response, error: result.errors?.join("; ") };
    });

    // 6. Construir respuesta final combinando resultados de pasos
    const finalResponse = buildResponseFromPlan(executedPlan);

    // 7. Enriquecer con Groq si es query (datos reales + Groq response)
    if (isQueryIntent(plan.intent as string) && executedPlan.steps.some(s => s.status === "success")) {
      const { enrichQueryWithGroq: enrichQ } = await import("@/lib/agent-dispatcher");
      const history = []; // TODO: pasar history real
      try {
        const enriched = await enrichQ(
          plan.intent as Intent,
          plan.entities,
          rawMessage,
          plan.confidence,
          history
        );
        finalResponse.text = enriched.text;
        finalResponse._groqEnhanced = true;
      } catch {
        // Groq enrichment falló, usar respuesta local
      }
    }

    // 8. Persistir mensajes en paralelo
    await Promise.all([
      recordTurn({ role: "user", content: rawMessage, intent: plan.intent as string }, sessionId),
      recordTurn({ role: "agent", content: finalResponse.text, intent: plan.intent as string }, sessionId),
    ]);

    return NextResponse.json({
      ...finalResponse,
      planId,
      plan: executedPlan,
      _source: plan.source,
      _confidence: plan.confidence,
      durationMs: Date.now() - startTime,
    });
  } catch (error: any) {
    await auditLog({ type: "plan_failed", sessionId, errorMessage: error.message }).catch(() => {});
    console.error("[API] POST /api/agent/message:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del agente", planId },
      { status: 500 }
    );
  }
}

// ─── Ejecutar plan ya confirmado por el usuario ──────────────

async function executeConfirmedPlan(
  plan: AgentPlan,
  rawMessage: string,
  sessionId: string,
  startTime: number
) {
  const executedPlan = await executePlan(plan, async (step: PlanStep) => {
    const result = await executeToolCall(
      { tool: step.tool as any, args: step.args, rawText: rawMessage },
      { rawText: rawMessage }
    );
    return { ok: result.ok, result: result.response, error: result.errors?.join("; ") };
  });

  const finalResponse = buildResponseFromPlan(executedPlan);

  // Audit: confirmation approved and executed
  await auditLog({
    type: "confirmation_approved",
    intent: plan.intent as string,
    sessionId,
    success: true,
    durationMs: Date.now() - startTime,
    metadata: {
      stepCount: plan.stepsPlanned.length,
      successfulSteps: executedPlan.steps.filter((s: any) => s.status === "success").length,
      failedSteps: executedPlan.steps.filter((s: any) => s.status === "failed").length,
    },
  }).catch(() => {});

  await recordTurn({ role: "user", content: rawMessage || "[confirmado]", intent: plan.intent as string }, sessionId);
  await recordTurn({ role: "agent", content: finalResponse.text, intent: plan.intent as string }, sessionId);

  return {
    ...finalResponse,
    _confirmedExecution: true,
    plan: executedPlan,
    durationMs: Date.now() - startTime,
  };
}

// ─── Construir texto de confirmación para el usuario ─────────

function buildConfirmationPrompt(plan: AgentPlan): string {
  const stepLines = plan.stepsPlanned.map((step, i) => {
    const icon = step.risk === "destructive" ? "⚠️" : step.risk === "moderate" ? "🔶" : "✅";
    const riskLabel = step.risk === "destructive" ? " [DESTRUCTIVO]" : step.risk === "moderate" ? " [MODERADO]" : "";
    return `${i + 1}. ${icon} **${step.tool}**${riskLabel}\n   ${step.description}`;
  });

  return (
    `🤖 **Plan detectado** (confianza: ${(plan.confidence * 100).toFixed(0)}%)\n\n` +
    stepLines.join("\n\n") +
    `\n\n---\n\n¿Confirmás la ejecución? Respondé **sí** para continuar o **no** para cancelar.`
  );
}

// ─── Construir respuesta combinada desde un plan ejecutado ───

function buildResponseFromPlan(plan: AgentPlan): Record<string, any> {
  const successfulSteps = plan.steps.filter(s => s.status === "success");
  const failedSteps = plan.steps.filter(s => s.status === "failed");

  let text: string;
  if (successfulSteps.length === 0 && failedSteps.length === 0) {
    text = "No se ejecutó ningún paso.";
  } else if (successfulSteps.length === 1 && failedSteps.length === 0) {
    text = successfulSteps[0].result?.text || "Listo.";
  } else {
    const parts = [
      ...successfulSteps.map(s => s.result?.text || `✅ ${s.tool}`),
      ...failedSteps.map(s => `❌ ${s.tool}: ${s.error}`),
    ];
    text = parts.join("\n\n");
  }

  return {
    text,
    intent: plan.intent,
    data: {
      planId: plan.steps[0]?.id,
      executedCount: successfulSteps.length,
      failedCount: failedSteps.length,
      steps: plan.steps.map(s => ({
        tool: s.tool,
        status: s.status,
        error: s.error,
      })),
    },
    suggestions: ["¿Cómo vamos?", "Ver obras", "Ver alertas"],
  };
}

// ─── GET /api/agent/message — Catálogo de capabilities ──────

export async function GET() {
  try {
    const { listExecutableTools } = await import("@/lib/tool-execution");
    const { buildContext } = await import("@/lib/agent/context");

    const [tools, ctx] = await Promise.all([
      listExecutableTools(),
      buildContext({ includeToolCatalog: true }),
    ]);

    const byCategory = tools.reduce<Record<string, any[]>>((acc, t: any) => {
      const cat = t.name.split("_")[0];
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push({ name: t.name, intent: t.intent, description: t.description, riskLevel: t.riskLevel });
      return acc;
    }, {});

    return NextResponse.json({
      toolsCount: tools.length,
      llmProvider: ctx.llmProvider,
      llmAvailable: ctx.llmAvailable,
      categories: byCategory,
      newCapabilities: [
        "schedule_event",
        "list_events",
        "complete_event",
        "cancel_event",
        "send_notification",
        "list_notifications",
        "resolve_notification",
        "dismiss_all_notifications",
        "remember_preference",
        "recall_preference",
        "forget_preference",
        "list_preferences",
        "search_projects",
        "search_clients",
        "search_budgets",
        "list_budget_ranges",
        "generate_document",
      ],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── Utilidades ──────────────────────────────────────────────

function isQueryIntent(intent: string): boolean {
  return intent.startsWith("query_") || intent.startsWith("capability_search") || intent.startsWith("capability_list");
}
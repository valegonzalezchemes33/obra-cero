// ============================================================
// MOTOR DEL AGENTE IA LOCAL — Sin APIs externas
// Capacidades:
//  - NLU avanzado en español (normalización de acentos, sinónimos, fuzzy matching)
//  - 45+ intenciones cubriendo consultas, acciones y análisis
//  - Memoria conversacional: entiende pronombres y contexto ("esa obra", "este mes")
//  - Análisis predictivos: proyección de presupuesto, forecast de caja, ETA obras
//  - Detección de anomalías: gastos atípicos, desvíos, proveedores caros
//  - Recomendaciones contextuales con insights accionables
//  - Ejecución de acciones: alta de movimientos, tareas, pedidos
//  - Comparaciones temporales: mes vs mes, año vs año
//  - Motor de automatización con reglas configurables
// ============================================================

import { db } from "@/lib/db";
import { normalizeMessage } from "@/lib/agent-nlu";
import { saveContextMetadata } from "@/lib/agent-memory";
import { agentLogger } from "@/lib/logger";
import { INTENT_PATTERNS } from "@/lib/agent-intents";
import type { Intent } from "@/lib/agent-intents";
import { normalize } from "@/lib/agent/normalize";
import { dispatchByIntent, tryGroqDispatch } from "@/lib/agent/dispatcher";
import { runAutomations } from "@/lib/agent/automation-engine";

export { normalize };
export { dispatchByIntent };
export { runAutomations };

// ---------- Tipos ----------

export type { Intent };

export interface ParsedCommand {
  intent: Intent;
  rawText: string;
  normalized: string;
  entities: Record<string, string | number | undefined>;
  confidence: number;
}

export interface AgentResponse {
  text: string;
  intent: Intent;
  data?: any;
  actions?: AgentActionItem[];
  suggestions?: string[];

  // ─── Metadata flexible para clientes (UI, MCP, workflows, endpoint) ───
  // Permite que cada capa agregue campos auxiliares sin redefinir el tipo:
  //   _groqEnhanced, _groqConfidence, _groqCompound
  //   _tool, _riskLevel, _validationErrors
  //   route (para que la UI navegue)
  //   _requiresConfirmation (agent-extended.ts)
  //   _canUndo (post-delete)
  [key: string]: any;
}

export interface AgentResponseWithEntities {
  response: AgentResponse;
  entities: Record<string, any>;
}

export interface AgentActionItem {
  type: "alert" | "task" | "reorder" | "highlight" | "navigate";
  title: string;
  description: string;
  severity?: "info" | "warning" | "critical";
  payload?: any;
}

// ---------- NLU Avanzado ----------

interface Match {
  intent: Intent;
  priority: number;
  patternLen: number;
  confidence: number;
  entities: Record<string, any>;
}

export function parseIntent(text: string): ParsedCommand {
  const normalized = normalize(text);
  const matches: Match[] = [];

  for (const def of INTENT_PATTERNS) {
    const priority = def.priority ?? 5;
    for (const pattern of def.patterns) {
      if (pattern.test(normalized)) {
        const confidence = Math.min(0.99, 0.5 + priority / 10 + pattern.source.length / 200);
        matches.push({
          intent: def.intent,
          priority,
          patternLen: pattern.source.length,
          confidence,
          entities: def.entities ? def.entities(text, normalized) : {},
        });
      }
    }
  }

  if (matches.length === 0) {
    return { intent: "unknown", rawText: text, normalized, entities: {}, confidence: 0 };
  }

  // Ordenar por prioridad (desc) y luego por longitud de pattern (desc) → más específico gana
  matches.sort((a, b) => b.priority - a.priority || b.patternLen - a.patternLen);
  const best = matches[0];

  return {
    intent: best.intent,
    rawText: text,
    normalized,
    entities: best.entities,
    confidence: best.confidence,
  };
}

export { generateSku } from "@/lib/agent/sku";

export async function processAgentMessage(text: string): Promise<AgentResponse> {
  const originalText = text.trim();
  const normalized = normalizeMessage(originalText);
  const parsed = parseIntent(normalized.normalized || originalText);

  // Guardar mensaje del usuario
  try {
    await db.agentMessage.create({ data: { role: "user", content: originalText, intent: parsed.intent } });
  } catch (e) { agentLogger.warn({ module: "agent" }, "catch swallowed: guardar mensaje del usuario en BD") }

  let response: AgentResponse | null = null;
  let groqEntities: Record<string, any> = {};

  if (parsed.intent === "unknown" || parsed.confidence < 0.45) {
    try {
      const { processExtendedMessage } = await import("./agent-extended");
      const extended = await processExtendedMessage(normalized.normalized, originalText);
      if (extended.wasExtended && extended.response) {
        response = extended.response;
      }
    } catch (e) { agentLogger.warn({ module: "agent" }, "catch swallowed: intentar procesamiento extendido") }
  }

  if (!response) {
    response = await dispatchByIntent(parsed, originalText);
  }

  const shouldFallbackToGroq =
    response.intent === "unknown" || parsed.intent === "unknown" || parsed.confidence < 0.45;

  if (shouldFallbackToGroq) {
    const groqResult = await tryGroqDispatch(originalText);
    if (groqResult) {
      response = groqResult.response;
      groqEntities = groqResult.entities || {};
      parsed.entities = { ...parsed.entities, ...groqEntities };
      parsed.intent = response.intent;
    }
  }

  if (response.intent === "unknown") {
    try {
      const { findClosestIntent, generateSmartUnknownResponse } = await import("./agent-extended");
      const closest = findClosestIntent(originalText);
      response = generateSmartUnknownResponse(originalText, closest);
    } catch (e) { agentLogger.warn({ module: "agent" }, "catch swallowed: buscar intent similar y generar respuesta") }
  }

  // Guardar respuesta del agente
  try {
    await db.agentMessage.create({
      data: {
        role: "agent",
        content: response.text,
        intent: response.intent,
        meta: response.data ? JSON.stringify(response.data).slice(0, 4000) : null,
      },
    });
  } catch (e) { agentLogger.warn({ module: "agent" }, "catch swallowed: guardar respuesta del agente en BD") }

  try {
    await saveContextMetadata(response, parsed.entities);
  } catch (e) { agentLogger.warn({ module: "agent" }, "catch swallowed: guardar metadatos de contexto") }

  return response;
}

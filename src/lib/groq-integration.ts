// ============================================================
// INTEGRACIÓN GROQ — Conecta el agente local y los workflows
// con la API de Groq para comprensión mejorada
// ============================================================
// Este módulo actúa como puente entre:
//  - El agente interno (agent.ts) → usa Groq cuando el NLU local falla
//  - Los workflows (workflow-engine.ts) → provee action_call_llm
//  - La API route (/api/agent) → mejora respuestas unknown
// ============================================================

import { parseIntentWithGroq, generateAgentResponseWithGroq, chatWithGroq, checkGroqAvailability } from "./groq";
import type { AgentResponse, Intent } from "./agent";
import { db } from "./db";
import {
  getAvailableProviders as getLlmProviders,
  getActiveProvider as getActiveLlmProvider,
  type LLMProviderType,
} from "./llm-provider";

// ─── Provider activo / disponibles ───
// Helpers para que el agente y la UI sepan qué provider LLM se está usando.

export function getProvider(): LLMProviderType {
  return getActiveLlmProvider();
}

export async function listProviders() {
  return getLlmProviders();
}

// ─── Cache de disponibilidad ───

let groqAvailable: boolean | null = null;
let lastCheck = 0;
const CHECK_INTERVAL = 60000; // 1 minuto

export async function isGroqAvailable(): Promise<boolean> {
  if (groqAvailable !== null && Date.now() - lastCheck < CHECK_INTERVAL) {
    return groqAvailable;
  }
  try {
    const result = await checkGroqAvailability();
    groqAvailable = result.available;
    lastCheck = Date.now();
    return result.available;
  } catch {
    groqAvailable = false;
    lastCheck = Date.now();
    return false;
  }
}

// ─── Intentar entender el mensaje con Groq (intent único) ───
// Devuelve un intent parseado por Groq, o null si falla

export async function tryGroqIntentRecognition(
  message: string,
  recentMessages?: string[]
): Promise<{
  success: boolean;
  intent?: string;
  entities?: Record<string, any>;
  explanation?: string;
  confidence?: number;
  isCompound?: boolean;
  compoundIntents?: Array<{ intent: string; entities: Record<string, any> }>;
}> {
  try {
    const available = await isGroqAvailable();
    if (!available) return { success: false };

    const result = await parseIntentWithGroq(message, {
      recentMessages,
      availableIntents: undefined,
    });

    if (!result || result.intent === "unknown" || result.confidence < 0.4) {
      return { success: false };
    }

    return {
      success: true,
      intent: result.intent,
      entities: result.entities,
      explanation: result.explanation,
      confidence: result.confidence,
      isCompound: (result as any).isCompound || false,
      compoundIntents: (result as any).compoundIntents || undefined,
    };
  } catch {
    return { success: false };
  }
}

// ─── Intentar entender mensajes COMPUESTOS con Groq ───
// Para mensajes que contienen múltiples acciones (ej: "crear obra + agregar materiales")
// Devuelve un array de intents con sus entidades para ejecutar secuencialmente
// conversationContext: contexto de memoria (lastProjectRef, lastProjectName, lastEntities)
// para que Groq pueda resolver referencias como "esa obra" o "esos materiales"

export async function tryGroqCompoundIntent(
  message: string,
  recentMessages?: string[],
  conversationContext?: {
    lastProjectRef?: string;
    lastProjectName?: string;
    lastMaterialName?: string;
    lastEntities?: Record<string, any>;
  }
): Promise<{
  success: boolean;
  intents?: Array<{ intent: string; entities: Record<string, any>; confidence: number }>;
}> {
  try {
    const available = await isGroqAvailable();
    if (!available) return { success: false };

    // Enriquecer los mensajes recientes con el contexto de memoria
    // para que Groq entienda referencias como "la nueva obra" o "esos materiales"
    const enrichedRecent = [...(recentMessages || [])];
    if (conversationContext) {
      const ctxLines: string[] = [];
      if (conversationContext.lastProjectRef)
        ctxLines.push(`[CONTEXTO] Proyecto activo: ${conversationContext.lastProjectRef}${conversationContext.lastProjectName ? ` (${conversationContext.lastProjectName})` : ""}`);
      if (conversationContext.lastMaterialName)
        ctxLines.push(`[CONTEXTO] Último material referenciado: ${conversationContext.lastMaterialName}`);
      if (conversationContext.lastEntities && Object.keys(conversationContext.lastEntities).length > 0)
        ctxLines.push(`[CONTEXTO] Entidades de la acción anterior: ${JSON.stringify(conversationContext.lastEntities)}`);
      if (ctxLines.length > 0) enrichedRecent.unshift(...ctxLines);
    }

    const result = await parseIntentWithGroq(message, {
      recentMessages: enrichedRecent,
      availableIntents: undefined,
    });

    if (!result) return { success: false };

    // Si Groq detectó compound, devolver los intents compuestos
    if ((result as any).isCompound && (result as any).compoundIntents) {
      const intents = (result as any).compoundIntents.map((ci: any) => ({
        intent: ci.intent,
        entities: ci.entities || {},
        confidence: result.confidence,
      }));
      return { success: true, intents };
    }

    // Si no detectó compound pero tiene un intent único válido
    if (result.intent !== "unknown" && result.confidence >= 0.4) {
      return {
        success: true,
        intents: [{ intent: result.intent, entities: result.entities, confidence: result.confidence }],
      };
    }

    return { success: false };
  } catch {
    return { success: false };
  }
}



// ─── Generar respuesta mejorada con Groq ───
// Envía datos del sistema + contexto conversacional para
// obtener una respuesta más natural y útil

export async function tryGroqEnhancedResponse(
  userMessage: string,
  intent: string,
  dbData?: any,
  conversationHistory?: string[]
): Promise<AgentResponse | null> {
  try {
    const available = await isGroqAvailable();
    if (!available) return null;

    const groqResponse = await generateAgentResponseWithGroq(userMessage, {
      intent,
      dbData,
      recentConversation: conversationHistory,
    });

    if (!groqResponse) return null;

    // Devolver la respuesta generada por Groq como AgentResponse
    return {
      text: groqResponse,
      intent: intent as Intent,
      data: dbData,
      suggestions: ["¿Cómo vamos?", "¿Qué alertas hay?", "Recomendaciones"],
    };
  } catch {
    return null;
  }
}

// ─── Analizar datos con Groq para workflows ───
// Ejecuta un prompt de análisis sobre datos del sistema
// y devuelve el resultado como string estructurado

export async function analyzeDataWithGroq(
  systemPrompt: string,
  userPrompt: string,
  data: any
): Promise<{ success: boolean; result: string; error?: string }> {
  try {
    const available = await isGroqAvailable();
    if (!available) {
      return { success: false, error: "Groq no está disponible", result: "" };
    }

    const dataStr = JSON.stringify(data).slice(0, 5000);
    const fullPrompt = `DATOS DEL SISTEMA:\n${dataStr}\n\n${userPrompt}`;

    const response = await chatWithGroq(fullPrompt, {
      systemPrompt,
      temperature: 0.3,
      maxTokens: 2048,
    });

    if (!response.success) {
      return { success: false, error: response.error || "Error en Groq", result: "" };
    }

    return { success: true, result: response.content };
  } catch (error: any) {
    return { success: false, error: error.message, result: "" };
  }
}

// ─── Obtener datos del sistema para contexto ───
// Recolecta datos relevantes de la base para enviar a Groq

export async function getSystemContext(): Promise<{
  financialSummary: any;
  stockSummary: any;
  projectSummary: any;
  recentMessages: string[];
}> {
  const [transactions, materials, projects, recentMsgs] = await Promise.all([
    db.transaction.aggregate({
      _sum: { amount: true },
      where: { type: "expense" },
    }),
    db.material.count(),
    db.project.findMany({
      select: { code: true, name: true, status: true, progress: true, budget: true },
    }),
    db.agentMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { role: true, content: true },
    }),
  ]);

  return {
    financialSummary: {
      totalExpenses: transactions._sum.amount || 0,
    },
    stockSummary: {
      totalMaterials: materials,
    },
    projectSummary: {
      total: projects.length,
      active: projects.filter((p) => p.status === "in_progress").length,
      projects,
    },
    recentMessages: recentMsgs
      .reverse()
      .map((m) => `${m.role}: ${m.content.slice(0, 200)}`),
  };
}

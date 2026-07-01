// ============================================================
// CLIENTE GROQ → Wrapper de compatibilidad sobre llm-provider
// ============================================================
// Este módulo preserva las funciones históricas (chatWithGroq,
// parseIntentWithGroq, generateAgentResponseWithGroq,
// checkGroqAvailability) pero por dentro delega en llm-provider.ts,
// que soporta múltiples providers (Groq, OpenAI, Anthropic, Ollama).
//
// Para usar otro provider:
//   setActiveProvider("openai" | "anthropic" | "ollama")
// ============================================================

import {
  chat as llmChat,
  checkProvider as llmCheckProvider,
  type LLMProviderType,
} from "./llm-provider";

const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const FAST_MODEL = "llama-3.1-8b-instant";
const FALLBACK_MODEL = "mixtral-8x7b-32768";

export type GroqModel =
  | "llama-3.3-70b-versatile"
  | "llama-3.1-8b-instant"
  | "mixtral-8x7b-32768"
  | "gemma2-9b-it"
  | "llama-guard-3-8b";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqChatOptions {
  model?: GroqModel | string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  messages?: GroqMessage[];
  // Permite override del provider sin cambiar el global
  provider?: LLMProviderType;
}

export interface GroqResponse {
  success: boolean;
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

export interface GroqIntentResult {
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  explanation: string;
  isCompound?: boolean;
  compoundIntents?: Array<{ intent: string; entities: Record<string, any> }>;
}

// ─── Chat con Groq (u otro provider activo) ───

export async function chatWithGroq(
  userMessage: string,
  options: GroqChatOptions = {}
): Promise<GroqResponse> {
  try {
    // Si vienen `messages` históricos, los concatenamos al final del
    // userMessage así preservamos contexto multi-turn sin tocar la API
    // del llm-provider (que solo acepta system + último user).
    let fullPrompt = userMessage;
    if (options.messages && options.messages.length > 0) {
      const contextLines = options.messages
        .map((m) => `[${m.role}] ${m.content}`)
        .join("\n");
      fullPrompt = `${contextLines}\n[user] ${userMessage}`;
    }

    const result = await llmChat(fullPrompt, options.systemPrompt, {
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 1024,
      provider: options.provider,
    });

    if (!result.success) {
      return {
        success: false,
        content: "",
        model: result.model,
        error: result.error,
      };
    }

    return {
      success: true,
      content: result.content,
      model: result.model,
      usage: result.usage,
    };
  } catch (error: any) {
    return {
      success: false,
      content: "",
      model: options.model || DEFAULT_MODEL,
      error: error.message,
    };
  }
}

// ─── Entender lenguaje natural → intent + entidades ───

export async function parseIntentWithGroq(
  userMessage: string,
  context?: {
    recentMessages?: string[];
    availableIntents?: string[];
  }
): Promise<GroqIntentResult | null> {
  const intentsList = context?.availableIntents || [
    "greeting",
    "query_profit",
    "query_expenses",
    "query_income",
    "query_cashflow",
    "query_kpis",
    "query_top_expense",
    "query_margin_by_project",
    "query_compare_period",
    "query_anomalies",
    "query_stock",
    "query_low_stock",
    "query_stock_value",
    "query_material_history",
    "query_dead_stock",
    "query_project_status",
    "query_project_detail",
    "query_project_profitability",
    "predict_budget",
    "predict_project_eta",
    "query_supplier",
    "query_best_supplier",
    "query_tasks",
    "query_overdue_tasks",
    "alert_check",
    "recommend",
    "summarize",
    "help",
    "action_create_expense",
    "action_create_income",
    "action_create_task",
    "action_reorder",
    "action_create_project_direct",
    "action_add_materials",
    "action_add_stock_movement",
    "action_update_project_progress",
    "action_update_project_status",
    "action_complete_task",
    "action_close_project",
    "action_create_supplier",
    "action_edit_project",
    "action_edit_task",
    "action_edit_material",
    "action_delete_task",
    "action_delete_material",
    "action_delete_transaction",
    "action_trigger_workflow",
    "action_list_workflows",
    "action_export_data",
  ];

  // Bloque de contexto conversacional para resolver referencias
  const recentBlock =
    context?.recentMessages && context.recentMessages.length > 0
      ? `\nULTIMOS MENSAJES DE LA CONVERSACION (para resolver referencias como "esos", "la nueva obra", "esos materiales"):\n${context.recentMessages.slice(-12).map(m => {
          // If messages already have role prefix (user:/agent:), show as-is
          if (m.startsWith("user:") || m.startsWith("agent:")) return m;
          return `usuario: ${m}`;
        }).join("\n")}\n`
      : "";

  const systemPrompt = `Sos un sistema experto de comprension de lenguaje natural para una constructora argentina llamada ObraCero. Tu unica tarea es analizar el mensaje del usuario y devolver SOLO un JSON valido, sin ningun otro texto.
${recentBlock}
INTENCIONES DISPONIBLES: ${intentsList.join(", ")}.

FORMATO DE RESPUESTA OBLIGATORIO:
{"intent":"nombre","confidence":0.9,"entities":{},"explanation":"breve","isCompound":false,"compoundIntents":[]}

REGLAS CRITICAS:
1. Si el mensaje contiene MULTIPLES ACCIONES, usar "isCompound":true y completar "compoundIntents" con TODOS los intents detectados.
2. Si el mensaje hace referencia a "esos materiales", "la nueva obra", "esa obra", "los mismos", etc., resolver la referencia usando los ULTIMOS MENSAJES de arriba.
3. NUNCA agregar texto fuera del JSON. Solo JSON puro.
4. Si no entendes, devolver intent "unknown" con confidence 0.0.

PARSEO DE MATERIALES - MUY IMPORTANTE:
Para "action_add_materials", el campo "items" es SIEMPRE un array de objetos:
  {"qty": numero, "unit": "unidad", "name": "nombre del material", "price": numero_opcional}
Ejemplos: "10 bolsas de cremel de 25kg a $2450" -> {"qty":10,"unit":"bolsas","name":"cremel 25kg","price":2450}
"5 m3 de arena fina" -> {"qty":5,"unit":"m3","name":"arena fina"}

EJEMPLOS RAPIDOS (formato Usuario -> Respuesta):
"agrega 10 bolsas de cremel" -> {"intent":"action_add_materials","entities":{"items":[{"qty":10,"unit":"bolsas","name":"cremel"}]}}
"cuanto gaste este mes" -> {"intent":"query_expenses","entities":{"period":"current_month"}}
"registra un gasto de $50000 en materiales" -> {"intent":"action_create_expense","entities":{"amount":50000,"category":"materiales"}}
"crea obra vistassur y agrega 10 bolsas de cremel" -> {"intent":"compound","isCompound":true,"compoundIntents":[{"intent":"action_create_project_direct","entities":{"name":"vistassur"}},{"intent":"action_add_materials","entities":{"items":[{"qty":10,"unit":"bolsas","name":"cremel"}]}}]}`;

  try {
    // Pasar los mensajes recientes como contexto conversacional adicional con roles reales
    let contextMessages: GroqMessage[] = [];
    if (context?.recentMessages && context.recentMessages.length > 0) {
      contextMessages = context.recentMessages.slice(-10).map((msg) => {
        if (msg.startsWith("user:")) return { role: "user" as const, content: msg.slice(5).trim() };
        if (msg.startsWith("agent:")) return { role: "assistant" as const, content: msg.slice(6).trim() };
        return { role: "user" as const, content: msg };
      });
    }

    const result = await chatWithGroq(userMessage, {
      systemPrompt,
      model: DEFAULT_MODEL, // Modelo más potente para mejor comprensión
      temperature: 0.0,
      maxTokens: 800,
      messages: contextMessages.length > 0 ? contextMessages : undefined,
    });

    if (!result.success) return null;

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      intent: parsed.intent || "unknown",
      confidence: parsed.confidence || 0,
      entities: parsed.entities || {},
      explanation: parsed.explanation || "",
      isCompound: parsed.isCompound || false,
      compoundIntents: parsed.compoundIntents || [],
    } as GroqIntentResult;
  } catch {
    return null;
  }
}

// ─── Generar respuesta natural con contexto del sistema ───

export async function generateAgentResponseWithGroq(
  userMessage: string,
  systemData: {
    intent: string;
    dbData?: any;
    recentConversation?: string[];
  }
): Promise<string | null> {
  const recentCtx = systemData.recentConversation && systemData.recentConversation.length > 0
    ? `\nHistorial reciente de la conversacion:\n${systemData.recentConversation.slice(-6).join("\n")}\n`
    : "";

  const dbDataStr = systemData.dbData ? JSON.stringify(systemData.dbData, null, 1).slice(0, 2000) : "{}";

  const systemPrompt = `Sos el asistente virtual de una constructora argentina llamada "ObraCero".
Tus respuestas deben ser:
- En español argentino, natural y conversacional
- Claras y directas, sin rodeos
- Profesionales pero cálidas
${recentCtx}
Contexto actual:
- Intención detectada: ${systemData.intent}
- Datos del sistema: ${dbDataStr}

REGLAS ESTRICTAS (NUNCA las violes):
1. NUNCA inventes datos, nombres, montos o proyectos que no estén en los "Datos del sistema" de arriba.
2. NUNCA le pidas al usuario información que YA ESTÁ en los datos del sistema.
3. Si los datos están vacíos, decí "No encontré información al respecto" sin sugerir datos falsos.
4. No generes preguntas de confirmación si la acción ya fue ejecutada exitosamente.
5. Mantené las respuestas concisas (máximo 2 párrafos).
6. Usá emojis con moderación (máximo 1 por respuesta).
7. Si el usuario hace referencia a algo anterior ("eso", "esa obra"), usá el historial reciente.
8. Si el usuario confirma algo con "sí", "dale", "ok", asumí que la acción YA FUE EJECUTADA y respondé con el resultado.`;

  try {
    let messages: GroqMessage[] = [];
    if (systemData.recentConversation && systemData.recentConversation.length > 0) {
      const recentMessages = systemData.recentConversation.slice(-8);
      for (const msg of recentMessages) {
        if (msg.startsWith("user:")) {
          messages.push({ role: "user", content: msg.slice(5).trim() });
        } else if (msg.startsWith("agent:")) {
          messages.push({ role: "assistant", content: msg.slice(6).trim() });
        }
      }
    }

    const result = await chatWithGroq(userMessage, {
      systemPrompt,
      model: DEFAULT_MODEL,
      temperature: 0.3,
      maxTokens: 800,
      messages: messages.length > 0 ? messages : undefined,
    });

    return result.success ? result.content : null;
  } catch {
    return null;
  }
}

// ─── Verificar disponibilidad del provider activo ───

export async function checkGroqAvailability(): Promise<{
  available: boolean;
  model: string;
  error?: string;
}> {
  const result = await llmCheckProvider();
  return {
    available: result.available,
    model: result.model,
    error: result.error,
  };
}

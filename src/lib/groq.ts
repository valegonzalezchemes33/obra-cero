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

// ─── Completación simple ───

export async function generateCompletion(
  prompt: string,
  options: Omit<GroqChatOptions, "messages"> = {}
): Promise<GroqResponse> {
  return chatWithGroq(prompt, {
    ...options,
    systemPrompt: options.systemPrompt || "Eres un asistente útil para una constructora.",
  });
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

  const systemPrompt = `Sos un sistema de comprensión de lenguaje natural para una constructora.
Analizá el mensaje del usuario y devolvé SOLO un JSON válido con esta estructura:
{
  "intent": "nombre_del_intent",
  "confidence": 0.0,
  "entities": { ... },
  "explanation": "breve explicación",
  "isCompound": false,
  "compoundIntents": []
}

- Si detectás más de una intención, usá "isCompound": true y completá "compoundIntents".
- Si solo hay una intención, "compoundIntents" debe ser un array vacío.
- Usá solo los intents en la lista de intents disponibles.
- Si no entendés bien, devolvé intent "unknown" con confidence 0.0.
- No devolvá ningún otro texto fuera del JSON.

Intenciones disponibles: ${intentsList.join(", ")}.

IMPORTANTE: No agregues explicaciones fuera del JSON. Respondé estrictamente con JSON.

Ejemplo de salida única:
{
  "intent": "action_create_project_direct",
  "confidence": 0.92,
  "entities": { "name": "Casa García", "budget": 2000000, "clientName": "Juan García" },
  "explanation": "El usuario quiere crear una obra nueva con nombre, presupuesto y cliente.",
  "isCompound": false,
  "compoundIntents": []
}

Ejemplo de salida compuesta:
{
  "intent": "compound",
  "confidence": 0.80,
  "entities": {},
  "explanation": "El mensaje contiene dos intenciones separadas.",
  "isCompound": true,
  "compoundIntents": [
    { "intent": "action_create_project_direct", "entities": { "name": "Amarras Center" } },
    { "intent": "action_add_materials", "entities": { "items": [{ "qty": 2, "unit": "bolsas", "name": "clavos" }, { "qty": 4, "unit": "bolsas", "name": "cemento" }] } }
  ]
}
`;

  try {
    const result = await chatWithGroq(userMessage, {
      systemPrompt,
      model: FAST_MODEL, // llama-3.1-8b-instant, temperature 0
      temperature: 0,
      maxTokens: 512,
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
  const systemPrompt = `Eres el asistente virtual de una constructora/inmobiliaria llamada "ObraCero".
Tus respuestas deben ser:
- En español argentino, natural y conversacional
- Claras y directas, sin rodeos
- Profesionales pero cálidas
- Basadas en los datos del sistema que se te proporcionan
- Incluir montos en pesos argentinos formateados

Contexto actual:
- Intención detectada: ${systemData.intent}
- Datos del sistema: ${JSON.stringify(systemData.dbData || {})}

IMPORTANTE:
- No inventes datos que no estén en el contexto
- Si no hay datos suficientes, decíselo al usuario y sugerí cómo empezar
- Mantené las respuestas concisas (máximo 3 párrafos)
- Usa emojis moderadamente para hacer la respuesta más amigable`;

  try {
    const result = await chatWithGroq(userMessage, {
      systemPrompt,
      model: DEFAULT_MODEL, // llama-3.3-70b-versatile
      temperature: 0.7,
      maxTokens: 1024,
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

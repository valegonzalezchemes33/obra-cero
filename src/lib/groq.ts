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

  // Bloque de contexto conversacional para resolver referencias
  const recentBlock =
    context?.recentMessages && context.recentMessages.length > 0
      ? `\nULTIMOS MENSAJES DE LA CONVERSACION (para resolver referencias como "esos", "la nueva obra", "esos materiales"):\n${context.recentMessages.slice(-6).join("\n")}\n`
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
Ejemplos de parseo de materiales:
  "10 bolsas de cremel de 25kg a $2450 la unidad" -> {"qty":10,"unit":"bolsas","name":"cremel 25kg","price":2450}
  "5 m3 de arena fina" -> {"qty":5,"unit":"m3","name":"arena fina"}
  "20 ladrillos comunes a $150 cada uno" -> {"qty":20,"unit":"unidades","name":"ladrillos comunes","price":150}
  "3 rollos de alambre y 2 bolsas de cal" -> [{"qty":3,"unit":"rollos","name":"alambre"},{"qty":2,"unit":"bolsas","name":"cal"}]

EJEMPLOS COMPLETOS:

Ej1 - Un material con precio:
Usuario: "agrega 10 bolsas de cremel de 25kg a $2450 cada una"
Respuesta: {"intent":"action_add_materials","confidence":0.97,"entities":{"items":[{"qty":10,"unit":"bolsas","name":"cremel 25kg","price":2450}]},"explanation":"Agregar materiales con precio","isCompound":false,"compoundIntents":[]}

Ej2 - Crear obra + agregar materiales (COMPUESTO):
Usuario: "crea una nueva obra vistassur. Materiales en inventario de la obra son: 10 bolsas de cremel de 25kg a $2450 la unidad"
Respuesta: {"intent":"compound","confidence":0.95,"entities":{},"explanation":"Crear obra y agregar materiales","isCompound":true,"compoundIntents":[{"intent":"action_create_project_direct","entities":{"name":"vistassur"}},{"intent":"action_add_materials","entities":{"items":[{"qty":10,"unit":"bolsas","name":"cremel 25kg","price":2450}]}}]}

Ej3 - Seguimiento con referencia al contexto previo:
(Contexto: se creo obra "vistassur" OB-009, se mencionaron materiales: 10 bolsas de cremel)
Usuario: "quiero que agregues esos materiales a la nueva obra"
Respuesta: {"intent":"action_add_materials","confidence":0.88,"entities":{"projectRef":"OB-009","items":[{"qty":10,"unit":"bolsas","name":"cremel 25kg","price":2450}]},"explanation":"Referencia a materiales y obra previos resueltos del contexto","isCompound":false,"compoundIntents":[]}

Ej4 - Consulta simple:
Usuario: "cuanto gaste este mes"
Respuesta: {"intent":"query_expenses","confidence":0.95,"entities":{"period":"current_month"},"explanation":"Consulta de gastos del mes actual","isCompound":false,"compoundIntents":[]}

Ej5 - Registrar gasto con proyecto:
Usuario: "registra un gasto de $50000 en materiales para la obra OB-003"
Respuesta: {"intent":"action_create_expense","confidence":0.96,"entities":{"amount":50000,"category":"materiales","projectRef":"OB-003"},"explanation":"Registrar gasto de materiales en obra especifica","isCompound":false,"compoundIntents":[]}`;

  try {
    // Pasar los mensajes recientes como contexto conversacional adicional
    let contextMessages: GroqMessage[] = [];
    if (context?.recentMessages && context.recentMessages.length > 0) {
      contextMessages = context.recentMessages.slice(-4).map((msg) => ({
        role: "user" as const,
        content: msg,
      }));
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

  const systemPrompt = `Sos el asistente virtual de una constructora/inmobiliaria argentina llamada "ObraCero".
Tus respuestas deben ser:
- En español argentino, natural y conversacional
- Claras y directas, sin rodeos
- Profesionales pero cálidas
- Basadas en los datos del sistema que se te proporcionan
- Incluir montos en pesos argentinos formateados (ej: $1.250.000)
${recentCtx}
Contexto actual:
- Intención detectada: ${systemData.intent}
- Datos del sistema: ${JSON.stringify(systemData.dbData || {})}

IMPORTANTE:
- No inventes datos que no estén en el contexto
- Si no hay datos suficientes, decíselo al usuario y sugerí cómo empezar
- Mantené las respuestas concisas (máximo 3 párrafos)
- Usa emojis moderadamente para hacer la respuesta más amigable
- Si el usuario hace referencia a algo anterior ("eso", "esa obra"), usá el historial reciente`;

  try {
    let messages: GroqMessage[] = [];
    if (systemData.recentConversation && systemData.recentConversation.length > 0) {
      const recentMessages = systemData.recentConversation.slice(-6);
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
      temperature: 0.7,
      maxTokens: 1024,
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

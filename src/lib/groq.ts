// ============================================================
// CLIENTE GROQ API — Integración con modelos de lenguaje
// ============================================================
// Proporciona:
//  - chatWithGroq(): chat completo con mensajes y system prompt
//  - generateCompletion(): completación simple
//  - parseIntentWithGroq(): entender lenguaje natural → intent/entidades
//  - Sistema de fallback: si Groq falla, devuelve null para que
//    el sistema local tome el control
// ============================================================

const GROQ_API_BASE = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
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
  model?: GroqModel;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  messages?: GroqMessage[];
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

// ─── Obtener API key ───

function getApiKey(): string | null {
  // Usar la variable de entorno configurada en .env
  const envKey = process.env.GROQ_API_KEY;
  if (envKey && envKey.length > 0 && envKey.startsWith("gsk_")) return envKey;

  return null;
}

// ─── Chat completo con Groq ───

export async function chatWithGroq(
  userMessage: string,
  options: GroqChatOptions = {}
): Promise<GroqResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, content: "", model: "", error: "GROQ_API_KEY no configurada" };
  }

  const model = options.model || DEFAULT_MODEL;
  const messages: GroqMessage[] = [];

  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }

  if (options.messages) {
    // Si hay mensajes previos, los agregamos (útil para mantener contexto)
    messages.push(...options.messages);
  }

  messages.push({ role: "user", content: userMessage });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1024,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        content: "",
        model,
        error: `Groq API error ${response.status}: ${errorText.slice(0, 200)}`,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return {
      success: true,
      content,
      model: data.model || model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  } catch (error: any) {
    if (error.name === "AbortError") {
      return { success: false, content: "", model, error: "Timeout: Groq no respondió en 15s" };
    }
    return {
      success: false,
      content: "",
      model,
      error: `Error de conexión con Groq: ${error.message}`,
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

// ─── Entender lenguaje natural con Groq ───
// Parsea el mensaje del usuario y devuelve intent + entidades.
// Se usa cuando el NLU local no puede determinar la intención.

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
    let contextMessages: GroqMessage[] = [];

    if (context?.recentMessages && context.recentMessages.length > 0) {
      contextMessages = context.recentMessages.slice(-4).map((msg) => ({
        role: "user",
        content: msg,
      }));
    }

    const result = await chatWithGroq(userMessage, {
      systemPrompt,
      model: "llama-3.1-8b-instant",
      temperature: 0.0,
      maxTokens: 512,
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
    let messages: GroqMessage[] = [];

    // Agregar conversación reciente como contexto
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

// ─── Verificar si Groq está disponible ───

export async function checkGroqAvailability(): Promise<{
  available: boolean;
  model: string;
  error?: string;
}> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { available: false, model: "", error: "API key no configurada" };
  }

  try {
    const response = await fetch(`${GROQ_API_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      return { available: false, model: "", error: `Error ${response.status}` };
    }

    return { available: true, model: DEFAULT_MODEL };
  } catch (error: any) {
    return { available: false, model: "", error: error.message };
  }
}

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
  const systemPrompt = `Eres un sistema de comprensión de lenguaje natural para una constructora.
Analiza el mensaje del usuario y determina:
1. La intención (intent) más probable
2. Las entidades relevantes (montos, nombres, referencias)
3. Un nivel de confianza (0-1)
4. Una breve explicación

IMPORTANTE: El mensaje del usuario puede contener MULTIPLES intenciones separadas (ej: "crea una obra y agrega materiales"). Si detectas más de una intención, devuelve hasta 2 intents en el array "intents".

INTENCIONES DISPONIBLES:

== CONSULTAS ==
- greeting: Saludo inicial
- query_profit: Consultar ganancias/rentabilidad
- query_expenses: Consultar gastos
- query_income: Consultar ingresos
- query_cashflow: Consultar flujo de caja
- query_kpis: Ver indicadores/KPIs
- query_top_expense: Ver principales gastos
- query_margin_by_project: Margen por obra
- query_compare_period: Comparar períodos
- query_anomalies: Detectar anomalías en gastos
- query_stock: Consultar inventario/stock
- query_low_stock: Consultar stock bajo
- query_stock_value: Valor del inventario
- query_material_history: Historial de un material
- query_dead_stock: Stock muerto/ sin rotación
- query_project_status: Estado de las obras
- query_project_detail: Detalle de una obra específica
- query_project_profitability: Rentabilidad por obra
- predict_budget: Proyección de presupuesto
- predict_project_eta: ETA de finalización de obra
- query_supplier: Consultar proveedores
- query_best_supplier: Mejor proveedor
- query_tasks: Consultar tareas pendientes
- query_overdue_tasks: Tareas atrasadas/vencidas
- alert_check: Verificar alertas/novedades
- recommend: Recomendaciones/sugerencias
- summarize: Resumen general del negocio
- help: Ayuda / qué puedo hacer

== ACCIONES ==
- action_create_expense: Registrar un gasto
  Entidades: amount (número), category (texto: materiales|mano_obra|servicios|equipos|alquiler|transporte|otros), projectRef (código o nombre de obra, opcional)
- action_create_income: Registrar un ingreso
  Entidades: amount (número), projectRef (opcional)
- action_create_task: Crear una tarea
  Entidades: title (texto), projectRef (opcional), priority (baja|media|alta, opcional)
- action_reorder: Generar pedido de reposición
- action_create_project_direct: Crear una obra nueva
  Entidades: name (texto, nombre de la obra), budget (número, opcional), clientName (texto, opcional)
- action_add_materials: Agregar materiales al inventario (crear o actualizar stock)
  Entidades: items (array de objetos con qty, unit, name), projectRef (código o nombre de obra, opcional)
- action_add_stock_movement: Registrar entrada/salida de stock
  Entidades: type (incoming|outgoing), materialName (texto), quantity (número), unit (texto, opcional)
- action_update_project_progress: Actualizar avance de obra
  Entidades: projectRef (código o nombre), progress (número, 0-100)
- action_update_project_status: Cambiar estado de obra
  Entidades: projectRef (código o nombre), status (in_progress|paused|finished|planning)
- action_complete_task: Marcar tarea como completada
  Entidades: taskTitle (texto)
- action_close_project: Cerrar/finalizar una obra
  Entidades: projectRef (código o nombre)
- action_create_supplier: Dar de alta un proveedor
  Entidades: name (texto), phone (texto, opcional), email (texto, opcional), category (texto, opcional)
- action_edit_project: Editar datos de una obra
  Entidades: projectRef, name (texto, opcional), budget (número, opcional), clientName (texto, opcional)
- action_edit_task: Editar una tarea
  Entidades: taskTitle, title (opcional), priority (opcional), status (opcional)
- action_edit_material: Editar un material
  Entidades: materialName (texto), unitCost (número, opcional), stock (número, opcional), minStock (número, opcional)
- action_delete_task: Eliminar una tarea
  Entidades: taskTitle (texto)
- action_delete_material: Eliminar un material
  Entidades: materialName (texto)
- action_delete_transaction: Eliminar un gasto/ingreso
  Entidades: amount (número, opcional)
- action_trigger_workflow: Ejecutar un workflow
  Entidades: workflowName (texto)
- action_list_workflows: Listar workflows disponibles
- action_export_data: Exportar datos del sistema
  Entidades: type (gastos|materiales|obras|tareas|proveedores, opcional)

EJEMPLOS DE MENSAJES COMPUESTOS:
- "crea una obra llamada amarras center y agregale 2 bolsas de clavos, 4 bolsas de cemento" → intents: [{intent:"action_create_project_direct",entities:{name:"amarras center"}},{intent:"action_add_materials",entities:{items:[{qty:2,unit:"bolsas",name:"clavos 22mm"},{qty:4,unit:"bolsas",name:"cemento 20kg"}]}}]
- "crea la obra Casa Garcia con presupuesto 2000000 para Juan Garcia" → intent único

Responde SOLO con JSON. Para intent único:
{
  "intent": "nombre_del_intent",
  "confidence": 0.95,
  "entities": { "key": "value" },
  "explanation": "Por qué crees que esta es la intención",
  "isCompound": false
}

Para mensajes compuestos (2 intenciones):
{
  "intent": "compound",
  "confidence": 0.9,
  "entities": {},
  "explanation": "El mensaje contiene dos acciones",
  "isCompound": true,
  "compoundIntents": [
    { "intent": "action_create_project_direct", "entities": { "name": "amarras center" } },
    { "intent": "action_add_materials", "entities": { "items": [{ "qty": 2, "unit": "bolsas", "name": "clavos 22mm" }] } }
  ]
}`;

  try {
    let contextMessages: GroqMessage[] = [];

    // Agregar mensajes recientes como contexto si existen
    if (context?.recentMessages && context.recentMessages.length > 0) {
      contextMessages = context.recentMessages.slice(-4).map((msg) => ({
        role: "user" as const,
        content: msg,
      }));
    }

    const result = await chatWithGroq(userMessage, {
      systemPrompt,
      model: "llama-3.1-8b-instant", // Modelo rápido para parsing
      temperature: 0.1,
      maxTokens: 512,
      messages: contextMessages.length > 0 ? contextMessages : undefined,
    });

    if (!result.success) return null;

    // Extraer JSON de la respuesta
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      intent: parsed.intent || "unknown",
      confidence: parsed.confidence || 0,
      entities: parsed.entities || {},
      explanation: parsed.explanation || "",
    };
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

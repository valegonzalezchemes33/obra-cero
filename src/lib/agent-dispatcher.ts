// ============================================================
// AGENT DISPATCHER — Bridge between Groq NLU and local handlers
// ============================================================
// Groq entiende el mensaje y extrae entidades → este módulo
// construye un ParsedCommand sintético y llama dispatchByIntent()
// del agente local. SIN duplicar la lógica de los handlers.
//
// Esto permite que Groq y el agente interno TRABAJEN JUNTOS:
//   Groq: entiende, extrae entidades, enriquece con datos reales
//   Agente local: ejecuta la acción con las entidades de Groq
// ============================================================

import { db } from "@/lib/db";
import {
  normalize,
  dispatchByIntent,
  type Intent,
  type ParsedCommand,
  type AgentResponse,
} from "./agent";

// ─── Crear ParsedCommand sintético desde intent + entities ───

export function createSyntheticParsedCommand(
  intent: Intent,
  entities: Record<string, any>,
  rawText: string,
  confidence = 1.0
): ParsedCommand {
  return {
    intent,
    rawText,
    normalized: normalize(rawText),
    entities: entities as Record<string, string | number | undefined>,
    confidence,
  };
}

// ─── Procesar mensaje con intent y entities pre-determinados (desde Groq) ───
// Esta función evita que el NLU local re-parsee el mensaje.
// Groq ya entendió y extrajo entidades — solo creamos un ParsedCommand
// y ejecutamos el dispatch central del agente interno.

export async function processMessageWithIntent(
  intent: Intent,
  entities: Record<string, any>,
  rawText: string,
  groqConfidence = 0.8
): Promise<AgentResponse> {
  const parsed = createSyntheticParsedCommand(intent, entities, rawText, groqConfidence);

  // Guardar mensaje del usuario con intent de Groq
  try {
    await db.agentMessage.create({
      data: {
        role: "user",
        content: rawText.slice(0, 5000),
        intent,
        meta: JSON.stringify({
          _groqConfidence: groqConfidence,
          _groqEntities: entities,
        }).slice(0, 4000),
      },
    });
  } catch {}

  // ✅ Ejecutar el handler real del agente, SIN re-parsar con NLU local
  // dispatchByIntent usa el switch de agent.ts con todos los respond*()
  const response = await dispatchByIntent(parsed, rawText);

  // Guardar respuesta del agente
  try {
    await db.agentMessage.create({
      data: {
        role: "agent",
        content: response.text.slice(0, 5000),
        intent,
        meta: response.data ? JSON.stringify(response.data).slice(0, 4000) : null,
      },
    });
  } catch {}

  return response;
}

// ─── Procesar consulta con datos reales + Groq enrichment ───
// Para queries (query_*, predict_*, etc.):
// 1. Ejecuta dispatchByIntent() para obtener DATOS REALES de la BD
// 2. Pasa esos datos a Groq para generar una respuesta natural y enriquecida
// 3. Si Groq falla, usa la respuesta del handler local

export async function enrichQueryWithGroq(
  intent: Intent,
  entities: Record<string, any>,
  rawText: string,
  groqConfidence: number,
  recentMessages: string[]
): Promise<AgentResponse> {
  // 1. Ejecutar handler real para obtener datos frescos de la BD
  const localResponse = await processMessageWithIntent(intent, entities, rawText, groqConfidence);

  // 2. Intentar enriquecer con Groq usando los datos reales
  try {
    const { isGroqAvailable, tryGroqEnhancedResponse } = await import("./groq-integration");
    const available = await isGroqAvailable();

    if (available && localResponse.data) {
      const dbData = {
        intent,
        handlerData: localResponse.data,
        handlerText: localResponse.text,
      };

      const groqResponse = await tryGroqEnhancedResponse(
        rawText,
        intent,
        dbData,
        recentMessages
      );

      if (groqResponse && groqResponse.text) {
        return {
          ...localResponse,
          text: groqResponse.text,
          _groqEnhanced: true,
          _groqConfidence: groqConfidence,
          suggestions: localResponse.suggestions || groqResponse.suggestions,
        };
      }
    }

    if (available) {
      const groqResponse = await tryGroqEnhancedResponse(
        rawText,
        intent,
        { intent, handlerText: localResponse.text },
        recentMessages
      );
      if (groqResponse && groqResponse.text) {
        return {
          ...localResponse,
          text: groqResponse.text,
          _groqEnhanced: true,
        };
      }
    }
  } catch {
    // Groq falló, usar respuesta local
  }

  return localResponse;
}

// ─── Procesar mensaje COMPUESTO (múltiples intents) ───
// Ejecuta varios handlers en secuencia y combina las respuestas
// Útil para: "crear obra X + agregar materiales" en un solo mensaje


export async function processCompoundMessage(
  intents: Array<{ intent: Intent; entities: Record<string, any> }>,
  rawText: string,
): Promise<AgentResponse> {
  if (intents.length === 0) {
    return { text: "No entendí qué acciones realizar.", intent: "unknown" as Intent };
  }

  if (intents.length === 1) {
    return await processMessageWithIntent(intents[0].intent, intents[0].entities, rawText, 0.9);
  }

  const responses: AgentResponse[] = [];
  let lastResponse: AgentResponse | null = null;
  // Acumular entidades de todos los intents anteriores para referencias cruzadas
  let accumulatedEntities: Record<string, any> = {};

  for (let i = 0; i < intents.length; i++) {
    const { intent, entities } = intents[i];
    const mergedEntities = { ...entities };

    // Si el intent anterior creó un proyecto, pasar su código al siguiente intent
    if (lastResponse?.data?.project?.code) {
      if (
        intent === "action_add_materials" ||
        intent === "action_add_stock_movement" ||
        intent === "action_create_expense" ||
        intent === "action_create_income" ||
        intent === "action_create_task" ||
        intent === "action_update_project_progress" ||
        intent === "action_update_project_status"
      ) {
        mergedEntities.projectRef = lastResponse.data.project.code;
        mergedEntities.projectName = lastResponse.data.project.name;
      }
    }

    // Si el intent actual es agregar materiales y no tiene items propios,
    // buscar items en los intents anteriores (para mensajes como "crear obra X. Materiales: ...")
    if (intent === "action_add_materials" && (!mergedEntities.items || mergedEntities.items.length === 0)) {
      const prevMaterials = intents.slice(0, i).find(
        (pi) => pi.entities?.items && pi.entities.items.length > 0
      );
      if (prevMaterials?.entities?.items) {
        mergedEntities.items = prevMaterials.entities.items;
      }
    }

    // Acumular entidades para referencias futuras
    accumulatedEntities = { ...accumulatedEntities, ...mergedEntities };

    const response = await processMessageWithIntent(intent, mergedEntities, rawText, 0.9);
    responses.push(response);
    lastResponse = response;
  }

  // Combinar todas las respuestas en una sola
  const combinedText = responses
    .map((r, i) => (i === 0 ? r.text : `---\n${r.text}`))
    .join("\n\n");

  const allSuggestions = [...new Set(responses.flatMap((r) => r.suggestions || []))].slice(0, 4);

  return {
    text: combinedText,
    intent: intents[0].intent,
    data: {
      compound: true,
      individualResponses: responses.map((r) => ({ intent: r.intent, data: r.data })),
    },
    suggestions: allSuggestions.length > 0 ? allSuggestions : ["¿Cómo vamos?", "Ver obras"],
  };
}

// ─── Enriquecer respuesta de ACCIÓN con Groq ───
// Para acciones (crear obra, agregar materiales, etc.),
// usa Groq para dar una respuesta más natural y completa

export async function enrichActionResponseWithGroq(
  localResponse: AgentResponse,
  rawText: string,
  intent: Intent,
  entities: Record<string, any>,
  recentMessages: string[]
): Promise<AgentResponse> {
  try {
    const { isGroqAvailable, tryGroqEnhancedResponse } = await import("./groq-integration");
    const available = await isGroqAvailable();
    if (!available) return localResponse;

    const dbData = {
      intent,
      handlerData: localResponse.data || {},
      handlerText: localResponse.text,
    };

    const groqResponse = await tryGroqEnhancedResponse(rawText, intent, dbData, recentMessages);
    if (groqResponse && groqResponse.text) {
      return {
        ...localResponse,
        text: groqResponse.text,
        _groqEnhanced: true,
        _groqActionEnhanced: true,
        suggestions: localResponse.suggestions || groqResponse.suggestions,
      };
    }
  } catch {
    // Fallback a respuesta local
  }

  return localResponse;
}

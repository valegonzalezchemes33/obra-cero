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
      // Pasar a Groq los datos reales que devolvió el handler
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
          // Preservar las sugerencias específicas del handler local
          suggestions: localResponse.suggestions || groqResponse.suggestions,
        };
      }
    }

    // Sin datos en la respuesta: intentar igual con el texto del handler
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

// ============================================================
// ENDPOINT DE STREAMING — Respuestas del agente en tiempo real
// ============================================================
// Solo streamea respuestas de CONSULTA (preguntas, análisis).
// Mensajes que mutan datos (crear, editar, eliminar) se
// redirigen automáticamente al endpoint POST normal (JSON).
// ============================================================

import { NextRequest } from "next/server";
import { tryGroqIntentRecognition, getSystemContext } from "@/lib/groq-integration";
import { chatStream, getAvailableProviders } from "@/lib/llm-provider";
import { getConversationContext, getPendingAction, isConfirmation, isCancellation, clearPendingAction } from "@/lib/agent-memory";
import { requireAgentApiKey, agentApiKeyRequiredResponse } from "@/lib/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Palabras clave que indican que el mensaje muta datos
const MUTATION_PATTERNS = [
  /^(crear|registrar|agregar|dar de alta|nuev[ao])\b/i,
  /^(editar|modificar|cambiar|actualizar|poner|marcar)\b/i,
  /^(eliminar|borrar|sacar|remover|cerrar|finalizar|completar)\b/i,
  /\b(generar pedido|ejecutar workflow)\b/i,
];

function isMutationMessage(message: string): boolean {
  return MUTATION_PATTERNS.some((p) => p.test(message.trim()));
}

export async function POST(req: NextRequest) {
  if (!requireAgentApiKey(req)) return agentApiKeyRequiredResponse();
  try {
    const body = await req.json();
    const rawMessage: string = body.message || "";
    if (!rawMessage.trim()) {
      return new Response(JSON.stringify({ error: "Mensaje vacío" }), { status: 400 });
    }

    const { normalizeMessage } = await import("@/lib/agent-nlu");
    const normalizationResult = normalizeMessage(rawMessage);
    const message = normalizationResult.normalized;

    // ─── Verificar si hay una acción pendiente de confirmación ───
    const pendingAction = await getPendingAction();
    if (pendingAction) {
      if (isConfirmation(message)) {
        await clearPendingAction();
        const { processAgentMessage } = await import("@/lib/agent");
        const response = await processAgentMessage(pendingAction.originalText);
        return new Response(JSON.stringify({
          ...response,
          text: `✅ **Confirmado.**\n\n${response.text}`,
          _confirmed: true,
          suggestions: response.suggestions || ["¿Cómo vamos?", "¿Qué alertas hay?", "Recomendaciones"],
        }), { headers: { "Content-Type": "application/json" } });
      }
      if (isCancellation(message)) {
        await clearPendingAction();
        return new Response(JSON.stringify({
          text: "❌ **Acción cancelada.** No se realizó ningún cambio. ¿Necesitás algo más?",
          intent: pendingAction.intent,
          _cancelled: true,
          suggestions: ["¿Cómo vamos?", "¿Qué alertas hay?", "Recomendaciones"],
        }), { headers: { "Content-Type": "application/json" } });
      }
    }

    // ─── Seguridad: mensajes que mutan datos → ejecutar con processAgentMessage directo ───
    if (isMutationMessage(rawMessage)) {
      const { processAgentMessage } = await import("@/lib/agent");
      const response = await processAgentMessage(message);
      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ─── Streaming: solo para consultas y análisis ───

    // Preparar contexto
    const ctx = await getConversationContext();
    const recentMessages = ctx.recentMessages?.map(m => m.content) || [];

    // Intentar con Groq primero (NLU principal)
    const groqResult = await tryGroqIntentRecognition(rawMessage, recentMessages);

    if (groqResult.success && groqResult.intent && groqResult.intent !== "unknown" && (groqResult.confidence || 0) >= 0.4) {
      // Groq entendió — streamear respuesta
      const systemContext = await getSystemContext();
      const systemContextStr = [
        "DATOS DEL SISTEMA:",
        `- Gastos totales: $${systemContext.financialSummary.totalExpenses}`,
        `- Materiales en inventario: ${systemContext.stockSummary.totalMaterials}`,
        `- Proyectos activos: ${systemContext.projectSummary.active} de ${systemContext.projectSummary.total}`,
        `- Intención detectada: ${groqResult.intent}`,
        `- Confianza: ${(groqResult.confidence || 0) * 100}%`,
      ].join("\n");

      const systemPrompt = `Eres el asistente virtual de una constructora llamada "ObraCero".
Respondé en español argentino, natural y conversacional.
Sé conciso (máximo 3 párrafos), profesional pero cálido.
Usá emojis moderadamente.

${systemContextStr}

IMPORTANTE:
- No inventes datos que no estén en el contexto
- Si no hay datos suficientes, decíselo al usuario
- Respondé de forma natural, como si fueras un asistente humano`;

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();

          // Enviar metadatos primero
          const providers = await getAvailableProviders();
          const metadata = JSON.stringify({
            type: "meta",
            intent: groqResult.intent,
            confidence: groqResult.confidence,
            provider: providers[0]?.label || "Groq",
          });
          controller.enqueue(encoder.encode(`data: ${metadata}\n\n`));

          // Streamear la respuesta token por token
          let fullContent = "";
          await chatStream(rawMessage, systemPrompt, (token) => {
            fullContent += token;
            const payload = JSON.stringify({ type: "token", content: token });
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          }, { temperature: 0.7, maxTokens: 1024 });

          // Sugerencias
          const suggestions = ["¿Cómo vamos?", "¿Qué alertas hay?", "Recomendaciones"];
          const donePayload = JSON.stringify({
            type: "done",
            content: fullContent,
            intent: groqResult.intent,
            suggestions,
          });
          controller.enqueue(encoder.encode(`data: ${donePayload}\n\n`));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Fallback: NLU local → respuesta normal como JSON
    const { processAgentMessage } = await import("@/lib/agent");
    const response = await processAgentMessage(rawMessage);

    return new Response(JSON.stringify({
      ...response,
      _streaming: false,
      _localNLU: true,
      suggestions: ["¿Cómo vamos?", "¿Qué alertas hay?", "Recomendaciones"],
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[STREAM] Error:", error.message);
    return new Response(JSON.stringify({
      error: error.message || "Error interno",
      text: "Ocurrió un error al procesar el mensaje. Intentalo de nuevo.",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

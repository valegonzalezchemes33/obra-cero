import { NextRequest, NextResponse } from "next/server";
import { processAgentMessage, runAutomations, parseIntent, dispatchByIntent } from "@/lib/agent";
import type { Intent, ParsedCommand } from "@/lib/agent";
import { processExtendedMessage, findClosestIntent, generateSmartUnknownResponse } from "@/lib/agent-extended";
import {
  getConversationContext,
  resolveReferences,
  getPendingAction,
  clearPendingAction,
  savePendingAction,
  saveContextMetadata,
  isConfirmation,
  isCancellation,
  requiresConfirmation,
  generateActionSummary,
  type ConversationContext,
  type PendingAction,
} from "@/lib/agent-memory";
import { normalizeMessage } from "@/lib/agent-nlu";
import { tryGroqCompoundIntent } from "@/lib/groq-integration";
import {
  getActionPromptConfig,
  getActionSection,
  generateContextualWarning,
  generateExecutionGuide
} from "@/lib/agent-action-prompts";
import {
  intentToTool,
  toolToIntent,
  validateToolArgs,
  getRiskLevel,
} from "@/lib/tool-registry";
import { requireAgentApiKey, agentApiKeyRequiredResponse } from "@/lib/api-utils";
import { apiLogger } from "@/lib/logger";

// ─── Helper: Obtener labels amigables para campos faltantes ───

function getFieldLabels(intent: Intent, fields: string[]): string {
  const config = getActionPromptConfig(intent);
  
  return fields
    .map((field) => config.fieldLabels[field] || field)
    .join(", ");
}

// ─── Helper: Obtener pista de un campo ───

function getFieldHint(intent: Intent, field: string): string {
  const config = getActionPromptConfig(intent);
  return config.fieldHints[field] || "";
}

// ─── Helper: Reconstruir mensaje en lenguaje natural para el NLU ───

function reconstructMessageForNLU(intent: Intent, entities: Record<string, any>): string {
  const ref = entities.projectRef ? ` OB-${entities.projectRef}` : "";
  const refText = entities.projectRef ? ` para OB-${entities.projectRef}` : "";

  switch (intent) {
    case "action_create_expense":
      return `registrar gasto de $${entities.amount} en ${entities.category || "materiales"}${refText}`;
    case "action_create_income":
      return `registrar ingreso de $${entities.amount}${refText}`;
    case "action_create_project_direct":
      return `crear obra "${entities.name}" presupuesto $${entities.budget || 0}${entities.clientName ? ` cliente ${entities.clientName}` : ""}`;
    case "action_create_supplier":
      return `crear proveedor: ${entities.name}${entities.phone ? ` tel: ${entities.phone}` : ""}${entities.category ? ` rubro: ${entities.category}` : ""}`;
    case "action_close_project":
      return `cerrar obra${ref}`;
    case "action_add_materials":
      // Para materiales, usar el texto original si existe porque contiene la lista de items
      if (entities.originalText) return entities.originalText;
      return `crea materiales: varios items${refText}`;
    case "action_complete_task":
      return `completar tarea: ${entities.taskTitle || "pendiente"}`;
    case "action_add_stock_movement":
      // Usar texto original si existe para preservar detalles del movimiento
      if (entities.originalText) return entities.originalText;
      return `registrar entrada de materiales${refText}`;
    case "action_update_project_status":
      return `poner obra${ref} como ${entities.status || "activa"}`;
    case "action_update_project_progress":
      return `actualizar avance de obra${ref} al ${entities.progress || 50}%`;
    case "action_reorder":
      return `generar pedido de compra`;
    default:
      return entities.originalText || `ejecutar ${intent}`;
  }
}

// ─── Helper: Generar texto de preview sin ejecutar la acción ───

function getRequiredActionFields(intent: Intent): string[] {
  const config = getActionPromptConfig(intent);
  return config.requiredFields;
}

function generatePreviewText(intent: Intent, entities: Record<string, any>): string {
  const config = getActionPromptConfig(intent);
  const section = config.section;
  
  switch (intent) {
    case "action_create_expense":
      return `${section}\n📝 Se **registrará un gasto** de **$${entities.amount}** en la categoría **${entities.category || "general"}**${entities.projectRef ? ` para la obra **OB-${entities.projectRef}**` : ""}.`;
    case "action_create_income":
      return `${section}\n📝 Se **registrará un ingreso** de **$${entities.amount}**${entities.projectRef ? ` para la obra **OB-${entities.projectRef}**` : ""}.`;
    case "action_create_project_direct":
      return `${section}\n📝 Se **creará una obra nueva** con nombre **"${entities.name}"**${entities.budget ? `, presupuesto **$${entities.budget}**` : ""}${entities.clientName ? `, cliente **${entities.clientName}**` : ""}.\n\nSe asignará automáticamente un código único **OB-XXX**.`;
    case "action_create_supplier":
      return `${section}\n📝 Se **creará un proveedor** con nombre **"${entities.name}"**.`;
    case "action_close_project":
      return `${section}\n📝 Se **cerrará la obra** **OB-${entities.projectRef}**. Se marcará como **FINALIZADA** con **100%** de avance.`;
    case "action_add_materials":
      return `${section}\n📝 Se **agregarán materiales** al inventario${entities.projectRef ? ` para la obra **OB-${entities.projectRef}**` : ""}.`;
    case "action_complete_task":
      return `${section}\n📝 Se **marcará como completada** la tarea **"${entities.taskTitle || "(pendiente)"}"**.`;
    case "action_add_stock_movement":
      return `${section}\n📝 Se **registrará un movimiento de stock** de ${entities.quantity || "cierta"} ${entities.unit || "unidades"} del material **${entities.materialName || "(pendiente)"}**.`;
    case "action_update_project_status":
      return `${section}\n📝 Se **cambiará el estado** de la obra **OB-${entities.projectRef}** a **${entities.status || "nuevo estado"}**.`;
    case "action_update_project_progress":
      return `${section}\n📝 Se **actualizará el avance** de la obra **OB-${entities.projectRef}** al **${entities.progress}%**.`;
    case "action_reorder":
      return `${section}\n📝 Se **generará un pedido de compra** con los materiales que están por debajo del stock mínimo.`;
    case "action_edit_project":
      return `${section}\n📝 Se **editará la obra** **OB-${entities.projectRef}**${entities.name ? ` con nuevo nombre **"${entities.name}"**` : ""}.`;
    case "action_edit_task":
      return `${section}\n📝 Se **editará la tarea** **"${entities.taskTitle}"**.`;
    case "action_edit_material":
      return `${section}\n📝 Se **editará el material** **"${entities.materialName}"**.`;
    case "action_delete_task":
      return `${section}\n⚠️ Se **ELIMINARÁ la tarea** **"${entities.taskTitle}"**. Esta acción NO se puede deshacer.`;
    case "action_delete_material":
      return `${section}\n⚠️ Se **ELIMINARÁ el material** **"${entities.materialName}"**. Esta acción NO se puede deshacer.`;
    case "action_delete_transaction":
      return `${section}\n⚠️ Se **ELIMINARÁ la transacción** de **$${entities.amount}**. Esta acción NO se puede deshacer.`;
    case "action_trigger_workflow":
      return `${section}\n⚙️ Se **ejecutará el workflow** **"${entities.workflowName}"**.`;
    case "action_create_task":
      return `${section}\n📝 Se **creará una nueva tarea** con descripción **"${entities.title || "(pendiente)"}"**.`;
    default:
      return `${section}\n📝 Se ejecutará la acción solicitada.`;
  }
}

// POST /api/agent - Enviar mensaje al agente (con memoria y confirmación)
export async function POST(req: NextRequest) {
  if (!requireAgentApiKey(req)) return agentApiKeyRequiredResponse();
  try {
    const body = await req.json();
    const rawMessage: string = body.message || "";
    if (!rawMessage.trim()) {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
    }

    const { db } = await import("@/lib/db");
    const { getTenantSafe } = await import("@/lib/tenant");
    const tenantCtx = await getTenantSafe();
    const orgId = tenantCtx?.organizationId ?? "default";

    // Helper para guardar mensajes en la BD
    async function saveMessage(role: "user" | "agent", content: string, intent?: string, meta?: any) {
      try {
        await db.agentMessage.create({
          data: {
            role,
            content: content.slice(0, 5000),
            intent: intent || null,
            meta: meta ? JSON.stringify(meta).slice(0, 4000) : null,
            organizationId: orgId,
          },
        });
      } catch (e) { apiLogger.warn({ module: "api-agent-route" }, "catch swallowed: guardar mensaje del agente en BD") }
    }

    // 0. Normalizar mensaje (traducir variaciones del lenguaje natural)
    const normalizationResult = normalizeMessage(rawMessage);
    const message = normalizationResult.normalized;
    const wasNormalized = normalizationResult.wasNormalized;

    // 1. Cargar contexto conversacional
    const ctx: ConversationContext = await getConversationContext();

    // 2. Verificar si hay una acción pendiente
    const pendingAction: PendingAction | null = await getPendingAction();

    // 3. Verificar si es confirmación o cancelación
    if (pendingAction) {
      if (isConfirmation(message)) {
        // ✅ El usuario confirmó - ejecutar la acción pendiente
        await clearPendingAction();

        // Reconstruir el mensaje en formato natural que el NLU pueda re-parsear
        const allEntities = { ...pendingAction.collectedEntities };
        const reconstructedMessage = reconstructMessageForNLU(pendingAction.intent, allEntities);

        const response = await processAgentMessage(reconstructedMessage);
        return NextResponse.json({
          ...response,
          text: `✅ **Confirmado.**\n\n${response.text}`,
          _confirmed: true,
        });
      } else if (isCancellation(message)) {
        // ❌ El usuario canceló
        await clearPendingAction();
        return NextResponse.json({
          text: `❌ **Acción cancelada.** No se realizó ningún cambio. ¿Necesitás algo más?`,
          intent: pendingAction.intent,
          suggestions: ["¿Cómo vamos?", "¿Qué alertas hay?", "Recomendaciones"],
        });
      } else {
        // El usuario respondió algo que no es confirmación ni cancelación
        // Podría ser un dato faltante (ej: "50000" cuando pregunté por el monto)
        // O podría ser un mensaje nuevo. Intentamos detectar si completa la acción pendiente

        // Verificar si el mensaje contiene datos que completan la acción
        const mergedEntities = { ...pendingAction.collectedEntities };
        let completedFields = 0;

        // Intentar extraer monto
        const amountMatch = message.match(/\$?\s*([\d.,]+)\s*(?:pesos|\$|ars)?/i);
        if (amountMatch && pendingAction.missingFields.includes("amount")) {
          mergedEntities.amount = parseFloat(amountMatch[1].replace(/[,]/g, ""));
          completedFields++;
        }

        // Intentar extraer nombre
        if (pendingAction.missingFields.includes("name")) {
          mergedEntities.name = message.trim();
          completedFields++;
        }

        // Intentar extraer categoría
        const categoryMatch = message.match(/(materiales|mano\s*de\s*obra|servicios?|equipos?|alquiler|transporte|otros?)/i);
        if (categoryMatch && pendingAction.missingFields.includes("category")) {
          mergedEntities.category = categoryMatch[1].toLowerCase();
          completedFields++;
        }

        if (completedFields > 0) {
          // Actualizar missing fields y ejecutar
          const newMissing = pendingAction.requiredFields.filter(
            (f) => !mergedEntities[f] && mergedEntities[f] !== 0
          );

          if (newMissing.length === 0) {
            // Ya tenemos todos los datos - ejecutar
            await clearPendingAction();
            const reconstructedMessage = pendingAction.originalText +
              Object.entries(mergedEntities)
                .filter(([k, v]) => v !== undefined)
                .map(([k, v]) => ` ${k}:${v}`)
                .join("");
            const response = await processAgentMessage(reconstructedMessage);
            return NextResponse.json({
              ...response,
              text: response.text,
              _completed: true,
            });
          } else {
            // Todavía faltan campos
            const updatedAction: PendingAction = {
              ...pendingAction,
              collectedEntities: mergedEntities,
              missingFields: newMissing,
              timestamp: Date.now(),
            };
            await savePendingAction(updatedAction);
            
            const config = getActionPromptConfig(pendingAction.intent);
            const fieldsList = getFieldLabels(pendingAction.intent, newMissing);
            const firstMissingField = newMissing[0];
            const hint = getFieldHint(pendingAction.intent, firstMissingField);
            
            return NextResponse.json({
              text: `Necesito que me digas **${fieldsList}** para completar la acción.\n\n${hint ? `💡 Ejemplo: **${hint}**` : ""}`,
              intent: pendingAction.intent,
              _pendingAction: updatedAction,
              suggestions: ["Cancelar"],
            });
          }
        }
      }
    }

    // 4. Cargar contexto para Groq
    const recentCtx = await getConversationContext();
    const recentMessages = recentCtx.recentMessages?.map(m => `${m.role}: ${m.content}`) || [];

    // 4.5 Interceptor de follow-ups con pronombres/referencias
    // Si el usuario dice "agrega eso", "solo eso", "agrégalos", "ponlos", etc.
    // y hay materiales en el contexto previo → ejecutar directamente con esos items
    const isFollowUpReference = /^(?:solo\s+)?(?:agrega(?:los?|les?)?|ponlos?|carga(?:los?)?|agreg[áa](?:los?)?|s[íi],?\s+(?:agrega(?:los?)?)?|ese[s]?|eso[s]?\s+(?:por\s+ahora)?|nada\s+m[áa]s|est[áa]\s+todo|agregalos?|ok\s+agrega|listo\s+agrega|s[íi]\s+(?:eso[s]?|los?|ese[s]?)?\s+por\s+ahora|solo\s+eso|eso\s+por\s+ahora|agrega\s+eso[s]?)\s*(?:por\s+ahora|nada\s+m[áa]s|as[íi])?\s*[.!]?$/i.test(rawMessage.trim());

    if (isFollowUpReference && recentCtx.lastEntities?.items && Array.isArray(recentCtx.lastEntities.items) && recentCtx.lastEntities.items.length > 0) {
      const { processMessageWithIntent } = await import("@/lib/agent-dispatcher");
      const followUpEntities = {
        items: recentCtx.lastEntities.items,
        projectRef: recentCtx.lastProjectRef || recentCtx.lastEntities?.projectRef,
        projectName: recentCtx.lastProjectName || recentCtx.lastEntities?.projectName,
      };
      const followUpResponse = await processMessageWithIntent(
        "action_add_materials" as Intent,
        followUpEntities,
        rawMessage,
        0.95
      );
      await saveContextMetadata(followUpResponse, followUpEntities);
      return NextResponse.json({
        ...followUpResponse,
        _followUpResolved: true,
      });
    }

    // 5. Groq como NLU PRINCIPAL — intentar entender el mensaje con IA primero
    // Se pasa el contexto de memoria para que Groq pueda resolver referencias
    // como "esa obra" o "esos materiales" usando el historial de conversación.
    try {
      const conversationContext = {
        lastProjectRef: recentCtx.lastProjectRef,
        lastProjectName: recentCtx.lastProjectName,
        lastMaterialName: recentCtx.lastMaterialRef,
        lastEntities: recentCtx.lastEntities,
      };
      const compoundResult = await tryGroqCompoundIntent(rawMessage, recentMessages, conversationContext);

      if (compoundResult.success && compoundResult.intents && compoundResult.intents.length > 0) {
        const { processCompoundMessage, enrichActionResponseWithGroq } = await import("@/lib/agent-dispatcher");

        // Si es múltiples intents, ejecutar secuencialmente
        if (compoundResult.intents.length > 1) {
          const compoundResponse = await processCompoundMessage(
            compoundResult.intents.map(i => ({ intent: i.intent as Intent, entities: i.entities })),
            rawMessage
          );
          await saveContextMetadata(compoundResponse, compoundResult.intents[0]?.entities || {});
          return NextResponse.json({
            ...compoundResponse,
            _groqEnhanced: true,
            _groqCompound: true,
            _groqConfidence: compoundResult.intents[0]?.confidence || 0.8,
          });
        }

        // Si es un único intent, procesarlo
        const singleIntent = compoundResult.intents[0];

        // Validación temprana con tool-registry: si los args Groq son inválidos,
        // avisamos antes de ejecutar y devolvemos el error tipado.
        const toolName = intentToTool[singleIntent.intent as Intent];
        if (toolName) {
          const validation = validateToolArgs(toolName, singleIntent.entities || {});
          if (!validation.ok) {
            return NextResponse.json({
              text: `❌ Parámetros inválidos para **${toolName}**:\n\n${validation.errors.map((e) => `• ${e}`).join("\n")}`,
              intent: singleIntent.intent,
              _tool: toolName,
              _riskLevel: getRiskLevel(toolName),
              _validationErrors: validation.errors,
              _groqEnhanced: true,
              suggestions: ["Ayuda"],
            });
          }
        }

        if (singleIntent.intent.startsWith("action_")) {
          const { processMessageWithIntent } = await import("@/lib/agent-dispatcher");
          const response = await processMessageWithIntent(
            singleIntent.intent as Intent,
            singleIntent.entities || {},
            rawMessage,
            singleIntent.confidence || 0.8
          );
          await saveContextMetadata(response, singleIntent.entities || {});

          const enrichedResponse = await enrichActionResponseWithGroq(
            response,
            rawMessage,
            singleIntent.intent as Intent,
            singleIntent.entities || {},
            recentMessages
          );

          return NextResponse.json({
            ...enrichedResponse,
            _groqEnhanced: true,
            _groqIntent: singleIntent.intent,
            _groqConfidence: singleIntent.confidence,
          });
        }

        // Para consultas (query_*), enriquecer con Groq usando datos reales
        const { enrichQueryWithGroq } = await import("@/lib/agent-dispatcher");
        const enrichedResponse = await enrichQueryWithGroq(
          singleIntent.intent as Intent,
          singleIntent.entities || {},
          rawMessage,
          singleIntent.confidence || 0.8,
          recentMessages
        );
        await saveContextMetadata(enrichedResponse, singleIntent.entities || {});
        return NextResponse.json({
          ...enrichedResponse,
          _groqEnhanced: true,
          _groqIntent: singleIntent.intent,
          _groqConfidence: singleIntent.confidence,
        });
      }
    } catch {
      // Groq falló, continuar con siguientes pasos
    }

    // 6. Si Groq no manejó, intentar con el agente extendido (editar, eliminar, workflows)
    const extendedResult = await processExtendedMessage(message, rawMessage);
    if (extendedResult.wasExtended) {
      return NextResponse.json(extendedResult.response);
    }

    // 7. Fallback: NLU local si ni Groq ni extended handlers entendieron
    const parsed = parseIntent(message);

    // Verificar si la acción requiere confirmación o datos faltantes
    const entities = resolveReferences(message, parsed.entities, ctx);
    const requiredFields = getRequiredActionFields(parsed.intent);
    const missingFields = requiredFields.filter(
      (field) => entities[field] === undefined || entities[field] === "" || entities[field] === null
    );

    // 7a. Validación de tool: si el intent es una tool conocida, validamos los
    // args con Zod antes de continuar, y enriquecemos la respuesta con riskLevel.
    const toolName = intentToTool[parsed.intent];
    if (toolName) {
      const validation = validateToolArgs(toolName, entities);
      const riskLevel = getRiskLevel(toolName);

      if (!validation.ok) {
        return NextResponse.json({
          text: `❌ Parámetros inválidos para **${toolName}**:\n\n${validation.errors.map((e) => `• ${e}`).join("\n")}`,
          intent: parsed.intent,
          _tool: toolName,
          _riskLevel: riskLevel,
          _validationErrors: validation.errors,
          suggestions: ["Ayuda"],
        });
      }
    }

    if (missingFields.length > 0) {
      const pending: PendingAction = {
        intent: parsed.intent,
        collectedEntities: entities,
        requiredFields,
        missingFields,
        prompt: generateActionSummary(parsed.intent, entities),
        originalText: message,
        timestamp: Date.now(),
      };

      await savePendingAction(pending);
      const fieldsList = getFieldLabels(parsed.intent, missingFields);
      const firstMissingField = missingFields[0];
      const hint = getFieldHint(parsed.intent, firstMissingField);

      return NextResponse.json({
        text: `Necesito que me digas **${fieldsList}** para completar la acción.\n\n${hint ? `💡 Ejemplo: **${hint}**` : ""}`,
        intent: parsed.intent,
        _pendingAction: pending,
        suggestions: ["Cancelar"],
      });
    }

    const requiresConfirm = requiresConfirmation(parsed.intent);
    if (requiresConfirm) {
      const pending: PendingAction = {
        intent: parsed.intent,
        collectedEntities: entities,
        requiredFields,
        missingFields: [],
        prompt: generateActionSummary(parsed.intent, entities),
        originalText: message,
        timestamp: Date.now(),
      };

      await savePendingAction(pending);
      const previewText = generatePreviewText(parsed.intent, entities);

      return NextResponse.json({
        text: `⚠️ **¿Confirmás esta acción?**\n\n${previewText}\n\n---\n\nRespondé **"sí"** para confirmar o **"no"** para cancelar.`,
        intent: parsed.intent,
        _requiresConfirmation: {
          action: pending.prompt,
          details: previewText,
          intent: parsed.intent,
          entities,
        },
        _pendingAction: pending,
        suggestions: ["Sí, confirmar", "No, cancelar"],
      });
    }

    // 8. Procesar con el motor local
    const response = await processAgentMessage(message);

    // 9. Si local también falló, smart matching
    if (response.intent === "unknown") {
      const closest = findClosestIntent(rawMessage);
      const smartResponse = generateSmartUnknownResponse(rawMessage, closest);
      return NextResponse.json(smartResponse);
    }

    // Guardar metadatos de contexto
    await saveContextMetadata(response, parsed.entities);

    return NextResponse.json(response);
  } catch (error: any) {
    apiLogger.error({ module: "API", path: "/api/agent" }, error.message)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// GET /api/agent - Correr automatizaciones y devolver acciones activas
export async function GET() {
  try {
    const { db } = await import("@/lib/db");
    const { getTenantSafe } = await import("@/lib/tenant");
    const tenantCtx = await getTenantSafe();
    const orgId = tenantCtx?.organizationId ?? "default";
    await runAutomations();
    const actions = await db.agentAction.findMany({
      where: { status: "active", organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ actions });
  } catch (error: any) {
    apiLogger.error({ module: "API", path: "/api/agent" }, error.message)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

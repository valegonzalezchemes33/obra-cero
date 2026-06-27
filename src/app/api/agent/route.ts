import { NextRequest, NextResponse } from "next/server";
import { processAgentMessage, runAutomations, parseIntent } from "@/lib/agent";
import type { Intent } from "@/lib/agent";
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
  switch (intent) {
    case "action_create_expense":
      return ["amount", "category"];
    case "action_create_income":
      return ["amount"];
    case "action_create_project_direct":
      return ["name"];
    case "action_create_supplier":
      return ["name"];
    case "action_close_project":
      return ["projectRef"];
    case "action_add_materials":
      return ["items"];
    case "action_complete_task":
      return ["taskTitle"];
    case "action_add_stock_movement":
      return ["type", "materialName", "quantity"];
    case "action_update_project_status":
      return ["projectRef", "status"];
    case "action_update_project_progress":
      return ["projectRef", "progress"];
    case "action_edit_project":
      return ["projectRef"];
    case "action_edit_task":
      return ["taskTitle"];
    case "action_edit_material":
      return ["materialName"];
    case "action_delete_task":
      return ["taskTitle"];
    case "action_delete_material":
      return ["materialName"];
    case "action_delete_transaction":
      return ["amount"];
    case "action_trigger_workflow":
      return ["workflowName"];
    default:
      return [];
  }
}

function generatePreviewText(intent: Intent, entities: Record<string, any>): string {
  switch (intent) {
    case "action_create_expense":
      return `📝 Se **registrará un gasto** de **$${entities.amount}** en la categoría **${entities.category || "general"}**${entities.projectRef ? ` para la obra **OB-${entities.projectRef}**` : ""}.`;
    case "action_create_income":
      return `📝 Se **registrará un ingreso** de **$${entities.amount}**${entities.projectRef ? ` para la obra **OB-${entities.projectRef}**` : ""}.`;
    case "action_create_project_direct":
      return `📝 Se **creará una obra** con nombre **"${entities.name}"**${entities.budget ? `, presupuesto **$${entities.budget}**` : ""}${entities.clientName ? `, cliente **${entities.clientName}**` : ""}.`;
    case "action_create_supplier":
      return `📝 Se **creará un proveedor** con nombre **"${entities.name}"**.`;
    case "action_close_project":
      return `📝 Se **cerrará la obra** OB-**${entities.projectRef}**. Se marcará como finalizada con 100% de avance.`;
    case "action_add_materials":
      return `📝 Se **agregarán materiales** al inventario${entities.projectRef ? ` para la obra **OB-${entities.projectRef}**` : ""}.`;
    case "action_complete_task":
      return `📝 Se **marcará como completada** la tarea **"${entities.taskTitle || "(pendiente)"}"**.`;
    case "action_add_stock_movement":
      return `📝 Se **registrará un movimiento de stock** de ${entities.quantity || "cierta"} ${entities.unit || "unidades"}.`;
    case "action_update_project_status":
      return `📝 Se **cambiará el estado** de la obra OB-**${entities.projectRef}** a **${entities.status || "nuevo estado"}**.`;
    case "action_update_project_progress":
      return `📝 Se **actualizará el avance** de la obra OB-**${entities.projectRef}** al **${entities.progress}%**.`;
    case "action_reorder":
      return `📝 Se **generará un pedido de compra** con los materiales que están por debajo del mínimo.`;
    default:
      return `📝 Se ejecutará la acción solicitada.`;
  }
}

// POST /api/agent - Enviar mensaje al agente (con memoria y confirmación)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawMessage: string = body.message || "";
    if (!rawMessage.trim()) {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
    }

    const { db } = await import("@/lib/db");

    // Helper para guardar mensajes en la BD
    async function saveMessage(role: "user" | "agent", content: string, intent?: string, meta?: any) {
      try {
        await db.agentMessage.create({
          data: {
            role,
            content: content.slice(0, 5000),
            intent: intent || null,
            meta: meta ? JSON.stringify(meta).slice(0, 4000) : null,
          },
        });
      } catch {}
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
            const fieldsList = newMissing
              .map((f) => {
                const labels: Record<string, string> = {
                  amount: "el monto ($)",
                  name: "el nombre",
                  category: "la categoría (materiales, mano de obra, servicios)",
                  projectRef: "la referencia de la obra",
                  title: "el título de la tarea",
                  budget: "el presupuesto",
                  clientName: "el nombre del cliente",
                  phone: "el teléfono",
                  email: "el email",
                  taskTitle: "el título de la tarea",
                  description: "la descripción",
                };
                return labels[f] || f;
              })
              .join(", ");
            return NextResponse.json({
              text: `Necesito que me digas **${fieldsList}** para completar la acción.`,
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
    const recentMessages = recentCtx.recentMessages?.map(m => m.content) || [];

    // 5. Groq como NLU PRINCIPAL — intentar entender el mensaje con IA primero
    // Groq puede detectar intents únicos o compuestos múltiples ("crear obra + agregar materiales")
    // Si Groq tiene éxito, retorna inmediatamente. Si falla, continua con los siguientes pasos.
    try {
      const compoundResult = await tryGroqCompoundIntent(rawMessage, recentMessages);

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
      const fieldsList = missingFields
        .map((field) => {
          const labels: Record<string, string> = {
            amount: "el monto ($)",
            category: "la categoría (materiales, mano de obra, servicios)",
            name: "el nombre",
            projectRef: "la referencia de la obra",
            items: "los materiales o items que querés agregar",
            taskTitle: "el título de la tarea",
            type: "si es entrada o salida",
            materialName: "el nombre del material",
            quantity: "la cantidad",
            status: "el nuevo estado",
            progress: "el porcentaje de avance",
            workflowName: "el nombre del workflow",
          };
          return labels[field] || field;
        })
        .join(", ");

      return NextResponse.json({
        text: `Necesito que me digas **${fieldsList}** para completar la acción.`,
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
    console.error("[API] POST /api/agent:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

// GET /api/agent - Correr automatizaciones y devolver acciones activas
export async function GET() {
  try {
    const { db } = await import("@/lib/db");
    await runAutomations();
    const actions = await db.agentAction.findMany({
      where: { status: "active" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ actions });
  } catch (error: any) {
    console.error("[API] GET /api/agent:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

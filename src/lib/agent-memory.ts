// ============================================================
// SISTEMA DE MEMORIA CONVERSACIONAL Y CONFIRMACIÓN
// ============================================================
// Este módulo extiende el agente con:
// - Memoria de contexto entre mensajes
// - Resolución de pronombres y referencias ("esa obra", "este mes")
// - Sistema de acciones pendientes (multi-turno)
// - Confirmación antes de acciones destructivas
// ============================================================

import { db } from "@/lib/db";
import type { Intent, AgentResponse, AgentActionItem } from "./agent";
import { agentLogger } from "@/lib/logger";

// ─── Tipos de Memoria ───

export interface ConversationContext {
  lastProjectRef?: string;
  lastProjectName?: string;
  lastMaterialRef?: string;
  lastMaterialName?: string;
  lastSupplierRef?: string;
  lastIntent?: Intent;
  lastEntities?: Record<string, any>;
  lastActionSummary?: string;
  recentMessages?: Array<{ role: string; content: string; intent?: string }>;
}

export interface PendingAction {
  intent: Intent;
  collectedEntities: Record<string, any>;
  requiredFields: string[];
  missingFields: string[];
  prompt: string;
  originalText: string;
  timestamp: number;
}

export interface ConfirmationRequest {
  action: string;
  details: string;
  intent: Intent;
  entities: Record<string, any>;
  summary: string;
}

// ─── Detectar afirmación/negación ───
// (Las funciones isConfirmation/isCancellation están definidas más abajo,
//  en la sección "Patrones compartidos de confirmación/cancelación".)

// ─── Cargar contexto de conversación ───

export async function getConversationContext(): Promise<ConversationContext> {
  try {
    const lastMessages = await db.agentMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const ctx: ConversationContext = {
      recentMessages: lastMessages
        .reverse()
        .map((m) => ({ role: m.role, content: m.content.slice(0, 1000), intent: m.intent || undefined })),
    };

    // Extraer contexto de los mensajes (de más reciente a más antiguo)
    for (const msg of lastMessages) {
      // Si es del agente y tiene meta, extraer referencias guardadas
      if (msg.role === "agent" && msg.meta) {
        try {
          const meta = JSON.parse(msg.meta);
          if (!ctx.lastProjectRef && meta.lastProjectRef) ctx.lastProjectRef = meta.lastProjectRef;
          if (!ctx.lastProjectName && meta.lastProjectName) ctx.lastProjectName = meta.lastProjectName;
          if (!ctx.lastMaterialRef && meta.lastMaterialRef) ctx.lastMaterialRef = meta.lastMaterialRef;
        } catch (e) { agentLogger.warn({ module: "agent-memory" }, "catch swallowed: extraer metadatos de contexto de mensajes del agente") }
      }

      // Si es del usuario, extraer referencias del texto
      if (msg.role === "user" && msg.content) {
        const content = msg.content;
        const projCode = content.match(/OB[-|\s]?(\d+)/i);
        if (projCode && !ctx.lastProjectRef) ctx.lastProjectRef = projCode[1];

        const projName = content.match(/(?:en\s+)?(?:la\s+)?obra\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]{2,30}?)(?:\s*(?:,|\.|;|:|\s+crea|\s+agrega|\s+del|\s+de\s+la|\s+para))/i);
        if (projName && !ctx.lastProjectName) ctx.lastProjectName = projName[1].trim();

        if (!ctx.lastIntent && msg.intent) ctx.lastIntent = msg.intent as Intent;
      }
    }

    return ctx;
  } catch {
    return {};
  }
}

// ─── Resolver referencias con contexto ───

export function resolveReferences(
  text: string,
  entities: Record<string, any>,
  ctx: ConversationContext
): Record<string, any> {
  const resolved = { ...entities };
  const normalized = text.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Referencias a obras
  if (!resolved.projectRef) {
    if (/\b(esa|la|esta|mi|dicha)\s+obra\b/.test(normalized) && ctx.lastProjectRef) {
      resolved.projectRef = ctx.lastProjectRef;
      resolved.projectName = ctx.lastProjectName;
      resolved._resolvedFrom = "pronoun_project";
    } else if (/\b(la obra|esa obra|esta obra|la misma)\b/.test(normalized) && ctx.lastProjectRef) {
      resolved.projectRef = ctx.lastProjectRef;
      resolved.projectName = ctx.lastProjectName;
      resolved._resolvedFrom = "project_reference";
    }
  }

  // Referencias a materiales
  if (!resolved.materialRef) {
    if (/\b(ese|el|este|dicho)\s+(material|producto|item|articulo)\b/.test(normalized) && ctx.lastMaterialRef) {
      resolved.materialRef = ctx.lastMaterialRef;
      resolved._resolvedFrom = "pronoun_material";
    }
  }

  // Referencias temporales
  if (!resolved.period) {
    if (/\beste\s+mes\b/.test(normalized)) resolved.period = "current_month";
    else if (/\b(?:mes\s+(?:pasado|anterior)|ultimo\s+mes)\b/.test(normalized)) resolved.period = "last_month";
    else if (/\beste\s+(año|ano)\b/.test(normalized)) resolved.period = "current_year";
    else if (/\b(?:año|ano)\s+(?:pasado|anterior)\b/.test(normalized)) resolved.period = "last_year";
  }

  // Referencias a pronombres posesivos sin entidad específica
  if (entities.amount && !entities.category && ctx.lastIntent === "action_create_expense") {
    resolved.category = ctx.lastEntities?.category || undefined;
  }

  return resolved;
}

// ─── Buscar action pendiente ───

export async function getPendingAction(): Promise<PendingAction | null> {
  try {
    const recentMsgs = await db.agentMessage.findMany({
      where: { role: "agent" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    for (const msg of recentMsgs) {
      if (msg.meta) {
        try {
          const meta = JSON.parse(msg.meta);
          if (meta.pendingAction) {
            // Verificar expiración (5 minutos)
            if (Date.now() - meta.pendingAction.timestamp < 300000) {
              return meta.pendingAction as PendingAction;
            }
          }
        } catch (e) { agentLogger.warn({ module: "agent-memory" }, "catch swallowed: parsear meta en getPendingAction") }
      }
    }
  } catch (e) { agentLogger.warn({ module: "agent-memory" }, "catch swallowed: buscar acción pendiente") }
  return null;
}

// ─── Guardar action pendiente ───

export async function savePendingAction(action: PendingAction): Promise<void> {
  try {
    const metaData = { pendingAction: { ...action, timestamp: Date.now() } };
    const lastAgentMsg = await db.agentMessage.findFirst({
      where: { role: "agent" },
      orderBy: { createdAt: "desc" },
    });

    if (lastAgentMsg) {
      const meta = lastAgentMsg.meta ? JSON.parse(lastAgentMsg.meta) : {};
      await db.agentMessage.update({
        where: { id: lastAgentMsg.id },
        data: { meta: JSON.stringify({ ...meta, ...metaData }).slice(0, 4000) },
      });
      return;
    }

    await db.agentMessage.create({
      data: {
        role: "agent",
        content: action.prompt || "Acción pendiente",
        intent: action.intent,
        meta: JSON.stringify(metaData).slice(0, 4000),
      },
      });
  } catch (e) { agentLogger.warn({ module: "agent-memory" }, "catch swallowed: guardar acción pendiente") }
}

// ─── Limpiar action pendiente ───

export async function clearPendingAction(): Promise<void> {
  try {
    const lastAgentMsg = await db.agentMessage.findFirst({
      where: { role: "agent" },
      orderBy: { createdAt: "desc" },
    });
    if (lastAgentMsg?.meta) {
      const meta = JSON.parse(lastAgentMsg.meta);
      delete meta.pendingAction;
      await db.agentMessage.update({
        where: { id: lastAgentMsg.id },
        data: { meta: JSON.stringify(meta).slice(0, 4000) || null },
      });
    }
  } catch (e) { agentLogger.warn({ module: "agent-memory" }, "catch swallowed: limpiar acción pendiente") }
}

// ─── Guardar metadatos de contexto en la respuesta ───

export async function saveContextMetadata(response: AgentResponse, entities: Record<string, any>): Promise<void> {
  try {
    const meta: Record<string, any> = {};

    // Extraer referencias de proyecto de la respuesta
    if (response.data?.project?.code) {
      meta.lastProjectRef = response.data.project.code.replace("OB-", "");
      meta.lastProjectName = response.data.project.name;
    }
    if (response.data?.projects?.[0]?.code) {
      meta.lastProjectRef = response.data.projects[0].code.replace("OB-", "");
      meta.lastProjectName = response.data.projects[0].name;
    }
    if (response.data?.transaction?.project?.code) {
      meta.lastProjectRef = response.data.transaction.project.code.replace("OB-", "");
    }
    if (response.data?.material?.name) {
      meta.lastMaterialRef = response.data.material.name;
    }
    if (entities.projectRef) meta.lastProjectRef = entities.projectRef as string;
    if (entities.projectName) meta.lastProjectName = entities.projectName as string;

    // Guardar entidades relevantes para resolución de referencias en el siguiente turno
    // (ej: "esos materiales", "la misma cantidad", etc.)
    const relevantEntities: Record<string, any> = {};
    if (entities.items && Array.isArray(entities.items)) relevantEntities.items = entities.items;
    if (entities.amount) relevantEntities.amount = entities.amount;
    if (entities.name) relevantEntities.name = entities.name;
    if (entities.projectRef) relevantEntities.projectRef = entities.projectRef;
    if (Object.keys(relevantEntities).length > 0) meta.lastEntities = relevantEntities;

    // Para respuestas compuestas, extraer datos de sub-respuestas
    if (response.data?.compound && Array.isArray(response.data?.individualResponses)) {
      for (const sub of response.data.individualResponses) {
        if (sub.data?.project?.code) {
          meta.lastProjectRef = sub.data.project.code.replace("OB-", "");
          meta.lastProjectName = sub.data.project.name;
        }
      }
    }

    if (Object.keys(meta).length > 0) {
      const lastAgentMsg = await db.agentMessage.findFirst({
        where: { role: "agent" },
        orderBy: { createdAt: "desc" },
      });
      if (lastAgentMsg) {
        const existingMeta = lastAgentMsg.meta ? JSON.parse(lastAgentMsg.meta) : {};
        await db.agentMessage.update({
          where: { id: lastAgentMsg.id },
          data: { meta: JSON.stringify({ ...existingMeta, ...meta }).slice(0, 4000) },
        });
      }
    }
  } catch (e) { agentLogger.warn({ module: "agent-memory" }, "catch swallowed: guardar metadatos de contexto") }
}

// ─── Verificar si un intent requiere confirmación ───

export const CONFIRMATION_INTENTS: string[] = [
  "action_create_expense",
  "action_create_income",
  "action_create_project_direct",
  "action_create_supplier",
  "action_close_project",
  "action_reorder",
  "action_add_materials",
  "action_complete_task",
  "action_add_stock_movement",
  "action_update_project_status",
  "action_update_project_progress",
  "action_edit_project",
  "action_edit_task",
  "action_edit_material",
  "action_delete_task",
  "action_delete_material",
  "action_delete_transaction",
  "action_trigger_workflow",
  // Nuevos intents
  "action_edit_supplier",
  "action_delete_supplier",
  "action_bulk_complete_tasks",
  "action_bulk_delete_tasks",
  "action_create_schedule",
];

export function requiresConfirmation(intent: Intent): boolean {
  return CONFIRMATION_INTENTS.includes(intent);
}

// ─── Patrones compartidos de confirmación/cancelación ───

const CONFIRM_PATTERNS = [
  /^(si|sí|dale|ok|okey|okay|confirmo|confirma|adelante|vamos|hazlo|hacelo|crealo|seguro|listo|de una|obvio|por supuesto|si claro|simon|venga|procede|procedé|deshacer|undo)/i,
  /^(confirmo|confirmar|dale nomas|hacelo asi|está bien|esta bien|de acuerdo|claro que si)/i,
];

const CANCEL_PATTERNS = [
  /^(no|nop|nada|cancela|cancelar|para|detente|no hagas|mejor no|dejalo|descartar|olvida|no gracias|para todo|ni ahi|ni ahí)/i,
  /^(para la mano|no quiero|mejor no|descartado|olvidalo|no, gracias)/i,
];

export function isConfirmation(text: string): boolean {
  const normalized = text.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return CONFIRM_PATTERNS.some((r) => r.test(normalized));
}

export function isCancellation(text: string): boolean {
  const normalized = text.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return CANCEL_PATTERNS.some((r) => r.test(normalized));
}

// ─── Generar resumen de acción para confirmación ───

export function generateActionSummary(intent: string, entities: Record<string, any>): string {
  switch (intent) {
    case "action_create_expense":
      return `Registrar gasto de $${entities.amount} en ${entities.category || "general"}${entities.projectRef ? ` para obra OB-${entities.projectRef}` : ""}`;
    case "action_create_income":
      return `Registrar ingreso de $${entities.amount}${entities.projectRef ? ` para obra OB-${entities.projectRef}` : ""}`;
    case "action_create_project_direct":
      return `Crear obra "${entities.name}" con presupuesto $${entities.budget || 0}${entities.clientName ? `, cliente ${entities.clientName}` : ""}`;
    case "action_create_supplier":
      return `Crear proveedor "${entities.name}"`;
    case "action_close_project":
      return `Cerrar obra OB-${entities.projectRef}`;
    case "action_reorder":
      return `Generar pedido de reposición de materiales`;
    case "action_add_materials":
      return `Agregar materiales${entities.projectRef ? ` a obra OB-${entities.projectRef}` : ""}`;
    case "action_complete_task":
      return `Completar tarea "${entities.taskTitle || "(sin especificar)"}"`;
    case "action_add_stock_movement":
      return `Registrar movimiento de stock`;
    case "action_update_project_status":
      return `Cambiar estado de obra a "${entities.status}"`;
    case "action_update_project_progress":
      return `Actualizar avance de obra al ${entities.progress}%`;
    case "action_edit_project":
      return `Editar obra ${entities.projectRef || "(sin especificar)"}`;
    case "action_edit_task":
      return `Editar tarea "${entities.taskTitle || entities.title || "(sin especificar)"}"`;
    case "action_edit_material":
      return `Editar material "${entities.materialName || "(sin especificar)"}"`;
    case "action_delete_task":
      return `Eliminar tarea "${entities.taskTitle || "(sin especificar)"}"`;
    case "action_delete_material":
      return `Eliminar material "${entities.materialName || "(sin especificar)"}"`;
    case "action_delete_transaction":
      return `Eliminar movimiento de $${entities.amount || "(sin especificar)"}`;
    case "action_trigger_workflow":
      return `Ejecutar workflow`;
    default:
      return "Ejecutar acción";
  }
}

// ============================================================
// DELETED-ACTIONS / UNDO STACK — Multi-turno para acciones
// destructivas (task, material, transaction)
// ============================================================
// Estas funciones se usan desde agent-extended (handlers de delete)
// y desde el endpoint /api/agent. Vivir centralizadas acá evita
// duplicación y mantiene la consistencia con el patrón confirm/cancel.
// ============================================================

export interface PendingDelete {
  type: "task" | "material" | "transaction" | "supplier" | "bulk_tasks";
  id: string;
  label: string;
  details: string;
  timestamp: number;
  snapshot: any;
}

const PENDING_DELETE_TTL_MS = 120_000; // 2 minutos

export async function savePendingDelete(pd: Omit<PendingDelete, "timestamp"> & { timestamp?: number }): Promise<void> {
  try {
    const data: PendingDelete = { ...pd, timestamp: pd.timestamp || Date.now() } as PendingDelete;
    const lastAgentMsg = await db.agentMessage.findFirst({
      where: { role: "agent" },
      orderBy: { createdAt: "desc" },
    });
    if (lastAgentMsg) {
      const meta = lastAgentMsg.meta ? JSON.parse(lastAgentMsg.meta) : {};
      meta._pendingDelete = data;
      await db.agentMessage.update({
        where: { id: lastAgentMsg.id },
        data: { meta: JSON.stringify(meta).slice(0, 4000) },
      });
    }
  } catch (e) { agentLogger.warn({ module: "agent-memory" }, "catch swallowed: guardar eliminación pendiente") }
}

export async function getPendingDelete(): Promise<PendingDelete | null> {
  try {
    const recentMsgs = await db.agentMessage.findMany({
      where: { role: "agent" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    for (const msg of recentMsgs) {
      if (!msg.meta) continue;
      try {
        const meta = JSON.parse(msg.meta);
        if (meta._pendingDelete) {
          if (Date.now() - (meta._pendingDelete.timestamp || 0) < PENDING_DELETE_TTL_MS) {
            return meta._pendingDelete as PendingDelete;
          }
        }
      } catch (e) { agentLogger.warn({ module: "agent-memory" }, "catch swallowed: parsear meta en getPendingDelete") }
    }
  } catch (e) { agentLogger.warn({ module: "agent-memory" }, "catch swallowed: obtener eliminación pendiente") }
  return null;
}

export async function clearPendingDelete(): Promise<void> {
  try {
    const recentMsgs = await db.agentMessage.findMany({
      where: { role: "agent" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    for (const msg of recentMsgs) {
      if (!msg.meta) continue;
      try {
        const meta = JSON.parse(msg.meta);
        if (meta._pendingDelete) {
          delete meta._pendingDelete;
          await db.agentMessage.update({
            where: { id: msg.id },
            data: { meta: JSON.stringify(meta).slice(0, 4000) || null },
          });
          break;
        }
      } catch (e) { agentLogger.warn({ module: "agent-memory" }, "catch swallowed: parsear meta en clearPendingDelete") }
    }
  } catch (e) { agentLogger.warn({ module: "agent-memory" }, "catch swallowed: limpiar eliminación pendiente") }
}

export interface UndoSnapshot {
  model: "task" | "material" | "transaction" | "supplier";
  recordId: string;
  data: Record<string, any>;
  action: string;
  timestamp: number;
}

const PENDING_UNDO_TTL_MS = 300_000; // 5 minutos

export async function saveUndoSnapshot(
  model: UndoSnapshot["model"],
  recordId: string,
  data: Record<string, any>,
  action: string
): Promise<void> {
  try {
    await db.agentAction.create({
      data: {
        type: "highlight",
        severity: "info",
        title: `↩️ Deshacer: ${action.replace(/_/g, " ")}`,
        description: `Podés deshacer esta acción. Vence en 5 minutos.`,
        status: "active",
        payload: JSON.stringify({
          type: "undo",
          model,
          recordId,
          data,
          action,
          timestamp: Date.now(),
        }),
      },
    });

    const lastAgentMsg = await db.agentMessage.findFirst({
      where: { role: "agent" },
      orderBy: { createdAt: "desc" },
    });
    if (lastAgentMsg) {
      const meta = lastAgentMsg.meta ? JSON.parse(lastAgentMsg.meta) : {};
      meta._lastUndo = { model, recordId, data, action, timestamp: Date.now() };
      await db.agentMessage.update({
        where: { id: lastAgentMsg.id },
        data: { meta: JSON.stringify(meta).slice(0, 4000) },
      });
    }
  } catch (e) { agentLogger.warn({ module: "agent-memory" }, "catch swallowed: guardar snapshot para deshacer") }
}

export async function findUndoSnapshot(): Promise<UndoSnapshot | null> {
  try {
    const recentActions = await db.agentAction.findMany({
      where: { status: "active" },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    for (const a of recentActions) {
      if (a.payload) {
        try {
          const payload = JSON.parse(a.payload);
          if (payload.type === "undo" && Date.now() - payload.timestamp < PENDING_UNDO_TTL_MS) {
            return payload as UndoSnapshot;
          }
        } catch (e) { agentLogger.warn({ module: "agent-memory" }, "catch swallowed: parsear payload de acción en findUndoSnapshot") }
      }
    }

    const recentMsgs = await db.agentMessage.findMany({
      where: { role: "agent" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    for (const msg of recentMsgs) {
      if (!msg.meta) continue;
      try {
        const meta = JSON.parse(msg.meta);
        if (meta._lastUndo && Date.now() - meta._lastUndo.timestamp < PENDING_UNDO_TTL_MS) {
          return meta._lastUndo as UndoSnapshot;
        }
      } catch (e) { agentLogger.warn({ module: "agent-memory" }, "catch swallowed: parsear meta de mensaje en findUndoSnapshot") }
    }
  } catch (e) { agentLogger.warn({ module: "agent-memory" }, "catch swallowed: buscar snapshot para deshacer") }
  return null;
}

export async function executeUndo(snapshot: UndoSnapshot): Promise<boolean> {
  try {
    const { id, createdAt, updatedAt, ...cleanData } = snapshot.data;

    switch (snapshot.model) {
      case "task":
        await db.task.create({ data: cleanData as any });
        return true;
      case "material":
        await db.material.create({ data: cleanData as any });
        return true;
      case "transaction":
        await db.transaction.create({ data: cleanData as any });
        return true;
      case "supplier":
        await db.supplier.create({ data: cleanData as any });
        return true;
      default:
        return false;
    }
  } catch {
    return false;
  }
}

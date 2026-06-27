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

const CONFIRM_PATTERNS = [
  /^(si|sí|dale|ok|okey|okay|confirmo|confirma|adelante|vamos|hazlo|hacelo|crealo|seguro|listo|de una|obvio|por supuesto|si claro|simon|venga|adelante|procede|procedé)/i,
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

// ─── Cargar contexto de conversación ───

export async function getConversationContext(): Promise<ConversationContext> {
  try {
    const lastMessages = await db.agentMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const ctx: ConversationContext = {
      recentMessages: lastMessages
        .reverse()
        .map((m) => ({ role: m.role, content: m.content.slice(0, 200), intent: m.intent || undefined })),
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
        } catch {}
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
        } catch {}
      }
    }
  } catch {}
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
  } catch {}
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
  } catch {}
}

// ─── Guardar metadatos de contexto en la respuesta ───

export async function saveContextMetadata(response: AgentResponse, entities: Record<string, any>): Promise<void> {
  try {
    if (!response.data) return;
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
  } catch {}
}

// ─── Verificar si un intent requiere confirmación ───

const CONFIRMATION_INTENTS: string[] = [
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
];

export function requiresConfirmation(intent: Intent): boolean {
  return CONFIRMATION_INTENTS.includes(intent);
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

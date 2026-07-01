// ============================================================
// CAPABILITY: Notifications
// ============================================================
// Tools para enviar notificaciones internas al usuario.
// Reutiliza el modelo AgentAction existente (type="alert").
// No requiere nueva tabla en Prisma.
// ============================================================

import { z } from "zod";
import { db } from "@/lib/db";
import type { AgentResponse } from "@/lib/agent";
import { agentLogger } from "@/lib/logger";

// ─── Schemas ──────────────────────────────────────────────────

const SendNotificationSchema = z.object({
  title: z.string().min(1).max(120).describe("Título de la notificación"),
  description: z.string().max(500).optional().describe("Descripción o cuerpo"),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
  type: z.enum(["alert", "task", "reminder", "info"]).default("alert"),
  projectRef: z.union([z.string(), z.number()]).optional().describe("Obra relacionada"),
  link: z.string().url().optional().describe("Link de navegación opcional"),
});

const ListNotificationsSchema = z.object({
  unreadOnly: z.boolean().default(false).describe("Solo no leídas"),
  severity: z.enum(["info", "warning", "critical"]).optional().describe("Filtrar por severidad"),
  limit: z.number().int().min(1).max(50).default(20),
});

const ResolveNotificationSchema = z.object({
  notificationId: z.string().describe("ID de la notificación"),
});

const DismissAllSchema = z.object({});

// ──────────────────────────────────────────────────────────────
// send_notification · Crear una notificación interna
// ──────────────────────────────────────────────────────────────

export async function sendNotification(
  args: z.infer<typeof SendNotificationSchema>
): Promise<AgentResponse> {
  let projectId: string | null = null;
  if (args.projectRef) {
    try {
      const refStr = String(args.projectRef).trim();
      const where =
        /^\d+$/.test(refStr)
          ? { code: { contains: refStr.padStart(3, "0") } }
          : { name: { contains: refStr } };
      const project = await db.project.findFirst({ where });
      projectId = project?.id || null;
    } catch (e) { agentLogger.warn({ module: "agent-capabilities-notifications" }, "catch swallowed: resolver proyecto por referencia") }
  }

  const payload = JSON.stringify({
    type: "notification",
    link: args.link,
    projectRef: args.projectRef ? String(args.projectRef) : undefined,
  });

  try {
    const { getTenantSafe } = await import("@/lib/tenant");
    const orgId = (await getTenantSafe())?.organizationId ?? "default";
    const action = await db.agentAction.create({
      data: {
        type: args.type,
        severity: args.severity,
        title: args.title,
        description: args.description || "",
        payload,
        status: "active",
        organizationId: orgId,
      },
    });

    const sevIcon = args.severity === "critical" ? "🔴" : args.severity === "warning" ? "🟡" : "🔵";
    const projectLine = args.projectRef ? ` [OB-${args.projectRef}]` : "";

    return {
      text: `${sevIcon} **Notificación enviada**\n\n**${args.title}**${projectLine}\n${args.description || ""}`.trim(),
      intent: "send_notification",
      data: { id: action.id, severity: args.severity, title: args.title },
      suggestions: [
        "Ver notificaciones",
        `Resuelve ${action.id.slice(0, 8)}`,
        "Ver alertas",
      ],
    };
  } catch (err: any) {
    return {
      text: `❌ No pude enviar la notificación: ${err.message}`,
      intent: "send_notification",
      suggestions: ["Intentar de nuevo"],
    };
  }
}

// ──────────────────────────────────────────────────────────────
// list_notifications · Listar notificaciones
// ──────────────────────────────────────────────────────────────

export async function listNotifications(
  args: z.infer<typeof ListNotificationsSchema>
): Promise<AgentResponse> {
  try {
    const where: any = { status: "active" };
    if (args.severity) where.severity = args.severity;

    const actions = await db.agentAction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: args.limit,
    });

    if (actions.length === 0) {
      return {
        text: "No tenés notificaciones.",
        intent: "list_notifications",
        suggestions: ["Enviar una notificación"],
      };
    }

    const lines = actions.map((a) => {
      const sevIcon = a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟡" : "🔵";
      let meta: any = {};
      try {
        meta = a.payload ? JSON.parse(a.payload) : {};
      } catch (e) { agentLogger.warn({ module: "agent-capabilities-notifications" }, "catch swallowed: parsear payload de notificación") }
      const linkLine = meta.link ? ` → ${meta.link}` : "";
      return `${sevIcon} **${a.title}**${linkLine}\n   ${a.description?.slice(0, 80) || ""} (${a.type})`.trim();
    });

    const unread = args.unreadOnly
      ? actions.filter(a => a.status === "active").length
      : actions.length;

    return {
      text: `🔔 **${unread} notificación(es)**\n\n${lines.join("\n\n")}`,
      intent: "list_notifications",
      data: {
        notifications: actions.map(a => ({ id: a.id, title: a.title, severity: a.severity, type: a.type })),
        total: actions.length,
      },
      suggestions: ["Enviar notificación", "Resolver todas"],
    };
  } catch (err: any) {
    return {
      text: `❌ Error: ${err.message}`,
      intent: "list_notifications",
      suggestions: ["Intentar de nuevo"],
    };
  }
}

// ──────────────────────────────────────────────────────────────
// resolve_notification · Resolver/dismiss una notificación
// ──────────────────────────────────────────────────────────────

export async function resolveNotification(
  args: z.infer<typeof ResolveNotificationSchema>
): Promise<AgentResponse> {
  try {
    const action = await db.agentAction.findUnique({ where: { id: args.notificationId } });
    if (!action) {
      return {
        text: `❌ No encontré la notificación con ID \`${args.notificationId}\``,
        intent: "resolve_notification",
        suggestions: ["Ver notificaciones"],
      };
    }

    await db.agentAction.update({
      where: { id: args.notificationId },
      data: { status: "resolved" },
    });

    return {
      text: `✅ Notificación **"${action.title}"** resuelta.`,
      intent: "resolve_notification",
      data: { id: args.notificationId },
      suggestions: ["Ver notificaciones", "Ver alertas"],
    };
  } catch (err: any) {
    return {
      text: `❌ Error: ${err.message}`,
      intent: "resolve_notification",
      suggestions: ["Intentar de nuevo"],
    };
  }
}

// ──────────────────────────────────────────────────────────────
// dismiss_all_notifications · Dismiss todas las activas
// ──────────────────────────────────────────────────────────────

export async function dismissAllNotifications(): Promise<AgentResponse> {
  try {
    const result = await db.agentAction.updateMany({
      where: { status: "active" },
      data: { status: "dismissed" },
    });

    return {
      text: `🗑️ ${result.count} notificación(es) descartada(s).`,
      intent: "dismiss_all_notifications",
      data: { count: result.count },
      suggestions: ["Enviar notificación"],
    };
  } catch (err: any) {
    return {
      text: `❌ Error: ${err.message}`,
      intent: "dismiss_all_notifications",
      suggestions: ["Intentar de nuevo"],
    };
  }
}

// ─── Schema mapping ────────────────────────────────────────────

export const notificationToolSchemas = {
  send_notification: SendNotificationSchema,
  list_notifications: ListNotificationsSchema,
  resolve_notification: ResolveNotificationSchema,
  dismiss_all_notifications: DismissAllSchema,
} as const;
// ============================================================
// CAPABILITY: Calendar
// ============================================================
// Tools para agendar eventos, recordatorios y tareas
// vinculadas a proyectos usando el modelo AgentAction.
// No crea nuevas tablas: reutiliza AgentAction con type="task"
// para eventos de calendario y type="reminder" para recordatorios.
// ============================================================

import { z } from "zod";
import { db } from "@/lib/db";
import type { AgentResponse } from "@/lib/agent";
import { agentLogger } from "@/lib/logger";

// ─── Schemas ──────────────────────────────────────────────────

const ScheduleEventSchema = z.object({
  title: z.string().min(1).max(200).describe("Título del evento"),
  description: z.string().max(1000).optional().describe("Descripción o notas"),
  date: z.string().describe("Fecha ISO 8601 (ej: 2026-07-15 o 2026-07-15T14:30)"),
  duration: z.number().int().min(15).max(480).optional().describe("Duración en minutos"),
  projectRef: z.union([z.string(), z.number()]).optional().describe("Código de obra (OB-001)"),
  taskId: z.string().optional().describe("ID de tarea asociada"),
  reminders: z.array(z.number()).optional().describe("Minutos antes: [15, 60, 1440]"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

const ListEventsSchema = z.object({
  from: z.string().optional().describe("Desde fecha ISO"),
  to: z.string().optional().describe("Hasta fecha ISO"),
  projectRef: z.union([z.string(), z.number()]).optional().describe("Filtrar por obra"),
  status: z.enum(["active", "completed", "cancelled"]).optional().default("active"),
  limit: z.number().int().min(1).max(100).default(20),
});

const CompleteEventSchema = z.object({
  eventId: z.string().describe("ID del evento a marcar como completado"),
});

const CancelEventSchema = z.object({
  eventId: z.string().describe("ID del evento a cancelar"),
});

// ──────────────────────────────────────────────────────────────
// Helper: parsear fecha
// ──────────────────────────────────────────────────────────────

function parseDate(dateStr: string): Date | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d;
}

function formatDateLong(d: Date): string {
  return d.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ──────────────────────────────────────────────────────────────
// Helper: buscar proyecto por referencia
// ──────────────────────────────────────────────────────────────

async function resolveProject(ref?: string | number): Promise<string | null> {
  if (!ref) return null;
  const refStr = String(ref).trim();
  const whereClause =
    /^\d+$/.test(refStr)
      ? { code: { contains: refStr.padStart(3, "0") } }
      : /ob[-\s]?\d+$/i.test(refStr)
      ? { code: { contains: refStr.replace(/\s/, "-").toUpperCase() } }
      : { name: { contains: refStr } };

  try {
    const project = await db.project.findFirst({ where: whereClause });
    return project?.id || null;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// schedule_event · Crear un evento en el calendario
// ──────────────────────────────────────────────────────────────

export async function scheduleEvent(
  args: z.infer<typeof ScheduleEventSchema>
): Promise<AgentResponse> {
  const date = parseDate(args.date);
  if (!date) {
    return {
      text: `❌ La fecha "${args.date}" no es válida. Usá formato ISO: 2026-07-15 o 2026-07-15T14:30`,
      intent: "schedule_event",
      suggestions: ["Ayuda con fechas"],
    };
  }

  const projectId = await resolveProject(args.projectRef);

  const payload = JSON.stringify({
    type: "calendar_event",
    date: date.toISOString(),
    duration: args.duration,
    projectRef: args.projectRef ? String(args.projectRef) : undefined,
    taskId: args.taskId,
    reminders: args.reminders,
    priority: args.priority,
  });

  try {
    const action = await db.agentAction.create({
      data: {
        type: "task",
        severity: args.priority === "critical" ? "critical" : args.priority === "high" ? "warning" : "info",
        title: args.title,
        description: args.description || "",
        payload,
        status: "active",
      },
    });

    const dateStr = formatDateLong(date);
    const projectLine = args.projectRef ? ` para **OB-${args.projectRef}**` : "";

    return {
      text: `📅 **Evento creado**\n\n**${args.title}**\n📆 ${dateStr}${projectLine}${args.duration ? ` (${args.duration} min)` : ""}${args.reminders?.length ? `\n🔔 Recordatorios: ${args.reminders.map(r => `${r}min`).join(", ")}` : ""}\n\nID: \`${action.id}\``,
      intent: "schedule_event",
      data: { id: action.id, title: args.title, date: date.toISOString(), projectId },
      suggestions: [
        `Lista mis eventos`,
        `Completa el evento ${action.id.slice(0, 8)}`,
        `Cancela el evento ${action.id.slice(0, 8)}`,
      ],
    };
  } catch (err: any) {
    return {
      text: `❌ No pude crear el evento: ${err.message}`,
      intent: "schedule_event",
      suggestions: ["Intentar de nuevo"],
    };
  }
}

// ──────────────────────────────────────────────────────────────
// list_events · Listar eventos del calendario
// ──────────────────────────────────────────────────────────────

export async function listEvents(
  args: z.infer<typeof ListEventsSchema>
): Promise<AgentResponse> {
  try {
    const from = args.from ? parseDate(args.from) : undefined;
    const to = args.to ? parseDate(args.to) : undefined;

    const where: any = {
      type: "task",
      status: args.status || "active",
    };

    const actions = await db.agentAction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: args.limit,
    });

    // Filtrar por fecha si se especificó
    const filtered = actions.filter((a) => {
      if (!a.payload) return true;
      try {
        const p = JSON.parse(a.payload);
        if (!p.date) return true;
        const d = new Date(p.date);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      } catch {
        return true;
      }
    });

    if (filtered.length === 0) {
      return {
        text: "No hay eventos en el calendario para ese período.",
        intent: "list_events",
        suggestions: ["Crea un evento", "Ver todos los eventos"],
      };
    }

    const lines = filtered.map((a) => {
      let meta: any = {};
      try {
        meta = a.payload ? JSON.parse(a.payload) : {};
      } catch (e) { agentLogger.warn({ module: "agent-capabilities-calendar" }, "catch swallowed: parsear payload de evento") }

      const dateStr = meta.date
        ? formatDateLong(new Date(meta.date))
        : `(${a.createdAt.toLocaleDateString("es-AR")})`;

      const projLine = meta.projectRef ? ` [OB-${meta.projectRef}]` : "";
      const statusIcon = a.status === "completed" ? "✅" : a.status === "cancelled" ? "❌" : "📅";

      return `${statusIcon} **${a.title}**\n   ${dateStr}${projLine}\n   ${a.description?.slice(0, 60) || ""}`.trim();
    });

    return {
      text: `📋 **${filtered.length} evento(s)**\n\n${lines.join("\n\n")}`,
      intent: "list_events",
      data: { events: filtered.map(a => ({ id: a.id, title: a.title, status: a.status, payload: a.payload ? JSON.parse(a.payload) : {} })) },
      suggestions: ["Crea un evento", "Ver alertas"],
    };
  } catch (err: any) {
    return {
      text: `❌ Error: ${err.message}`,
      intent: "list_events",
      suggestions: ["Intentar de nuevo"],
    };
  }
}

// ──────────────────────────────────────────────────────────────
// complete_event · Marcar evento como completado
// ──────────────────────────────────────────────────────────────

export async function completeEvent(
  args: z.infer<typeof CompleteEventSchema>
): Promise<AgentResponse> {
  try {
    const action = await db.agentAction.findUnique({ where: { id: args.eventId } });
    if (!action) {
      return { text: `❌ No encontré el evento con ID \`${args.eventId}\`` , intent: "complete_event", suggestions: ["Lista eventos"] };
    }

    await db.agentAction.update({
      where: { id: args.eventId },
      data: { status: "resolved" },
    });

    return {
      text: `✅ Evento **"${action.title}"** marcado como completado.`,
      intent: "complete_event",
      data: { id: args.eventId },
      suggestions: ["Lista mis eventos", "Ver alertas activas"],
    };
  } catch (err: any) {
    return { text: `❌ Error: ${err.message}`, intent: "complete_event", suggestions: ["Intentar de nuevo"] };
  }
}

// ──────────────────────────────────────────────────────────────
// cancel_event · Cancelar un evento
// ──────────────────────────────────────────────────────────────

export async function cancelEvent(
  args: z.infer<typeof CancelEventSchema>
): Promise<AgentResponse> {
  try {
    const action = await db.agentAction.findUnique({ where: { id: args.eventId } });
    if (!action) {
      return { text: `❌ No encontré el evento con ID \`${args.eventId}\``, intent: "cancel_event", suggestions: ["Lista eventos"] };
    }

    await db.agentAction.update({
      where: { id: args.eventId },
      data: { status: "dismissed" },
    });

    return {
      text: `❌ Evento **"${action.title}"** cancelado.`,
      intent: "cancel_event",
      data: { id: args.eventId },
      suggestions: ["Lista mis eventos", "Crea un evento"],
    };
  } catch (err: any) {
    return { text: `❌ Error: ${err.message}`, intent: "cancel_event", suggestions: ["Intentar de nuevo"] };
  }
}

// ─── Schema mapping ────────────────────────────────────────────

export const calendarToolSchemas = {
  schedule_event: ScheduleEventSchema,
  list_events: ListEventsSchema,
  complete_event: CompleteEventSchema,
  cancel_event: CancelEventSchema,
} as const;
// ============================================================
// CAPABILITY: Search
// ============================================================
// Tools de búsqueda avanzada para el agente.
// Permiten buscar proyectos, clientes y presupuestos
// cuando Groq no está disponible o se necesita búsqueda directa.
// ============================================================

import { z } from "zod";
import { db } from "@/lib/db";
import type { AgentResponse } from "@/lib/agent";

// ─── Schemas ──────────────────────────────────────────────────

const SearchProjectsSchema = z.object({
  query: z.string().optional().describe("Texto a buscar en nombre o código"),
  status: z.enum(["planning", "in_progress", "paused", "completed", "cancelled"]).optional().describe("Filtrar por estado"),
  minBudget: z.number().optional().describe("Presupuesto mínimo"),
  maxBudget: z.number().optional().describe("Presupuesto máximo"),
  clientName: z.string().optional().describe("Nombre del cliente"),
  limit: z.number().int().min(1).max(50).default(20),
});

const SearchClientsSchema = z.object({
  query: z.string().optional().describe("Nombre o email del cliente"),
  projectStatus: z.enum(["planning", "in_progress", "paused", "completed", "cancelled"]).optional().describe("Filtrar por estado de proyecto"),
  limit: z.number().int().min(1).max(50).default(10),
});

const SearchBudgetsSchema = z.object({
  minAmount: z.number().optional().describe("Monto mínimo"),
  maxAmount: z.number().optional().describe("Monto máximo"),
  projectStatus: z.enum(["planning", "in_progress", "paused", "completed", "cancelled"]).optional().describe("Filtrar por estado"),
  limit: z.number().int().min(1).max(50).default(10),
});

const budgetRanges = [
  { label: "Hasta $500.000", min: 0, max: 500_000 },
  { label: "$500.000 - $2.000.000", min: 500_000, max: 2_000_000 },
  { label: "$2.000.000 - $5.000.000", min: 2_000_000, max: 5_000_000 },
  { label: "$5.000.000 - $10.000.000", min: 5_000_000, max: 10_000_000 },
  { label: "Más de $10.000.000", min: 10_000_000, max: Infinity },
];

// ──────────────────────────────────────────────────────────────
// search_projects
// ──────────────────────────────────────────────────────────────

export async function searchProjects(
  args: z.infer<typeof SearchProjectsSchema>
): Promise<AgentResponse> {
  try {
    const where: any = {};
    if (args.query) {
      where.OR = [
        { name: { contains: args.query, mode: "insensitive" } },
        { code: { contains: args.query.toUpperCase().replace(/OB-/i, "") } },
        { clientName: { contains: args.query, mode: "insensitive" } },
        { address: { contains: args.query, mode: "insensitive" } },
      ];
    }
    if (args.status) where.status = args.status;
    if (args.minBudget) where.budget = { ...where.budget, gte: args.minBudget };
    if (args.maxBudget) where.budget = { ...where.budget, lte: args.maxBudget };
    if (args.clientName) where.clientName = { contains: args.clientName, mode: "insensitive" };

    const projects = await db.project.findMany({
      where,
      include: { _count: { select: { tasks: true, transactions: true } } },
      orderBy: { updatedAt: "desc" },
      take: args.limit,
    });

    if (projects.length === 0) {
      return { text: "No encontré obras con esos criterios.", intent: "search_projects", suggestions: ["Ver todas las obras", "Busca otro criterio"] };
    }

    const lines = projects.map(p => {
      const statusIcon = p.status === "completed" ? "✅" : p.status === "in_progress" ? "🔨" : p.status === "paused" ? "⏸️" : p.status === "cancelled" ? "❌" : "📋";
      return `${statusIcon} **${p.name}** (${p.code})\n   ${p.clientName ? `👤 ${p.clientName} | ` : ""}💰 $${p.budget.toLocaleString("es-AR")} | Avance: ${p.progress}% | ${p._count.tasks} tareas`;
    });

    return {
      text: `🏗️ **${projects.length} obra(s) encontrada(s)**\n\n${lines.join("\n\n")}`,
      intent: "search_projects",
      data: { count: projects.length, projects: projects.map(p => ({ id: p.id, name: p.name, code: p.code, status: p.status, budget: p.budget })) },
      suggestions: ["Ver obra específica", "Generar informe de obra", "Ver tareas"],
    };
  } catch (err: any) {
    return { text: `❌ Error: ${err.message}`, intent: "search_projects", suggestions: ["Intentar de nuevo"] };
  }
}

// ──────────────────────────────────────────────────────────────
// search_clients · Buscar por nombre de cliente en proyectos
// ──────────────────────────────────────────────────────────────

export async function searchClients(
  args: z.infer<typeof SearchClientsSchema>
): Promise<AgentResponse> {
  try {
    const where: any = {};
    if (args.query) {
      where.OR = [
        { clientName: { contains: args.query, mode: "insensitive" } },
        { clientEmail: { contains: args.query, mode: "insensitive" } },
        { clientPhone: { contains: args.query } },
      ];
    }
    if (args.projectStatus) where.status = args.projectStatus;

    const projects = await db.project.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: { _count: { select: { tasks: true } } },
      orderBy: { updatedAt: "desc" },
      take: args.limit,
    });

    // Agrupar por cliente
    const byClient = new Map<string, { client: string; phone?: string; email?: string; projects: any[] }>();
    for (const p of projects) {
      const key = p.clientName || "Sin nombre";
      if (!byClient.has(key)) {
        byClient.set(key, { client: key, phone: p.clientPhone ?? undefined, email: p.clientEmail ?? undefined, projects: [] });
      }
      byClient.get(key)!.projects.push({ code: p.code, name: p.name, status: p.status, budget: p.budget, taskCount: p._count.tasks });
    }

    const clients = Array.from(byClient.values());
    if (clients.length === 0) {
      return { text: "No encontré clientes con esos criterios.", intent: "search_clients", suggestions: ["Busca sin filtro", "Ver todas las obras"] };
    }

    const lines = clients.map(c => {
      const projLine = c.projects.map(p => `  • ${p.code} ${p.name} (${p.status}) $${p.budget.toLocaleString("es-AR")}`).join("\n");
      const contact = [c.phone, c.email].filter(Boolean).join(" | ");
      return `👤 **${c.client}**${contact ? ` — ${contact}` : ""}\n${projLine}`;
    });

    return {
      text: `👥 **${clients.length} cliente(s) encontrado(s)**\n\n${lines.join("\n\n")}`,
      intent: "search_clients",
      data: { clients: clients.map(c => ({ name: c.client, phone: c.phone, email: c.email, projectCount: c.projects.length })) },
      suggestions: ["Busca por obra", "Ver obras del cliente"],
    };
  } catch (err: any) {
    return { text: `❌ Error: ${err.message}`, intent: "search_clients", suggestions: ["Intentar de nuevo"] };
  }
}

// ──────────────────────────────────────────────────────────────
// search_budgets · Buscar obras por rango de presupuesto
// ──────────────────────────────────────────────────────────────

export async function searchBudgets(
  args: z.infer<typeof SearchBudgetsSchema>
): Promise<AgentResponse> {
  try {
    const where: any = {};
    if (args.minAmount !== undefined) where.budget = { ...where.budget ?? {}, gte: args.minAmount };
    if (args.maxAmount !== undefined) where.budget = { ...where.budget ?? {}, lte: args.maxAmount };
    if (args.projectStatus) where.status = args.projectStatus;

    const projects = await db.project.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: { _count: { select: { tasks: true, transactions: true } } },
      orderBy: { budget: "desc" },
      take: args.limit,
    });

    const total = projects.reduce((s, p) => s + p.budget, 0);
    const avg = projects.length > 0 ? total / projects.length : 0;

    const lines = projects.map(p => {
      const pct = avg > 0 ? Math.round((p.budget / avg) * 100) : 100;
      const bar = pct >= 150 ? "████" : pct >= 100 ? "███░" : pct >= 66 ? "██░░" : "█░░░";
      return `${bar} **${p.name}** (${p.code})\n   $${p.budget.toLocaleString("es-AR")} | ${p.status} | Avance: ${p.progress}%`;
    });

    const rangeInfo = args.minAmount !== undefined || args.maxAmount !== undefined
      ? ` | Rango: $${(args.minAmount ?? 0).toLocaleString("es-AR")} - $${(args.maxAmount ?? Infinity).toLocaleString("es-AR")}`
      : "";

    return {
      text: `💰 **Presupuestos** (${projects.length} obras${rangeInfo})\n\nPromedio: $${avg.toLocaleString("es-AR")} | Total: $${total.toLocaleString("es-AR")}\n\n${lines.join("\n\n")}`,
      intent: "search_budgets",
      data: {
        count: projects.length,
        total: total,
        average: avg,
        projects: projects.map(p => ({ id: p.id, name: p.name, code: p.code, budget: p.budget })),
      },
      suggestions: ["Informe presupuestario", "Ver obra", "Ver rango diferente"],
    };
  } catch (err: any) {
    return { text: `❌ Error: ${err.message}`, intent: "search_budgets", suggestions: ["Intentar de nuevo"] };
  }
}

// ──────────────────────────────────────────────────────────────
// list_budget_ranges · Rangos predefinidos de presupuesto
// ──────────────────────────────────────────────────────────────

export async function listBudgetRanges(): Promise<AgentResponse> {
  const allProjects = await db.project.findMany({ select: { budget: true, name: true, code: true } });

  const rangesWithCounts = budgetRanges.map(range => ({
    label: range.label,
    count: allProjects.filter(p => p.budget >= range.min && p.budget < range.max).length,
  }));

  const lines = rangesWithCounts.map(r => `• **${r.label}** — ${r.count} obra(s)`);

  return {
    text: `📊 **Rangos de Presupuesto**\n\n${lines.join("\n")}`,
    intent: "list_budget_ranges",
    data: { ranges: rangesWithCounts },
    suggestions: ["Busca por rango", "Ver todas las obras"],
  };
}

// ─── Schema mapping ────────────────────────────────────────────

export const searchToolSchemas = {
  search_projects: SearchProjectsSchema,
  search_clients: SearchClientsSchema,
  search_budgets: SearchBudgetsSchema,
} as const;
// ============================================================
// TOOL DEFINITIONS — Implementaciones ejecutables del registry
// ============================================================
// Cada ToolDefinition tiene:
//  - name, description, inputSchema (Zod)
//  - riskLevel (safe | moderate | destructive)
//  - execute(args: any, ctx: ToolContext) → AgentResponse
//
// Este archivo convierte el catálogo "dead-data" de tool-registry.ts
// en funciones ejecutables. La capa tool-execution.ts lo consume.
// Los args llegan ya validados por el Zod schema del registry.
// ============================================================

import { db } from "@/lib/db";
import {
  dispatchByIntent,
  parseIntent,
  normalize,
  generateSku,
  type AgentResponse,
  type ParsedCommand,
  type Intent,
} from "../agent";
import { type ToolName, type ToolContext, getRiskLevel } from "../tool-registry";
import {
  handleEditProject,
  handleEditTask,
  handleEditMaterial,
  handleDeleteTask,
  handleDeleteMaterial,
  handleDeleteTransaction,
  handleTriggerWorkflow,
  handleListWorkflows,
  handleSupplierCompare,
  handlePurchasePlan,
  handleExpenseTrend,
  handleExportData,
} from "../agent-extended";
import {
  rememberPreference,
  recallPreference,
  forgetPreference,
  listAllPreferences,
} from "@/lib/agent/capabilities/memory-tools";
import {
  scheduleEvent,
  listEvents,
  completeEvent,
  cancelEvent,
} from "@/lib/agent/capabilities/calendar";
import {
  sendNotification,
  listNotifications,
  resolveNotification,
  dismissAllNotifications,
} from "@/lib/agent/capabilities/notifications";
import {
  searchProjects,
  searchClients,
  searchBudgets,
  listBudgetRanges,
} from "@/lib/agent/capabilities/search-tools";
import { generateDocument } from "@/lib/agent/capabilities/documents";

// ─── Tipo de la firma ejecutora (args ya viene validado) ───

export type ToolExecuteFn = (args: any, ctx: ToolContext) => Promise<AgentResponse>;

export interface ExecutableTool {
  name: ToolName;
  intent: Intent;
  description: string;
  riskLevel: "safe" | "moderate" | "destructive";
  inputSchema?: any; // opcional (los args vienen validados por tool-registry.ts)
  execute: ToolExecuteFn;
}

// ─── Helpers compartidos ───

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: decimals }).format(value);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Resolver proyecto (id o code) ───

async function resolveProject(ref?: string | number) {
  if (ref === undefined || ref === null) return null;

  const refStr = String(ref).trim();
  if (/^\d+$/.test(refStr)) {
    const padded = refStr.padStart(3, "0");
    return await db.project.findFirst({
      where: { OR: [{ code: `OB-${padded}` }, { code: { contains: refStr } }] },
      include: { transactions: true, tasks: true },
    });
  }
  if (/^ob[-\s]?\d+$/i.test(refStr)) {
    return await db.project.findFirst({
      where: { code: { contains: refStr.replace(/\s/, "-").toUpperCase() } },
      include: { transactions: true, tasks: true },
    });
  }
  const all = await db.project.findMany({ include: { transactions: true, tasks: true } });
  const norm = normalize(refStr);
  return (
    all.find((p) => normalize(p.name) === norm) ||
    all.find((p) => normalize(p.name).includes(norm) || norm.includes(normalize(p.name))) ||
    null
  );
}

// ─── Construir ParsedCommand sintético para delegar al motor central ───

function makeParsed(intent: Intent, entities: Record<string, any>, rawText: string): ParsedCommand {
  return {
    intent,
    rawText,
    normalized: normalize(rawText),
    entities: entities as Record<string, string | number | undefined>,
    confidence: 1.0,
  };
}

// ─── HANDLERS TIPADOS PARA CADA TOOL ───

const tools: Record<ToolName, ExecutableTool> = {
  // ─────────── OBRAS ───────────

  create_project: {
    name: "create_project",
    intent: "action_create_project_direct",
    description: "Crea una obra/proyecto nuevo",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args, ctx) => {
      const parsed = makeParsed("action_create_project_direct", args, ctx.rawText || "");
      return await dispatchByIntent(parsed, ctx.rawText);
    },
  },

  update_project_progress: {
    name: "update_project_progress",
    intent: "action_update_project_progress",
    description: "Actualiza el porcentaje de avance de una obra (0-100)",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args, ctx) => {
      const projectRef = args.projectRef as string | number | undefined;
      const progress = Number(args.progress);

      // Validación runtime explícita
      if (progress === undefined || Number.isNaN(progress)) {
        return {
          text: `❌ Falta el porcentaje de avance. Indicá un número entre 0 y 100.\n\nEj: *actualizar avance de OB-001 al 75%*`,
          intent: "action_update_project_progress",
        };
      }
      if (progress < 0 || progress > 100) {
        return {
          text: `❌ El avance debe estar entre 0 y 100 (recibido: ${progress}).`,
          intent: "action_update_project_progress",
        };
      }

      const project = await resolveProject(projectRef);
      if (!project) {
        return {
          text: `❌ No encontré la obra ${projectRef ? `OB-${projectRef}` : "(sin especificar)"}.\n\nIndicá código (ej: OB-001) o nombre.`,
          intent: "action_update_project_progress",
        };
      }

      const previousProgress = project.progress;
      const statusUpdate =
        progress >= 100 && project.status !== "completed"
          ? { progress, status: "completed" as const }
          : { progress, status: project.status };

      const updated = await db.project.update({
        where: { id: project.id },
        data: statusUpdate,
      });

      const extraNote =
        progress >= 100 && previousProgress < 100
          ? `\n🎉 **Obra finalizada automáticamente** (alcanzó 100%).`
          : previousProgress === progress
          ? `\n_(Sin cambios respecto al valor anterior)_`
          : "";

      return {
        text:
          `✅ **${project.code}** avance actualizado:\n\n` +
          `• Anterior: **${previousProgress}%**\n` +
          `• Nuevo: **${progress}%**` +
          extraNote,
        intent: "action_update_project_progress",
        data: { project: updated },
        suggestions: [`Detalle de ${project.code}`, "Estado de obras"],
      };
    },
  },

  update_project_status: {
    name: "update_project_status",
    intent: "action_update_project_status",
    description: "Cambia el estado de una obra (planning|in_progress|paused|completed|cancelled)",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args, ctx) => {
      const parsed = makeParsed("action_update_project_status", args, ctx.rawText || "");
      return await dispatchByIntent(parsed, ctx.rawText);
    },
  },

  edit_project: {
    name: "edit_project",
    intent: "action_edit_project",
    description: "Edita campos de una obra existente",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args, ctx) => {
      return await handleEditProject(
        makeParsed("action_edit_project", args, ctx.rawText || ""),
        ctx.rawText || ""
      );
    },
  },

  close_project: {
    name: "close_project",
    intent: "action_close_project",
    description: "Cierra una obra (la marca como completada)",
    riskLevel: "destructive",
    inputSchema: null,
    execute: async (args, ctx) => {
      const parsed = makeParsed("action_close_project", args, ctx.rawText || "");
      return await dispatchByIntent(parsed, ctx.rawText);
    },
  },

  // ─────────── TAREAS ───────────

  create_task: {
    name: "create_task",
    intent: "action_create_task",
    description: "Crea una nueva tarea",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args, ctx) => {
      const parsed = makeParsed("action_create_task", args, ctx.rawText || "");
      return await dispatchByIntent(parsed, ctx.rawText);
    },
  },

  complete_task: {
    name: "complete_task",
    intent: "action_complete_task",
    description: "Marca una tarea como completada",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args, ctx) => {
      const parsed = makeParsed("action_complete_task", args, ctx.rawText || "");
      return await dispatchByIntent(parsed, ctx.rawText);
    },
  },

  edit_task: {
    name: "edit_task",
    intent: "action_edit_task",
    description: "Edita una tarea existente",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args, ctx) => {
      return await handleEditTask(
        makeParsed("action_edit_task", args, ctx.rawText || ""),
        ctx.rawText || ""
      );
    },
  },

  delete_task: {
    name: "delete_task",
    intent: "action_delete_task",
    description: "Elimina una tarea (requiere confirmación)",
    riskLevel: "destructive",
    inputSchema: null,
    execute: async (args, ctx) => {
      return await handleDeleteTask(
        makeParsed("action_delete_task", args, ctx.rawText || ""),
        ctx.rawText || ""
      );
    },
  },

  // ─────────── TRANSACCIONES ───────────

  create_expense: {
    name: "create_expense",
    intent: "action_create_expense",
    description: "Registra un nuevo gasto",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args, ctx) => {
      const parsed = makeParsed("action_create_expense", args, ctx.rawText || "");
      return await dispatchByIntent(parsed, ctx.rawText);
    },
  },

  create_income: {
    name: "create_income",
    intent: "action_create_income",
    description: "Registra un nuevo ingreso",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args, ctx) => {
      const parsed = makeParsed("action_create_income", args, ctx.rawText || "");
      return await dispatchByIntent(parsed, ctx.rawText);
    },
  },

  delete_transaction: {
    name: "delete_transaction",
    intent: "action_delete_transaction",
    description: "Elimina un movimiento financiero (requiere confirmación)",
    riskLevel: "destructive",
    inputSchema: null,
    execute: async (args, ctx) => {
      return await handleDeleteTransaction(
        makeParsed("action_delete_transaction", args, ctx.rawText || ""),
        ctx.rawText || ""
      );
    },
  },

  // ─────────── MATERIALES ───────────

  add_materials: {
    name: "add_materials",
    intent: "action_add_materials",
    description: "Agrega uno o varios materiales al inventario",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args, ctx) => {
      const parsed = makeParsed("action_add_materials", args, ctx.rawText || "");
      return await dispatchByIntent(parsed, ctx.rawText);
    },
  },

  add_stock_movement: {
    name: "add_stock_movement",
    intent: "action_add_stock_movement",
    description: "Registra una entrada, salida o ajuste de stock",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args, ctx) => {
      const parsed = makeParsed("action_add_stock_movement", args, ctx.rawText || "");
      return await dispatchByIntent(parsed, ctx.rawText);
    },
  },

  update_stock: {
    name: "update_stock",
    intent: "action_update_stock",
    description: "Ajusta manualmente el stock de un material",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args, ctx) => {
      const parsed = makeParsed("action_update_stock", args, ctx.rawText || "");
      return await dispatchByIntent(parsed, ctx.rawText);
    },
  },

  edit_material: {
    name: "edit_material",
    intent: "action_edit_material",
    description: "Edita precio/stock/mínimo de un material",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args, ctx) => {
      return await handleEditMaterial(
        makeParsed("action_edit_material", args, ctx.rawText || ""),
        ctx.rawText || ""
      );
    },
  },

  delete_material: {
    name: "delete_material",
    intent: "action_delete_material",
    description: "Elimina un material del inventario (requiere confirmación)",
    riskLevel: "destructive",
    inputSchema: null,
    execute: async (args, ctx) => {
      return await handleDeleteMaterial(
        makeParsed("action_delete_material", args, ctx.rawText || ""),
        ctx.rawText || ""
      );
    },
  },

  reorder: {
    name: "reorder",
    intent: "action_reorder",
    description: "Genera pedido de compra de materiales bajo stock",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args, ctx) => {
      const parsed = makeParsed("action_reorder", args, ctx.rawText || "");
      return await dispatchByIntent(parsed, ctx.rawText);
    },
  },

  // ─────────── PROVEEDORES ───────────

  create_supplier: {
    name: "create_supplier",
    intent: "action_create_supplier",
    description: "Crea un proveedor",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args, ctx) => {
      const parsed = makeParsed("action_create_supplier", args, ctx.rawText || "");
      return await dispatchByIntent(parsed, ctx.rawText);
    },
  },

  // ─────────── WORKFLOWS ───────────

  trigger_workflow: {
    name: "trigger_workflow",
    intent: "action_trigger_workflow",
    description: "Ejecuta un workflow manualmente",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args, ctx) => {
      return await handleTriggerWorkflow(
        makeParsed("action_trigger_workflow", args, ctx.rawText || ""),
        ctx.rawText || ""
      );
    },
  },

  list_workflows: {
    name: "list_workflows",
    intent: "action_list_workflows",
    description: "Lista los workflows del sistema",
    riskLevel: "safe",
    inputSchema: null,
    execute: async () => {
      return await handleListWorkflows();
    },
  },

  list_project_tasks: {
    name: "list_project_tasks",
    intent: "action_list_project_tasks",
    description: "Lista las tareas de una obra",
    riskLevel: "safe",
    inputSchema: null,
    execute: async (args, ctx) => {
      const parsed = makeParsed("action_list_project_tasks", args, ctx.rawText || "");
      return await dispatchByIntent(parsed, ctx.rawText);
    },
  },

  list_automations: {
    name: "list_automations",
    intent: "config_list_automations",
    description: "Lista reglas de automatización (legacy)",
    riskLevel: "safe",
    inputSchema: null,
    execute: async (args, ctx) => {
      const parsed = makeParsed("config_list_automations", args, ctx.rawText || "");
      return await dispatchByIntent(parsed, ctx.rawText);
    },
  },

  // ─────────── UTILIDADES ───────────

  export_data: {
    name: "export_data",
    intent: "action_export_data",
    description:
      "Exporta datos del sistema a CSV (finanzas, inventario, obras, tareas, proveedores o resumen general)",
    riskLevel: "safe",
    inputSchema: null,
    execute: async (args, ctx) => {
      // Tipado local para mayor claridad
      const domain = args.domain as
        | "finances"
        | "inventory"
        | "projects"
        | "tasks"
        | "suppliers"
        | "summary"
        | undefined;

      let csv = "";
      let filename = "reporte";

      switch (domain) {
        case "finances": {
          const transactions = await db.transaction.findMany({
            orderBy: { date: "desc" },
            take: 500,
            include: { project: true, supplier: true },
          });
          csv = "Fecha,Tipo,Categoría,Descripción,Monto,Proyecto,Proveedor\n";
          for (const t of transactions) {
            const safeDesc = (t.description || "").replace(/"/g, '""');
            csv += `${formatDate(t.date)},${t.type},${t.category},"${safeDesc}",${t.amount},${t.project?.code || ""},${t.supplier?.name || ""}\n`;
          }
          filename = "movimientos-financieros";
          break;
        }
        case "inventory": {
          const materials = await db.material.findMany({ include: { supplier: true } });
          csv = "SKU,Nombre,Categoría,Unidad,Stock,Stock Mínimo,Costo Unitario,Valor Total,Proveedor\n";
          for (const m of materials) {
            const safeName = m.name.replace(/"/g, '""');
            csv += `${m.sku},"${safeName}",${m.category},${m.unit},${m.stock},${m.minStock},${m.unitCost},${(m.stock * m.unitCost).toFixed(2)},${m.supplier?.name || ""}\n`;
          }
          filename = "inventario";
          break;
        }
        case "projects": {
          const projects = await db.project.findMany({ include: { transactions: true } });
          csv = "Código,Nombre,Estado,Presupuesto,Avance%,Ingresos,Gastos,Margin,Cliente\n";
          for (const p of projects) {
            const income = p.transactions
              .filter((t) => t.type === "income")
              .reduce((s, t) => s + t.amount, 0);
            const spent = p.transactions
              .filter((t) => t.type === "expense")
              .reduce((s, t) => s + t.amount, 0);
            const margin = p.budget > 0 ? (((income - spent) / p.budget) * 100).toFixed(1) : "0";
            const safeName = p.name.replace(/"/g, '""');
            csv += `${p.code},"${safeName}",${p.status},${p.budget},${p.progress},${income.toFixed(2)},${spent.toFixed(2)},${margin},"${(p.clientName || "").replace(/"/g, '""')}"\n`;
          }
          filename = "obras";
          break;
        }
        case "tasks": {
          const tasks = await db.task.findMany({
            orderBy: { createdAt: "desc" },
            take: 500,
            include: { project: true },
          });
          csv = "Título,Estado,Prioridad,Vence,Asignado,Obra,Creado\n";
          for (const t of tasks) {
            const safeTitle = t.title.replace(/"/g, '""');
            csv += `"${safeTitle}",${t.status},${t.priority},${t.dueDate ? formatDate(t.dueDate) : ""},${t.assignee || ""},${t.project?.code || ""},${formatDate(t.createdAt)}\n`;
          }
          filename = "tareas";
          break;
        }
        case "suppliers": {
          const suppliers = await db.supplier.findMany();
          csv = "Nombre,Contacto,Teléfono,Email,TaxId,Rubro,Rating\n";
          for (const s of suppliers) {
            csv += `"${(s.name || "").replace(/"/g, '""')}","${(s.contact || "").replace(/"/g, '""')}","${s.phone || ""}","${s.email || ""}","${s.taxId || ""}","${s.category || ""}",${s.rating}\n`;
          }
          filename = "proveedores";
          break;
        }
        case "summary":
        default: {
          const [expensesAgg, incomeAgg, matCount, projCount, pendingTasks] = await Promise.all([
            db.transaction.aggregate({ _sum: { amount: true }, where: { type: "expense" } }),
            db.transaction.aggregate({ _sum: { amount: true }, where: { type: "income" } }),
            db.material.count(),
            db.project.count(),
            db.task.count({ where: { status: { not: "completed" } } }),
          ]);
          csv = `Resumen General — Exportado ${new Date().toISOString()}\n`;
          csv += `Métrica,Valor\n`;
          csv += `Total Gastos,${expensesAgg._sum.amount || 0}\n`;
          csv += `Total Ingresos,${incomeAgg._sum.amount || 0}\n`;
          csv += `Materiales en Stock,${matCount}\n`;
          csv += `Obras,${projCount}\n`;
          csv += `Tareas Pendientes,${pendingTasks}\n`;
          filename = "resumen-general";
          break;
        }
      }

      const rowCount = csv.split("\n").filter((l) => l.trim().length > 0).length - 1;
      const preview = csv.split("\n").slice(0, 8).join("\n");

      return {
        text:
          `📥 **Exportación generada**\n\n` +
          `Dominio: **${domain || "resumen"}**\n` +
          `Archivo: **${filename}.csv**\n` +
          `Filas: **${rowCount}**\n\n` +
          `\`\`\`csv\n${preview}\n\`\`\`\n` +
          (rowCount > 7 ? `\n_(Mostrando primeras 7 filas; archivo completo tiene ${rowCount} filas)_` : ""),
        intent: "action_export_data",
        data: { csv, filename, domain: domain || "summary", rowCount },
        suggestions: ["¿Cómo vamos?", "Ver financiero", "Ver inventario"],
      };
    },
  },

  // ─────────── CAPABILITIES (FASE 4-5) ───────────

  // ── Memoria ──
  remember_preference: {
    name: "remember_preference",
    intent: "capability_remember_preference",
    description: "Guarda una preferencia del usuario (ej: idioma, formato, alias).",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args) => rememberPreference(args),
  },

  recall_preference: {
    name: "recall_preference",
    intent: "capability_recall_preference",
    description: "Recupera una preferencia guardada.",
    riskLevel: "safe",
    inputSchema: null,
    execute: async (args) => recallPreference(args),
  },

  forget_preference: {
    name: "forget_preference",
    intent: "capability_forget_preference",
    description: "Olvida una preferencia guardada.",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args) => forgetPreference(args),
  },

  list_preferences: {
    name: "list_preferences",
    intent: "capability_list_preferences",
    description: "Lista todas las preferencias guardadas del usuario.",
    riskLevel: "safe",
    inputSchema: null,
    execute: async () => listAllPreferences(),
  },

  // ── Calendario ──
  schedule_event: {
    name: "schedule_event",
    intent: "capability_schedule_event",
    description: "Agenda un evento o recordatorio en el calendario del proyecto.",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args) => scheduleEvent(args),
  },

  list_events: {
    name: "list_events",
    intent: "capability_list_events",
    description: "Lista los eventos del calendario con filtros.",
    riskLevel: "safe",
    inputSchema: null,
    execute: async (args) => listEvents(args),
  },

  complete_event: {
    name: "complete_event",
    intent: "capability_complete_event",
    description: "Marca un evento del calendario como completado.",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args) => completeEvent(args),
  },

  cancel_event: {
    name: "cancel_event",
    intent: "capability_cancel_event",
    description: "Cancela un evento del calendario.",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args) => cancelEvent(args),
  },

  // ── Notificaciones ──
  send_notification: {
    name: "send_notification",
    intent: "capability_send_notification",
    description: "Envía una notificación interna al usuario (alerta, recordatorio).",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args) => sendNotification(args),
  },

  list_notifications: {
    name: "list_notifications",
    intent: "capability_list_notifications",
    description: "Lista las notificaciones activas.",
    riskLevel: "safe",
    inputSchema: null,
    execute: async (args) => listNotifications(args),
  },

  resolve_notification: {
    name: "resolve_notification",
    intent: "capability_resolve_notification",
    description: "Resuelve una notificación activa.",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args) => resolveNotification(args),
  },

  dismiss_all_notifications: {
    name: "dismiss_all_notifications",
    intent: "capability_dismiss_all_notifications",
    description: "Descarta todas las notificaciones activas.",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async () => dismissAllNotifications(),
  },

  // ── Búsquedas ──
  search_projects: {
    name: "search_projects",
    intent: "capability_search_projects",
    description: "Busca obras/proyectos por nombre, cliente, estado o presupuesto.",
    riskLevel: "safe",
    inputSchema: null,
    execute: async (args) => searchProjects(args),
  },

  search_clients: {
    name: "search_clients",
    intent: "capability_search_clients",
    description: "Busca clientes/proyectos por nombre o contacto.",
    riskLevel: "safe",
    inputSchema: null,
    execute: async (args) => searchClients(args),
  },

  search_budgets: {
    name: "search_budgets",
    intent: "capability_search_budgets",
    description: "Busca obras por rango de presupuesto.",
    riskLevel: "safe",
    inputSchema: null,
    execute: async (args) => searchBudgets(args),
  },

  list_budget_ranges: {
    name: "list_budget_ranges",
    intent: "capability_list_budget_ranges",
    description: "Lista los rangos de presupuesto predefinidos con cantidad de obras.",
    riskLevel: "safe",
    inputSchema: null,
    execute: async () => listBudgetRanges(),
  },

  // ── Documentos ──
  generate_document: {
    name: "generate_document",
    intent: "capability_generate_document",
    description: "Genera un documento (informe de obra, financiero, presupuesto, inventario) en markdown.",
    riskLevel: "moderate",
    inputSchema: null,
    execute: async (args) => generateDocument(args),
  },
};

// ─── API PÚBLICA ───

export function getToolDefinition(name: ToolName): ExecutableTool | undefined {
  return tools[name];
}

export function getAllToolDefinitions(): ExecutableTool[] {
  return Object.values(tools);
}

export function listToolDefinitions(): Array<{
  name: ToolName;
  intent: Intent;
  riskLevel: string;
  description: string;
}> {
  return Object.values(tools).map((t) => ({
    name: t.name,
    intent: t.intent,
    riskLevel: t.riskLevel,
    description: t.description,
  }));
}

// Re-exportar para conveniencia
export { getRiskLevel };
export type { ToolName, ToolContext };

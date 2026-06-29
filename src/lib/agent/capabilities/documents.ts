// ============================================================
// CAPABILITY: Documents
// ============================================================
// Tools para generar documentos (informes, presupuestos,
// reportes, planes) usando Groq con contexto real del CRM.
// ============================================================

import { z } from "zod";
import { db } from "@/lib/db";
import { chatWithGroq } from "@/lib/groq";
import type { AgentResponse } from "@/lib/agent";

// ─── Schemas ──────────────────────────────────────────────────

const GenerateDocumentSchema = z.object({
  type: z.enum([
    "project_report",
    "budget_summary",
    "financial_report",
    "task_summary",
    "inventory_report",
    "client_summary",
    "purchase_plan",
    "custom",
  ]).describe("Tipo de documento a generar"),
  projectRef: z.union([z.string(), z.number()]).optional().describe("Código de obra (para informes de proyecto)"),
  format: z.enum(["markdown", "text"]).default("markdown").describe("Formato de salida"),
  title: z.string().optional().describe("Título personalizado (para tipo 'custom')"),
  description: z.string().optional().describe("Descripción de qué documento quiere"),
});

const projectReportPrompt = (project: any) => `
## Proyecto: ${project.name} (${project.code})

**Estado:** ${project.status} | **Avance:** ${project.progress}% | **Presupuesto:** $${project.budget.toLocaleString("es-AR")}

**Cliente:** ${project.clientName || "No asignado"} | ${project.clientPhone || ""} ${project.clientEmail || ""}

**Fechas:** Inicio: ${project.startDate ? new Date(project.startDate).toLocaleDateString("es-AR") : "No definida"} | Fin: ${project.endDate ? new Date(project.endDate).toLocaleDateString("es-AR") : "No definida"}

---

## Resumen Financiero
Total Ingresos: $${(project.transactions?.filter((t: any) => t.type === "income") || []).reduce((s: number, t: any) => s + t.amount, 0).toLocaleString("es-AR")}
Total Gastos: $${(project.transactions?.filter((t: any) => t.type === "expense") || []).reduce((s: number, t: any) => s + t.amount, 0).toLocaleString("es-AR")}
Margen: $${((project.transactions?.filter((t: any) => t.type === "income") || []).reduce((s: number, t: any) => s + t.amount, 0) - (project.transactions?.filter((t: any) => t.type === "expense") || []).reduce((s: number, t: any) => s + t.amount, 0)).toLocaleString("es-AR")}

## Tareas Recientes (${(project.tasks || []).length} totales)
${(project.tasks || []).slice(0, 8).map((t: any) => `- [${t.status === "completed" ? "x" : " "}] ${t.title} (${t.priority}, ${t.assignee || "sin asignar"})`).join("\n")}

## Transacciones Recientes
${(project.transactions || []).slice(0, 10).map((t: any) => `- ${t.type === "income" ? "💰" : "💸"} $${t.amount.toLocaleString("es-AR")} - ${t.category} (${new Date(t.date).toLocaleDateString("es-AR")})`).join("\n")}
`;

// ──────────────────────────────────────────────────────────────
// Helper: resolver proyecto
// ──────────────────────────────────────────────────────────────

async function resolveProject(ref?: string | number | null): Promise<any | null> {
  if (!ref) return null;
  const refStr = String(ref).trim();
  const where =
    /^\d+$/.test(refStr)
      ? { code: { contains: refStr.padStart(3, "0") } }
      : /ob[-\s]?\d+$/i.test(refStr)
      ? { code: { contains: refStr.replace(/\s/, "-").toUpperCase() } }
      : { name: { contains: refStr } };

  return db.project.findFirst({ where, include: { transactions: true, tasks: true } });
}

// ──────────────────────────────────────────────────────────────
// Helper: generar documento con Groq
// ──────────────────────────────────────────────────────────────

async function groqGenerate(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await chatWithGroq(userPrompt, { systemPrompt, temperature: 0.3, maxTokens: 2048 });
  if (!response.success) throw new Error(response.error || "Groq no disponible");
  return response.content;
}

// ──────────────────────────────────────────────────────────────
// generate_document · Generador principal
// ──────────────────────────────────────────────────────────────

export async function generateDocument(
  args: z.infer<typeof GenerateDocumentSchema>
): Promise<AgentResponse> {
  const systemPrompt = `Sos un asistente administrativo especializado en construcción e inmobiliaria. Generás documentos profesionales en español argentino. Usá formato markdown limpio. Sé preciso con los números.`;

  try {
    switch (args.type) {
      case "project_report": {
        const project = await resolveProject(args.projectRef);
        if (!project) {
          return {
            text: `❌ No encontré el proyecto **OB-${args.projectRef}**.`,
            intent: "generate_document",
            suggestions: ["Ver obras", "Lista mis obras"],
          };
        }
        const dataPrompt = projectReportPrompt(project);
        const content = await groqGenerate(
          systemPrompt + "\n\nGenerá un informe ejecutivo completo del proyecto.",
          dataPrompt + "\n\n---\n\nGenerá un informe ejecutivo completo del proyecto: estado, finanzas, riesgos, y recomendaciones."
        );
        return {
          text: `📄 **Informe de Proyecto: ${project.name}**\n\n${content}`,
          intent: "generate_document",
          data: { type: "project_report", projectId: project.id, projectCode: project.code },
          suggestions: ["Genera otro informe", "Ver presupuesto", "Ver tareas"],
        };
      }

      case "budget_summary": {
        const project = args.projectRef ? await resolveProject(args.projectRef) : null;
        let summary = "";
        if (project) {
          const income = project.transactions?.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + t.amount, 0) || 0;
          const expense = project.transactions?.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0) || 0;
          const categories = [...new Set(project.transactions?.map((t: any) => t.category) || [])] as string[];
          const byCategory = categories.map((cat: string) => {
            const total = project.transactions?.filter((t: any) => t.type === "expense" && t.category === cat).reduce((s: number, t: any) => s + t.amount, 0) || 0;
            return { category: cat, total };
          });
          summary = `Proyecto: ${project.name} (${project.code})\nPresupuesto: $${project.budget.toLocaleString("es-AR")}\nIngresos: $${income.toLocaleString("es-AR")}\nGastos: $${expense.toLocaleString("es-AR")}\nMargen: $${(income - expense).toLocaleString("es-AR")}\n\nDesglose por categoría:\n${byCategory.map(c => ` - ${c.category}: $${c.total.toLocaleString("es-AR")}`).join("\n")}`;
        } else {
          const projects = await db.project.findMany({ include: { transactions: true } });
          const totalIncome = projects.reduce((s: number, p: any) => s + (p.transactions?.filter((t: any) => t.type === "income").reduce((ss: number, t: any) => ss + t.amount, 0) || 0), 0);
          const totalExpense = projects.reduce((s: number, p: any) => s + (p.transactions?.filter((t: any) => t.type === "expense").reduce((ss: number, t: any) => ss + t.amount, 0) || 0), 0);
          summary = `Total Obras: ${projects.length}\nIngresos totales: $${totalIncome.toLocaleString("es-AR")}\nGastos totales: $${totalExpense.toLocaleString("es-AR")}\nMargen total: $${(totalIncome - totalExpense).toLocaleString("es-AR")}`;
        }
        const content = await groqGenerate(
          systemPrompt + "\n\nGenerá un resumen presupuestario claro y profesional.",
          summary + "\n\n---\n\nRedactá un resumen presupuestario con estos datos."
        );
        return {
          text: `💰 **Resumen Presupuestario**\n\n${content}`,
          intent: "generate_document",
          data: { type: "budget_summary", projectRef: args.projectRef },
          suggestions: ["Informe financiero", "Ver proyecto"],
        };
      }

      case "financial_report": {
        const transactions = await db.transaction.findMany({
          where: { date: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
          orderBy: { date: "desc" },
          take: 100,
        });
        const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
        const expense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        const byCategory = [...new Set(transactions.map((t) => t.category))].map((cat: string) => ({
          cat,
          income: transactions.filter((t) => t.type === "income" && t.category === cat).reduce((s, t) => s + t.amount, 0),
          expense: transactions.filter((t) => t.type === "expense" && t.category === cat).reduce((s, t) => s + t.amount, 0),
        }));
        const data = `Período: últimos 90 días\nIngresos: $${income.toLocaleString("es-AR")}\nGastos: $${expense.toLocaleString("es-AR")}\nMargen: $${(income - expense).toLocaleString("es-AR")}\n\nPor categoría:\n${byCategory.map(c => ` - ${c.cat}: ingresos $${c.income.toLocaleString("es-AR")}, gastos $${c.expense.toLocaleString("es-AR")}`).join("\n")}`;
        const content = await groqGenerate(systemPrompt + "\n\nGenerá un informe financiero analítico.", data + "\n\n---\n\nRedactá el informe financiero.");
        return {
          text: `📊 **Informe Financiero (90 días)**\n\n${content}`,
          intent: "generate_document",
          data: { type: "financial_report", income, expense, net: income - expense },
          suggestions: ["Resumen presupuestario", "Ver transacciones"],
        };
      }

      case "task_summary": {
        const project = args.projectRef ? await resolveProject(args.projectRef) : null;
        const where = project ? { projectId: project.id } : {};
        const tasks = await db.task.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 });
        const pending = tasks.filter((t) => t.status === "pending").length;
        const inProgress = tasks.filter((t) => t.status === "in_progress").length;
        const completed = tasks.filter((t) => t.status === "completed").length;
        const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "completed").length;
        const data = `Proyecto: ${project?.name || "Todas"}\nTotal: ${tasks.length} | Pendientes: ${pending} | En curso: ${inProgress} | Completadas: ${completed} | Vencidas: ${overdue}\n\n${tasks.slice(0, 20).map((t) => `- [${t.status}] ${t.title} (${t.priority}, ${t.assignee || "sin asignar"})${t.dueDate ? ` → ${new Date(t.dueDate).toLocaleDateString("es-AR")}` : ""}`).join("\n")}`;
        const content = await groqGenerate(systemPrompt + "\n\nRedactá un resumen de tareas claro, priorizando lo urgente.", data + "\n\n---\n\nResumen de tareas:");
        return {
          text: `✅ **Resumen de Tareas**${project ? ` · ${project.name}` : ""}\n\n${content}`,
          intent: "generate_document",
          data: { type: "task_summary", total: tasks.length, pending, inProgress, completed, overdue },
          suggestions: ["Ver tareas", "Crear tarea"],
        };
      }

      case "inventory_report": {
        const materials = await db.material.findMany({ where: { stock: { gt: 0 } }, include: { supplier: true }, orderBy: { category: "asc" } });
        const lowStock = materials.filter((m) => m.stock <= m.minStock);
        const totalValue = materials.reduce((s, m) => s + m.stock * m.unitCost, 0);
        const data = `Total materiales: ${materials.length} | Valor total: $${totalValue.toLocaleString("es-AR")}\nStock bajo mínimo: ${lowStock.length}\n\nMateriales con stock bajo:\n${lowStock.map((m) => ` - ${m.name} (${m.sku}): stock ${m.stock} / mín ${m.minStock} ${m.unit}`).join("\n")}\n\nTodos los materiales:\n${materials.slice(0, 30).map((m) => `- ${m.name}: ${m.stock} ${m.unit} (c/u $${m.unitCost})`).join("\n")}`;
        const content = await groqGenerate(systemPrompt + "\n\nGenerá un informe de inventario con alertas y recomendaciones.", data + "\n\n---\n\nInforme de inventario:");
        return {
          text: `📦 **Informe de Inventario**\n\n${content}`,
          intent: "generate_document",
          data: { type: "inventory_report", totalMaterials: materials.length, lowStock: lowStock.length, totalValue },
          suggestions: ["Ver stock bajo", "Generar pedido"],
        };
      }

      case "client_summary": {
        if (!args.projectRef) {
          return { text: "Necesito que me indiques la obra para generar el resumen del cliente.", intent: "generate_document", suggestions: ["Dame el código de obra"] };
        }
        const project = await resolveProject(args.projectRef);
        if (!project) {
          return { text: `❌ No encontré el proyecto **OB-${args.projectRef}**.`, intent: "generate_document", suggestions: ["Ver obras"] };
        }
        const content = await groqGenerate(
          systemPrompt + "\n\nGenerá un resumen de cliente/propietario profesional.",
          `Cliente: ${project.clientName || "No asignado"}\nTeléfono: ${project.clientPhone || "No disponible"}\nEmail: ${project.clientEmail || "No disponible"}\nProyecto: ${project.name} (${project.code})\nEstado: ${project.status}\nPresupuesto: $${project.budget.toLocaleString("es-AR")}\nAvance: ${project.progress}%\nInicio: ${project.startDate ? new Date(project.startDate).toLocaleDateString("es-AR") : "N/A"}\nFin: ${project.endDate ? new Date(project.endDate).toLocaleDateString("es-AR") : "N/A"}\n\n---\n\nResumen del cliente:`
        );
        return {
          text: `👤 **Resumen de Cliente**\n\n${content}`,
          intent: "generate_document",
          data: { type: "client_summary", projectId: project.id, clientName: project.clientName },
          suggestions: ["Informe del proyecto", "Ver contacto"],
        };
      }

      case "purchase_plan": {
        const allMaterials = await db.material.findMany({
          include: { supplier: true },
          orderBy: { stock: "asc" },
          take: 50,
        });
        const lowMaterials = allMaterials.filter(m => m.stock <= m.minStock).slice(0, 20);
        const content = await groqGenerate(
          systemPrompt + "\n\nGenerá un plan de compras priorizado con proveedor sugerido.",
          `Materiales con stock bajo:\n${lowMaterials.map((m) => `${m.name} (${m.sku}): stock ${m.stock} / mín ${m.minStock} ${m.unit} | Unit cost: $${m.unitCost} | Supplier: ${m.supplier?.name || "N/A"}`).join("\n")}\n\n---\n\nPlan de compras:`
        );
        return {
          text: `🛒 **Plan de Compras**\n\n${content}`,
          intent: "generate_document",
          data: { type: "purchase_plan", items: lowMaterials.map(m => ({ name: m.name, sku: m.sku, stock: m.stock, minStock: m.minStock, unit: m.unit, unitCost: m.unitCost })) },
          suggestions: ["Ver materiales", "Generar orden"],
        };
      }

      case "custom": {
        if (!args.description) {
          return { text: "Describí qué documento necesitás.", intent: "generate_document", suggestions: ["Ejemplo: generate document tipo custom description: Informe de..."] };
        }
        const contextData = await getGeneralContext();
        const content = await groqGenerate(
          systemPrompt + "\n\nRespondé en markdown.",
          `Contexto del sistema:\n${contextData}\n\n---\n\nPedido del usuario: ${args.description}`
        );
        return {
          text: `📄 **Documento: ${args.title || "Personalizado"}**\n\n${content}`,
          intent: "generate_document",
          data: { type: "custom", title: args.title },
          suggestions: ["Genera otro documento", "Guardar como模板"],
        };
      }

      default:
        return { text: `❌ Tipo de documento "${args.type}" no soportado.`, intent: "generate_document", suggestions: ["project_report", "budget_summary", "financial_report", "task_summary", "inventory_report"] };
    }
  } catch (err: any) {
    // Si Groq falla, devolver documento básico sin enriquecimiento
    if (args.type === "project_report") {
      const project = await resolveProject(args.projectRef);
      if (project) {
        const income = project.transactions?.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + t.amount, 0) || 0;
        const expense = project.transactions?.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0) || 0;
        return {
          text: `📄 **Informe de Proyecto: ${project.name}**\n\n**Estado:** ${project.status} | **Avance:** ${project.progress}%\n**Presupuesto:** $${project.budget.toLocaleString("es-AR")}\n**Ingresos:** $${income.toLocaleString("es-AR")} | **Gastos:** $${expense.toLocaleString("es-AR")}\n**Margen:** $${(income - expense).toLocaleString("es-AR")}\n\n*⚠️ Informe básico (Groq no disponible para enriquecimiento)*`,
          intent: "generate_document",
          data: { type: "project_report", fallback: true },
          suggestions: ["Ver proyecto", "Ver transacciones"],
        };
      }
    }
    return {
      text: `❌ No pude generar el documento: ${err.message}`,
      intent: "generate_document",
      suggestions: ["Intentar de nuevo"],
    };
  }
}

// ──────────────────────────────────────────────────────────────
// Contexto general para documentos custom
// ──────────────────────────────────────────────────────────────

async function getGeneralContext(): Promise<string> {
  try {
    const [projects, tasks, materials, suppliers] = await Promise.all([
      db.project.count(),
      db.task.count({ where: { status: { not: "completed" } } }),
      db.material.count({ where: { stock: { gt: 0 } } }),
      db.supplier.count(),
    ]);
    return `ObraCero CRM: ${projects} proyectos | ${tasks} tareas activas | ${materials} materiales en stock | ${suppliers} proveedores`;
  } catch {
    return "ObraCero CRM — Sistema de gestión de construcción";
  }
}

// ─── Schema mapping ────────────────────────────────────────────

export const documentToolSchemas = {
  generate_document: GenerateDocumentSchema,
} as const;
// ============================================================
// EXTENSIÓN DEL AGENTE IA — Capacidades avanzadas
// ============================================================
// Este módulo extiende el agente base con:
//  - Smart Unknown Handler: fuzzy matching cuando no entiende
//  - Multi-intent parsing: comandos compuestos ("y")
//  - Acciones de editar: obras, tareas, materiales
//  - Acciones de eliminar: tareas, materiales, transacciones
//  - Integración con workflows
//  - Levenshtein distance para matching difuso
// ============================================================

import { db } from "@/lib/db";
import { parseIntent, normalize, generateSku, type Intent, type ParsedCommand, type AgentResponse, type AgentActionItem } from "./agent";
import { executeWorkflow } from "./workflow-engine";
import { createWorkflowFromText, generateWorkflowCreatedResponse } from "./workflow-from-text";
import { queryRAG } from "./agent-rag";
import { detectPatterns, generatePredictiveResponse, createWorkflowFromSuggestion } from "./agent-predictive";
import {
  savePendingDelete,
  getPendingDelete,
  clearPendingDelete,
  saveUndoSnapshot,
  executeUndo,
  findUndoSnapshot,
  isConfirmation,
  isCancellation,
} from "./agent-memory";

// ─── Helpers locales ───

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: decimals }).format(value);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Levenshtein Distance ───

function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;
  const matrix: number[][] = [];
  for (let i = 0; i <= bLen; i++) matrix[i] = [i];
  for (let j = 0; j <= aLen; j++) matrix[0][j] = j;
  for (let i = 1; i <= bLen; i++) {
    for (let j = 1; j <= aLen; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[bLen][aLen];
}

// ─── Palabras clave por intent para fuzzy matching ───

const INTENT_KEYWORDS: Record<string, string[]> = {
  greeting: ["hola", "buenas", "hey"],
  query_profit: ["ganancia", "utilidad", "beneficio", "rentabilidad", "gane"],
  query_expenses: ["gasto", "egreso", "gaste"],
  query_income: ["ingreso", "venta", "cobranza", "factura"],
  query_cashflow: ["flujo", "caja", "liquidez", "cashflow"],
  query_kpis: ["kpi", "indicador", "metrica"],
  query_top_expense: ["en que gaste", "mayor gasto", "gasto mas", "rubro"],
  query_top_supplier: ["proveedor mas", "a quien compro"],
  query_margin_by_project: ["margen por obra", "rentabilidad obra"],
  query_compare_period: ["comparar", "mes anterior", "evolucion", "variacion"],
  query_anomalies: ["anomalia", "atipico", "raro", "inusual"],
  query_stock: ["stock", "inventario", "deposito"],
  query_low_stock: ["stock bajo", "falta", "reponer", "faltan materiales"],
  query_stock_value: ["valor inventario", "valor stock", "cuanto tengo en stock"],
  query_material_history: ["historial material", "movimientos de"],
  query_dead_stock: ["stock muerto", "sin rotar", "inmovilizado"],
  query_project_status: ["estado obras", "como van las obras", "avance obras"],
  query_project_detail: ["detalle obra", "info obra", "como va la obra"],
  query_project_profitability: ["obra gana", "obra rentable", "ganancia por obra"],
  predict_budget: ["presupuesto", "proyectar", "estimar", "proyeccion"],
  predict_project_eta: ["cuando termina", "eta", "finalizacion"],
  query_supplier: ["proveedor", "proveedores", "quien vende"],
  query_best_supplier: ["mejor proveedor", "mas barato", "economico"],
  query_tasks: ["tarea", "pendiente", "que hacer", "todo"],
  query_overdue_tasks: ["tarea atrasada", "vencida"],
  alert_check: ["alerta", "novedad", "problema", "que pasa"],
  recommend: ["recomendacion", "sugerencia", "ahorrar", "optimizar", "consejo"],
  summarize: ["resumen", "informe", "reporte", "como vamos", "panorama"],
  help: ["ayuda", "help", "que podes hacer", "comandos", "como funciona"],
  action_create_expense: ["registrar gasto", "nuevo gasto", "gaste"],
  action_create_income: ["registrar ingreso", "nuevo ingreso", "cobro"],
  action_create_task: ["crear tarea", "nueva tarea", "recordame", "tengo que"],
  action_close_project: ["cerrar obra", "cerrar proyecto"],
  action_add_materials: ["crear material", "agregar material", "crea materiales"],
  action_add_stock_movement: ["entrada de stock", "salida de stock", "consumo"],
  action_create_project_direct: ["crear obra llamada", "nueva obra", "alta de obra"],
  action_create_supplier: ["crear proveedor", "nuevo proveedor", "alta proveedor"],
  action_update_project_progress: ["actualizar avance", "progreso obra", "va al"],
  action_update_project_status: ["cambiar estado obra", "poner obra como"],
  action_complete_task: ["completar tarea", "terminar tarea", "marcar como hecha"],
  action_reorder: ["reordenar", "reponer", "pedido compra", "generar pedido"],
  action_edit_project: ["editar obra", "cambiar nombre obra", "modificar obra"],
  action_edit_task: ["editar tarea", "modificar tarea", "cambiar tarea"],
  action_edit_material: ["editar material", "modificar material", "cambiar precio material"],
  action_delete_task: ["eliminar tarea", "borrar tarea", "remover tarea"],
  action_delete_material: ["eliminar material", "borrar material"],
  action_delete_transaction: ["eliminar gasto", "borrar gasto", "eliminar movimiento"],
  action_trigger_workflow: ["ejecutar workflow", "correr workflow", "activar workflow"],
  action_list_workflows: ["listar workflows", "que workflows", "ver workflows"],
  config_list_automations: ["automatizacion", "reglas", "ver automatizaciones"],
  query_supplier_compare: ["comparar proveedor", "comparar precios", "quien vende mas barato", "diferencia precio"],
  query_purchase_plan: ["plan compra", "que comprar este mes", "necesito comprar", "compras mensual"],
  query_expense_trend: ["tendencia gasto", "evolucion gasto", "serie gasto", "historial categoria"],
  action_export_data: ["exportar", "descargar", "generar reporte", "crear informe", "csv", "pdf"],
};

// ─── Intent labels para smart unknown ───

const INTENT_LABELS: Record<string, string> = {
  ...(
    Object.fromEntries(
      Object.entries({
        greeting: "Saludar",
        query_profit: "Ver ganancias",
        query_expenses: "Ver gastos",
        query_income: "Ver ingresos",
        query_cashflow: "Ver flujo de caja",
        query_kpis: "Ver KPIs",
        query_top_expense: "Ver top de gastos",
        query_margin_by_project: "Ver margen por obra",
        query_compare_period: "Comparar períodos",
        query_anomalies: "Detectar anomalías",
        query_stock: "Ver stock",
        query_low_stock: "Ver stock bajo",
        query_stock_value: "Valor del inventario",
        query_material_history: "Historial de material",
        query_dead_stock: "Ver stock muerto",
        query_project_status: "Estado de obras",
        query_project_detail: "Detalle de obra",
        query_project_profitability: "Rentabilidad por obra",
        predict_budget: "Proyección de presupuesto",
        predict_project_eta: "ETA de obra",
        query_supplier: "Ver proveedores",
        query_best_supplier: "Mejor proveedor",
        query_tasks: "Ver tareas",
        query_overdue_tasks: "Tareas atrasadas",
        alert_check: "Ver alertas",
        recommend: "Recomendaciones",
        summarize: "Resumen general",
        help: "Ver ayuda",
        action_create_expense: "Registrar gasto",
        action_create_income: "Registrar ingreso",
        action_create_task: "Crear tarea",
        action_close_project: "Cerrar obra",
        action_add_materials: "Agregar materiales",
        action_add_stock_movement: "Movimiento de stock",
        action_create_project_direct: "Crear obra",
        action_create_supplier: "Crear proveedor",
        action_update_project_progress: "Actualizar avance",
        action_update_project_status: "Cambiar estado obra",
        action_complete_task: "Completar tarea",
        action_reorder: "Generar pedido",
        action_edit_project: "Editar obra",
        action_edit_task: "Editar tarea",
        action_edit_material: "Editar material",
        action_delete_task: "Eliminar tarea",
        action_delete_material: "Eliminar material",
        action_delete_transaction: "Eliminar gasto",
        action_trigger_workflow: "Ejecutar workflow",
        action_list_workflows: "Listar workflows",
        config_list_automations: "Ver automatizaciones",
        query_supplier_compare: "Comparar proveedores",
        query_purchase_plan: "Plan de compras",
        query_expense_trend: "Tendencias de gastos",
        action_export_data: "Exportar datos",
      } as Record<string, string>)
    )
  ),
};

// ─── Smart Unknown Handler ───

export function findClosestIntent(text: string): { intent: string; score: number } | null {
  const norm = normalize(text);
  const words = norm.split(/\s+/).filter(w => w.length > 2);
  let best: { intent: string; score: number } | null = null;
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      const kwNorm = normalize(kw);
      if (norm.includes(kwNorm)) score += 10;
      for (const word of words) {
        if (kwNorm.includes(word) || word.includes(kwNorm)) score += 3;
        if (Math.abs(word.length - kwNorm.length) <= 2) {
          const dist = levenshteinDistance(word, kwNorm);
          if (dist <= 1) score += 5;
          else if (dist <= 2) score += 2;
        }
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { intent, score };
  }
  return best;
}

// ─── Multi-intent parsing ───

export function parseMultiIntent(text: string): { intents: ParsedCommand[]; combined: boolean } {
  const splitPatterns = [
    /^(.*?)\s+y\s+(?:tambien\s+)?(?:que\s+)?(?:me\s+)?(?:puedes\s+|podes\s+)?(.*)$/i,
    /^(.*?)\s+y\s+(?:despues|ademas|tambien)\s+(.*)$/i,
  ];
  for (const pattern of splitPatterns) {
    const match = text.match(pattern);
    if (match) {
      const first = match[1].trim();
      const second = match[2].trim();
      if (first.length > 5 && second.length > 5) {
        const p1 = parseIntent(first);
        const p2 = parseIntent(second);
        if (p1.intent !== "unknown" && p2.intent !== "unknown") {
          return { intents: [p1, p2], combined: true };
        }
      }
    }
  }
  return { intents: [parseIntent(text)], combined: false };
}

// ─── Resolver proyecto ───

async function resolveProject(ref?: string) {
  if (!ref) return null;
  const norm = normalize(ref);
  if (/^\d+$/.test(norm)) {
    const padded = norm.padStart(3, "0");
    return await db.project.findFirst({
      where: { OR: [{ code: `OB-${padded}` }, { code: { contains: norm } }] },
      include: { transactions: true, tasks: true },
    });
  }
  if (/^ob[-\s]?\d+$/i.test(norm)) {
    return await db.project.findFirst({
      where: { code: { contains: norm.replace(/\s/, "-").toUpperCase() } },
      include: { transactions: true, tasks: true },
    });
  }
  const all = await db.project.findMany({ include: { transactions: true, tasks: true } });
  let found = all.find(p => normalize(p.name) === norm);
  if (found) return found;
  found = all.find(p => normalize(p.name).includes(norm) || norm.includes(normalize(p.name)));
  if (found) return found;
  const words = norm.split(" ").filter(w => w.length > 2);
  if (words.length > 0) {
    let best: typeof all[0] | null = null;
    let bestScore = 0;
    for (const p of all) {
      const pn = normalize(p.name);
      const score = words.filter(w => pn.includes(w)).length;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (bestScore > 0) return best;
  }
  return null;
}

// ─── Smart unknown response ───

export function generateSmartUnknownResponse(text: string, closest: { intent: string; score: number } | null): AgentResponse {
  const intentLabels: Record<string, string> = {
    greeting: "Saludar",
    query_profit: "Ver ganancias",
    query_expenses: "Ver gastos",
    query_income: "Ver ingresos",
    query_cashflow: "Ver flujo de caja",
    query_kpis: "Ver KPIs",
    query_top_expense: "Ver top de gastos",
    query_margin_by_project: "Ver margen por obra",
    query_compare_period: "Comparar períodos",
    query_anomalies: "Detectar anomalías",
    query_stock: "Ver stock",
    query_low_stock: "Ver stock bajo",
    query_stock_value: "Valor del inventario",
    query_material_history: "Historial de material",
    query_dead_stock: "Ver stock muerto",
    query_project_status: "Estado de obras",
    query_project_detail: "Detalle de obra",
    query_project_profitability: "Rentabilidad por obra",
    predict_budget: "Proyección de presupuesto",
    predict_project_eta: "ETA de obra",
    query_supplier: "Ver proveedores",
    query_best_supplier: "Mejor proveedor",
    query_tasks: "Ver tareas",
    query_overdue_tasks: "Tareas atrasadas",
    alert_check: "Ver alertas",
    recommend: "Recomendaciones",
    summarize: "Resumen general",
    help: "Ver ayuda",
    action_create_expense: "Registrar gasto",
    action_create_income: "Registrar ingreso",
    action_create_task: "Crear tarea",
    action_close_project: "Cerrar obra",
    action_add_materials: "Agregar materiales",
    action_add_stock_movement: "Movimiento de stock",
    action_create_project_direct: "Crear obra",
    action_create_supplier: "Crear proveedor",
    action_update_project_progress: "Actualizar avance",
    action_update_project_status: "Cambiar estado obra",
    action_complete_task: "Completar tarea",
    action_reorder: "Generar pedido",
    action_edit_project: "Editar obra",
    action_edit_task: "Editar tarea",
    action_edit_material: "Editar material",
    action_delete_task: "Eliminar tarea",
    action_delete_material: "Eliminar material",
    action_delete_transaction: "Eliminar gasto",
    action_trigger_workflow: "Ejecutar workflow",
    action_list_workflows: "Listar workflows",
    config_list_automations: "Ver automatizaciones",
  };

  if (closest && closest.score >= 3) {
    const label = intentLabels[closest.intent] || closest.intent.replace(/_/g, " ");
    return {
      text: `No entendí exactamente, pero por cómo lo escribiste quizás querés **${label}**. ¿Es correcto?\n\nTambién podés escribir *ayuda* para ver todo lo que puedo hacer.`,
      intent: "unknown",
      suggestions: [label, "Ayuda", "¿Cómo vamos?"],
    };
  }

  return {
    text: `No estoy seguro de qué necesitás. Probá con alguna de estas opciones o escribí "ayuda" para ver todo lo que sé hacer.`,
    intent: "unknown",
    suggestions: [
      "¿Cómo vamos?",
      "¿Qué alertas hay?",
      "Recomendaciones",
      "Ayuda",
      "Estado de las obras",
      "¿Qué materiales faltan?",
    ],
  };
}

// ─── Handlers ───

// --- EDITAR OBRA ---
export async function handleEditProject(parsed: ParsedCommand, rawText: string): Promise<AgentResponse> {
  const projMatch = rawText.match(/OB[-\s]?(\d+)/i) || rawText.match(/(?:obra|proyecto)\s+["']?([\w\s]+?)["']?(?:\s*,|\s+nombre|\s+presupuesto|\s+cliente|$)/i);
  if (!projMatch) {
    return {
      text: `Decime qué obra querés editar. Ejemplo:\n\n*editar obra OB-001, nombre nuevo: Casa García*\n*editar obra OB-001, presupuesto: 5000000*\n*cambiar cliente de OB-001 a Juan Pérez*`,
      intent: "action_edit_project" as Intent,
      suggestions: ["Estado de obras", "Ayuda"],
    };
  }

  const project = await resolveProject(projMatch[1]);
  if (!project) {
    return { text: `No encontré la obra "${projMatch[1]}".`, intent: "action_edit_project" as Intent };
  }

  const updates: Record<string, any> = {};
  const nameMatch = rawText.match(/(?:nombre\s*(?:nuevo|):?\s*["']?([\w\s]+?)["']?(?:\s*,|$))/i);
  if (nameMatch) updates.name = nameMatch[1].trim();
  const budgetMatch = rawText.match(/(?:presupuesto\s*:?\s*\$?\s*([\d.,]+))/i);
  if (budgetMatch) updates.budget = parseFloat(budgetMatch[1].replace(/[.,]/g, ""));
  const clientMatch = rawText.match(/(?:cliente\s*:?\s*["']?([\w\s]+?)["']?(?:\s*,|$))/i);
  if (clientMatch) updates.clientName = clientMatch[1].trim();
  const addressMatch = rawText.match(/(?:direccion|dirección|ubicacion|ubicación)\s*:?\s*["']?([\w\s]+?)["']?(?:\s*,|$)/i);
  if (addressMatch) updates.address = addressMatch[1].trim();

  if (Object.keys(updates).length === 0) {
    return {
      text: `No entendí qué editar. Podés cambiar:\n- nombre\n- presupuesto\n- cliente\n- dirección\n\nEj: *editar obra OB-001, nombre nuevo: Remodelación Centro*`,
      intent: "action_edit_project" as Intent,
    };
  }

  const updated = await db.project.update({ where: { id: project.id }, data: updates });
  const changedFields = Object.entries(updates).map(([k, v]) => `• ${k}: ${k === "budget" ? formatCurrency(v) : v}`).join("\n");

  return {
    text: `✅ **${project.code}** actualizada:\n\n${changedFields}`,
    intent: "action_edit_project" as Intent,
    data: { project: updated },
    suggestions: [`Detalle de ${project.code}`, "Estado de obras"],
  };
}

// --- EDITAR TAREA ---
export async function handleEditTask(parsed: ParsedCommand, rawText: string): Promise<AgentResponse> {
  const allTasks = await db.task.findMany({ where: { status: { in: ["pending", "in_progress"] } }, include: { project: true } });
  if (allTasks.length === 0) return { text: "No hay tareas pendientes para editar.", intent: "action_edit_task" as Intent };

  const taskNameMatch = rawText.match(/(?:tarea\s+)?["']?([\w\s]+?)["']?(?:\s*,|\s+cambia|\s+pon|\s+modifica|$)/i);
  let task = taskNameMatch ? allTasks.find(t => normalize(t.title).includes(normalize(taskNameMatch[1]))) : null;

  if (!task) {
    const top5 = allTasks.slice(0, 5).map(t => `• ${t.title}`).join("\n");
    return {
      text: `No encontré la tarea. Pendientes:\n\n${top5}\n\nEj: *editar tarea "llamar proveedor", prioridad: alta*`,
      intent: "action_edit_task" as Intent,
    };
  }

  const updates: Record<string, any> = {};
  const titleMatch = rawText.match(/(?:nombre|titulo|título)\s*(?:nuevo|):?\s*["']?([\w\s]+?)["']?(?:\s*,|$)/i);
  if (titleMatch) updates.title = titleMatch[1].trim();
  const priorityMatch = rawText.match(/(prioridad|priority)\s*:?\s*(baja|media|alta|critical)/i);
  if (priorityMatch) {
    const pMap: Record<string, string> = { baja: "low", media: "medium", alta: "high", critical: "critical" };
    updates.priority = pMap[priorityMatch[2].toLowerCase()] || "medium";
  }
  const statusMatch = rawText.match(/(estado|status)\s*:?\s*(pendiente|completada|en curso|cancelada)/i);
  if (statusMatch) {
    const sMap: Record<string, string> = { pendiente: "pending", "en curso": "in_progress", completada: "completed", cancelada: "cancelled" };
    updates.status = sMap[statusMatch[2].toLowerCase()] || "pending";
  }
  const assigneeMatch = rawText.match(/(?:asignar?|responsable|encargado)\s*(?:a|:)?\s*["']?([\w\s]+?)["']?(?:\s*,|$)/i);
  if (assigneeMatch) updates.assignee = assigneeMatch[1].trim();

  if (Object.keys(updates).length === 0) {
    return {
      text: `No entendí qué editar. Podés cambiar: titulo, prioridad (baja/media/alta), estado, asignado a\n\nEj: *editar tarea "${task.title}", prioridad: alta*`,
      intent: "action_edit_task" as Intent,
    };
  }

  const updated = await db.task.update({ where: { id: task.id }, data: updates });
  const changed = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(", ");

  return {
    text: `✅ Tarea **"${task.title}"** actualizada: ${changed}`,
    intent: "action_edit_task" as Intent,
    data: { task: updated },
    suggestions: ["Ver tareas", `Completar tarea: ${task.title}`],
  };
}

// --- EDITAR MATERIAL ---
export async function handleEditMaterial(parsed: ParsedCommand, rawText: string): Promise<AgentResponse> {
  const all = await db.material.findMany();
  if (all.length === 0) return { text: "No hay materiales cargados.", intent: "action_edit_material" as Intent };

  const match = all.find(m => normalize(rawText).includes(normalize(m.name)));
  if (!match) {
    const names = all.slice(0, 5).map(m => m.name).join(", ");
    return {
      text: `No encontré el material. Tenés: ${names}${all.length > 5 ? "..." : ""}\n\nEj: *editar material cemento, precio: 1500*`,
      intent: "action_edit_material" as Intent,
    };
  }

  const updates: Record<string, any> = {};
  const priceMatch = rawText.match(/(?:precio|costo|price)\s*:?\s*\$?\s*([\d.,]+)/i);
  if (priceMatch) updates.unitCost = parseFloat(priceMatch[1].replace(/[,]/g, ""));
  const stockMatch = rawText.match(/(?:stock|cantidad)\s*:?\s*([\d.,]+)/i);
  if (stockMatch) updates.stock = parseFloat(stockMatch[1].replace(/[,]/g, ""));
  const minStockMatch = rawText.match(/(?:minimo|mínimo|min)\s*:?\s*([\d.,]+)/i);
  if (minStockMatch) updates.minStock = parseFloat(minStockMatch[1].replace(/[,]/g, ""));

  if (Object.keys(updates).length === 0) {
    return {
      text: `No entendí qué editar de **${match.name}**. Podés cambiar: precio, stock, mínimo\n\nEj: *editar material ${match.name}, precio: 2000*`,
      intent: "action_edit_material" as Intent,
    };
  }

  const updated = await db.material.update({ where: { id: match.id }, data: updates });
  return {
    text: `✅ Material **${match.name}** actualizado.\n${Object.entries(updates).map(([k, v]) => `• ${k}: ${v}`).join("\n")}`,
    intent: "action_edit_material" as Intent,
    data: { material: updated },
    suggestions: ["Ver inventario", "¿Qué stock tengo?"],
  };
}

// --- ELIMINAR TAREA ---
export async function handleDeleteTask(parsed: ParsedCommand, rawText: string): Promise<AgentResponse> {
  const allTasks = await db.task.findMany({ where: { status: { not: "completed" } }, include: { project: true } });
  if (allTasks.length === 0) return { text: "No hay tareas pendientes.", intent: "action_delete_task" as Intent };

  const taskNameMatch = rawText.match(/(?:tarea\s+)?["']?([\w\s]+?)["']?(?:\s*,|$)/i);
  let task = taskNameMatch ? allTasks.find(t => normalize(t.title).includes(normalize(taskNameMatch[1]))) : null;

  if (!task) {
    const top5 = allTasks.slice(0, 5).map(t => `• ${t.title}`).join("\n");
    return {
      text: `No encontré la tarea. Pendientes:\n\n${top5}\n\nEj: *eliminar tarea "llamar proveedor"*`,
      intent: "action_delete_task" as Intent,
    };
  }

  // Guardar snapshot para undo antes de eliminar
  const taskSnapshot = await db.task.findUnique({ where: { id: task.id } });
  const snapshotData = taskSnapshot ? JSON.parse(JSON.stringify(taskSnapshot)) : {};

  // En lugar de eliminar inmediatamente, pedir confirmación
  await savePendingDelete({
    type: "task",
    id: task.id,
    label: `Tarea "${task.title}"`,
    details: `Título: ${task.title}${task.project?.code ? ` | Obra: ${task.project.code}` : ""}${task.dueDate ? ` | Vence: ${formatDate(task.dueDate)}` : ""}`,
    timestamp: Date.now(),
    snapshot: snapshotData,
  });

  return {
    text: `⚠️ **¿Confirmás que querés eliminar esta tarea?**\n\n**"${task.title}"**${task.project?.code ? ` (${task.project.code})` : ""}\n${task.dueDate ? `Vence: ${formatDate(task.dueDate)}` : ""}\n\n---\n\nRespondé **"sí"** para eliminar o **"no"** para cancelar.`,
    intent: "action_delete_task" as Intent,
    _requiresConfirmation: true,
    suggestions: ["Sí, eliminar", "No, cancelar"],
  } as AgentResponse & { _requiresConfirmation: boolean };
}

// --- ELIMINAR MATERIAL ---
export async function handleDeleteMaterial(parsed: ParsedCommand, rawText: string): Promise<AgentResponse> {
  const all = await db.material.findMany();
  if (all.length === 0) return { text: "No hay materiales cargados.", intent: "action_delete_material" as Intent };

  const match = all.find(m => normalize(rawText).includes(normalize(m.name)));
  if (!match) {
    const names = all.slice(0, 5).map(m => m.name).join(", ");
    return {
      text: `No encontré el material. Tenés: ${names}${all.length > 5 ? "..." : ""}\n\nEj: *eliminar material cemento*`,
      intent: "action_delete_material" as Intent,
      suggestions: ["Ver inventario"],
    };
  }

  if (match.stock > 0) {
    return {
      text: `⚠️ **${match.name}** tiene ${formatNumber(match.stock)} ${match.unit} en stock. Primero ajustá el stock a 0 desde Inventario.`,
      intent: "action_delete_material" as Intent,
      suggestions: ["Ver inventario"],
    };
  }

  // Guardar snapshot para undo
  const matSnapshot = await db.material.findUnique({ where: { id: match.id } });
  const snapshotData = matSnapshot ? JSON.parse(JSON.stringify(matSnapshot)) : {};

  // En lugar de eliminar inmediatamente, pedir confirmación
  await savePendingDelete({
    type: "material",
    id: match.id,
    label: `Material "${match.name}"`,
    details: `Stock: ${formatNumber(match.stock)} ${match.unit} | SKU: ${match.sku}`,
    timestamp: Date.now(),
    snapshot: snapshotData,
  });

  return {
    text: `⚠️ **¿Confirmás que querés eliminar este material?**\n\n**${match.name}** (${match.sku})\nStock: ${formatNumber(match.stock)} ${match.unit}\n\n---\n\nRespondé **"sí"** para eliminar o **"no"** para cancelar.`,
    intent: "action_delete_material" as Intent,
    _requiresConfirmation: true,
    suggestions: ["Sí, eliminar", "No, cancelar"],
  } as AgentResponse & { _requiresConfirmation: boolean };
}

// --- ELIMINAR TRANSACCIÓN ---
export async function handleDeleteTransaction(parsed: ParsedCommand, rawText: string): Promise<AgentResponse> {
  const transactions = await db.transaction.findMany({
    orderBy: { date: "desc" }, take: 20, include: { project: true },
  });
  if (transactions.length === 0) return { text: "No hay movimientos.", intent: "action_delete_transaction" as Intent };

  const amountMatch = rawText.match(/\$?\s*([\d.,]+)/);
  let tx = amountMatch
    ? transactions.find(t => Math.abs(t.amount - parseFloat(amountMatch[1].replace(/[,]/g, ""))) < 100)
    : null;

  if (!tx) {
    const recent = transactions.slice(0, 5).map(t =>
      `• ${formatDate(t.date)} — ${t.type === "expense" ? "Gasto" : "Ingreso"} de ${formatCurrency(t.amount)} — ${t.description}${t.project ? ` (${t.project.code})` : ""}`
    ).join("\n");
    return {
      text: `No encontré el movimiento. Últimos:\n\n${recent}\n\nEj: *eliminar gasto de $50000*`,
      intent: "action_delete_transaction" as Intent,
    };
  }

  // Guardar snapshot para undo antes de eliminar
  const txSnapshot = await db.transaction.findUnique({ where: { id: tx.id } });
  const snapshotData = txSnapshot ? JSON.parse(JSON.stringify(txSnapshot)) : {};

  // En lugar de eliminar inmediatamente, pedir confirmación
  await savePendingDelete({
    type: "transaction",
    id: tx.id,
    label: `${tx.type === "expense" ? "Gasto" : "Ingreso"} de ${formatCurrency(tx.amount)}`,
    details: `${formatDate(tx.date)} | ${tx.description}${tx.project ? ` | ${tx.project.code}` : ""} | ${formatCurrency(tx.amount)}`,
    timestamp: Date.now(),
    snapshot: snapshotData,
  });

  return {
    text: `⚠️ **¿Confirmás que querés eliminar este movimiento?**\n\n${tx.type === "expense" ? "Gasto" : "Ingreso"} de **${formatCurrency(tx.amount)}**\nFecha: ${formatDate(tx.date)}\nDescripción: ${tx.description}${tx.project ? `\nObra: ${tx.project.code}` : ""}\n\n---\n\nRespondé **"sí"** para eliminar o **"no"** para cancelar.`,
    intent: "action_delete_transaction" as Intent,
    _requiresConfirmation: true,
    suggestions: ["Sí, eliminar", "No, cancelar"],
  } as AgentResponse & { _requiresConfirmation: boolean };
}

// --- TRIGGER WORKFLOW ---
export async function handleTriggerWorkflow(parsed: ParsedCommand, rawText: string): Promise<AgentResponse> {
  const workflows = await db.workflow.findMany({ where: { enabled: true } });
  if (workflows.length === 0) {
    return {
      text: "No hay workflows activos. Creá uno desde Automatizaciones.",
      intent: "action_trigger_workflow" as Intent,
      suggestions: ["Ver automatizaciones", "Ayuda"],
    };
  }

  const wfNameMatch = rawText.match(/(?:workflow|automatizacion|automatización)\s+["']?([\w\s]+?)["']?(?:\s*,|$)/i);
  let workflow = wfNameMatch ? workflows.find(w => normalize(w.name).includes(normalize(wfNameMatch[1]))) : null;

  if (!workflow && !wfNameMatch) {
    const lines = workflows.map((w, i) => `${i + 1}. ${w.name} ${w.enabled ? "(activo)" : "(inactivo)"}`).join("\n");
    return {
      text: `Workflows activos:\n\n${lines}\n\nDecime cuál querés ejecutar. Ej: *ejecutar workflow "Stock bajo"*`,
      intent: "action_trigger_workflow" as Intent,
      suggestions: ["Ver automatizaciones"],
    };
  }

  if (!workflow) {
    return {
      text: `No encontré ese workflow. Ej: *ejecutar workflow "Stock bajo"*`,
      intent: "action_trigger_workflow" as Intent,
      suggestions: ["Ver automatizaciones"],
    };
  }

  try {
    const result = await executeWorkflow(workflow.id, "manual");
    return {
      text: `🚀 Workflow **"${workflow.name}"** ejecutado${result.success ? " correctamente ✅" : " con errores ⚠️"}.\n\nPasos: ${result.logs.length} | Completados: ${result.logs.filter(l => l.status === "completed").length} | Fallos: ${result.logs.filter(l => l.status === "failed").length}`,
      intent: "action_trigger_workflow" as Intent,
      data: { result },
      suggestions: ["Ver automatizaciones", "Ejecutar otro workflow"],
    };
  } catch (error: any) {
    return { text: `Error: ${error.message}`, intent: "action_trigger_workflow" as Intent };
  }
}

// ─── Handlers nuevos: Prioridad 2 ───

// --- COMPARAR PROVEEDORES ---
export async function handleSupplierCompare(parsed: ParsedCommand, rawText: string): Promise<AgentResponse> {
  const suppliers = await db.supplier.findMany({ include: { materials: true, transactions: true } });
  if (suppliers.length < 2) {
    return { text: "Necesito al menos 2 proveedores para comparar.", intent: "unknown" };
  }

  // Extraer nombres de proveedores del texto
  const supplierNames = suppliers.map(s => normalize(s.name));
  const norm = normalize(rawText);
  const mentioned = suppliers.filter(s => norm.includes(normalize(s.name)));

  if (mentioned.length < 2) {
    const list = suppliers.slice(0, 5).map(s => s.name).join(", ");
    return {
      text: `Decime qué 2 proveedores querés comparar. Tenés: ${list}${suppliers.length > 5 ? "..." : ""}\n\nEj: *compará precios de cemento entre ProveedorA y ProveedorB*`,
      intent: "unknown",
      suggestions: suppliers.slice(0, 3).map(s => `comparar ${suppliers[0].name} vs ${s.name}`),
    };
  }

  // Buscar materiales compartidos entre ambos
  const [a, b] = mentioned;
  const sharedMaterials = a.materials.filter(ma =>
    b.materials.some(mb => normalize(mb.name).includes(normalize(ma.name)) || normalize(ma.name).includes(normalize(mb.name)))
  );

  const aTotal = a.transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const bTotal = b.transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  let comparisonText = `**${a.name}** vs **${b.name}**\n\n`;
  comparisonText += `**Rating:** ${a.rating}/5 vs ${b.rating}/5\n`;
  comparisonText += `**Gasto total:** ${formatCurrency(aTotal)} vs ${formatCurrency(bTotal)}\n`;
  comparisonText += `**Materiales:** ${a.materials.length} vs ${b.materials.length}\n\n`;

  if (sharedMaterials.length > 0) {
    comparisonText += `**Comparación de precios:**\n`;
    for (const ma of sharedMaterials.slice(0, 5)) {
      const mb = b.materials.find(m => normalize(m.name).includes(normalize(ma.name)));
      if (mb) {
        const cheaper = ma.unitCost < mb.unitCost ? a.name : b.name;
        comparisonText += `• ${ma.name}: ${formatCurrency(ma.unitCost)} vs ${formatCurrency(mb.unitCost)} → más barato en **${cheaper}**\n`;
      }
    }
  } else {
    comparisonText += `No comparten materiales en común para comparar precios.`;
  }

  return {
    text: comparisonText,
    intent: "unknown",
    suggestions: ["Mejor proveedor", "Ver proveedores"],
  };
}

// --- PLAN DE COMPRAS ---
export async function handlePurchasePlan(): Promise<AgentResponse> {
  const activeProjects = await db.project.findMany({
    where: { status: "in_progress" },
    include: { tasks: true },
  });

  const allMats = await db.material.findMany({ include: { supplier: true } });
  const lowStock = allMats.filter(m => m.stock <= m.minStock && m.minStock > 0);

  const allMaterials = await db.material.findMany({ include: { supplier: true } });

  if (activeProjects.length === 0 && lowStock.length === 0) {
    return {
      text: "No hay obras activas ni materiales bajos de stock. No hace falta planificar compras este mes.",
      intent: "unknown",
      suggestions: ["Ver inventario", "Ver obras"],
    };
  }

  let text = `**Plan de compras mensual**\n\n`;

  if (activeProjects.length > 0) {
    text += `**Obras activas (${activeProjects.length}):**\n`;
    for (const p of activeProjects) {
      const tasks = p.tasks.filter(t => t.status !== "completed").length;
      text += `• ${p.code} ${p.name} — ${tasks} tareas pendientes\n`;
    }
    text += "\n";
  }

  if (lowStock.length > 0) {
    text += `**Materiales para reponer (${lowStock.length}):**\n`;
    const totalCost = lowStock.reduce((s, m) => {
      const needed = Math.max(0, m.minStock * 1.5 - m.stock);
      return s + needed * m.unitCost;
    }, 0);

    for (const m of lowStock.slice(0, 10)) {
      const needed = Math.max(0, m.minStock * 1.5 - m.stock);
      const cost = needed * m.unitCost;
      text += `• ${m.name}: pedir ${formatNumber(needed)} ${m.unit} — ${formatCurrency(cost)}${m.supplier ? ` (${m.supplier.name})` : ""}\n`;
    }
    if (lowStock.length > 10) text += `... y ${lowStock.length - 10} más\n`;
    text += `\n**Costo total estimado:** ${formatCurrency(totalCost)}\n`;
  }

  return {
    text,
    intent: "unknown",
    suggestions: ["Generar pedido de compra", "Ver inventario", "Ver obras"],
  };
}

// --- TENDENCIAS DE GASTOS ---
export async function handleExpenseTrend(): Promise<AgentResponse> {
  const transactions = await db.transaction.findMany({
    where: { type: "expense" },
    orderBy: { date: "asc" },
  });

  if (transactions.length === 0) {
    return { text: "No hay gastos registrados para analizar tendencias.", intent: "unknown" };
  }

  // Agrupar por mes y categoría
  const byMonth: Record<string, Record<string, number>> = {};
  for (const t of transactions) {
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = {};
    byMonth[key][t.category] = (byMonth[key][t.category] || 0) + t.amount;
  }

  const months = Object.keys(byMonth).sort();
  const lastMonths = months.slice(-6);

  // Top 3 categorías en el último mes
  const lastMonth = lastMonths[lastMonths.length - 1];
  const topCategories = lastMonth
    ? Object.entries(byMonth[lastMonth])
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([cat]) => cat)
    : [];

  let text = `**Tendencias de gastos**\n\n`;
  text += `Últimos ${lastMonths.length} meses:\n\n`;

  for (const month of lastMonths) {
    const total = Object.values(byMonth[month]).reduce((s, v) => s + v, 0);
    text += `**${month}:** ${formatCurrency(total)}\n`;
    for (const cat of topCategories) {
      const amount = byMonth[month][cat] || 0;
      const bar = "█".repeat(Math.max(1, Math.round(amount / (total / 10))));
      text += `  ${cat.replace(/_/g, " ")}: ${formatCurrency(amount)} ${bar}\n`;
    }
    text += "\n";
  }

  return {
    text,
    intent: "unknown",
    data: { byMonth: lastMonths.map(m => ({ month: m, categories: byMonth[m] })) },
    suggestions: ["Comparar con mes anterior", "Recomendaciones"],
  };
}

// --- EXPORTAR DATOS ---
export async function handleExportData(parsed: ParsedCommand, rawText: string): Promise<AgentResponse> {
  const norm = normalize(rawText);
  let csv = "";
  let filename = "reporte";

  if (/gasto/i.test(norm) || /finanza/i.test(norm) || /movimiento/i.test(norm)) {
    const transactions = await db.transaction.findMany({
      orderBy: { date: "desc" }, take: 100, include: { project: true, supplier: true },
    });
    csv = "Fecha,Tipo,Categoría,Descripción,Monto,Proyecto,Proveedor\n";
    for (const t of transactions) {
      const safeDesc = t.description.replace(/"/g, '""');
      csv += `${formatDate(t.date)},${t.type},${t.category},"${safeDesc}",${t.amount},${t.project?.code || ""},${t.supplier?.name || ""}\n`;
    }
    filename = "movimientos-financieros";
  } else if (/material/i.test(norm) || /stock/i.test(norm) || /inventario/i.test(norm)) {
    const materials = await db.material.findMany({ include: { supplier: true } });
    csv = "SKU,Nombre,Categoría,Unidad,Stock,Stock Mínimo,Costo Unitario,Valor Total,Proveedor\n";
    for (const m of materials) {
      csv += `${m.sku},"${m.name}",${m.category},${m.unit},${m.stock},${m.minStock},${m.unitCost},${m.stock * m.unitCost},${m.supplier?.name || ""}\n`;
    }
    filename = "inventario";
  } else if (/obra/i.test(norm)) {
    const projects = await db.project.findMany({ include: { transactions: true } });
    csv = "Código,Nombre,Estado,Presupuesto,Avance%,Ingresos,Gastos,Cliente\n";
    for (const p of projects) {
      const income = p.transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const spent = p.transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      csv += `${p.code},"${p.name}",${p.status},${p.budget},${p.progress},${income},${spent},"${p.clientName || ""}"\n`;
    }
    filename = "obras";
  } else if (/tarea/i.test(norm)) {
    const tasks = await db.task.findMany({ include: { project: true }, orderBy: { createdAt: "desc" }, take: 100 });
    csv = "Título,Estado,Prioridad,Vence,Asignado,Obra,Creado\n";
    for (const t of tasks) {
      csv += `"${t.title}",${t.status},${t.priority},${t.dueDate ? formatDate(t.dueDate) : ""},${t.assignee || ""},${t.project?.code || ""},${formatDate(t.createdAt)}\n`;
    }
    filename = "tareas";
  } else if (/proveedor/i.test(norm)) {
    const suppliers = await db.supplier.findMany();
    csv = "Nombre,Contacto,Teléfono,Email,Rubro,Rating\n";
    for (const s of suppliers) {
      csv += `"${s.name}","${s.contact || ""}","${s.phone || ""}","${s.email || ""}","${s.category || ""}",${s.rating}\n`;
    }
    filename = "proveedores";
  } else {
    // Default: resumen general
    const kpis = await Promise.all([
      db.transaction.aggregate({ _sum: { amount: true }, where: { type: "expense" } }),
      db.transaction.aggregate({ _sum: { amount: true }, where: { type: "income" } }),
      db.material.count(),
      db.project.count(),
      db.task.count({ where: { status: { not: "completed" } } }),
    ]);
    csv = `Resumen General\n`;
    csv += `Total Gastos,${kpis[0]._sum.amount || 0}\n`;
    csv += `Total Ingresos,${kpis[1]._sum.amount || 0}\n`;
    csv += `Materiales en Stock,${kpis[2]}\n`;
    csv += `Obras,${kpis[3]}\n`;
    csv += `Tareas Pendientes,${kpis[4]}\n`;
    filename = "resumen";
  }

  return {
    text: `📥 **Exportación generada**\n\nArchivo: **${filename}.csv**\n\n\`\`\`csv\n${csv.slice(0, 1500)}\n\`\`\`\n\n*(Mostrando primeras líneas — el archivo completo tiene ${csv.split("\n").length - 1} filas)*`,
    intent: "unknown",
    data: { csv, filename },
    suggestions: ["¿Cómo vamos?", "Ayuda"],
  };
}

// --- LISTAR WORKFLOWS ---
export async function handleListWorkflows(): Promise<AgentResponse> {
  const workflows = await db.workflow.findMany({
    include: { executions: { orderBy: { startedAt: "desc" }, take: 1 } },
  });
  if (workflows.length === 0) {
    return {
      text: "No hay workflows. Creá uno desde Automatizaciones.",
      intent: "action_list_workflows" as Intent,
      suggestions: ["Ver automatizaciones", "Ayuda"],
    };
  }
  const lines = workflows.map(w => {
    const lastExec = w.executions?.[0];
    const status = lastExec
      ? lastExec.status === "completed" ? "✅ ok" : lastExec.status === "failed" ? "❌ falló" : "🔄 ejecutando"
      : "⏳ sin ejecutar";
    return `• ${w.name} ${w.enabled ? "(activo)" : "(inactivo)"} — ${status}`;
  });
  return {
    text: `Workflows (${workflows.length}):\n\n${lines.join("\n")}`,
    intent: "action_list_workflows" as Intent,
    data: { workflows },
    suggestions: ["Ejecutar workflow", "Ver automatizaciones"],
  };
}

// ─── Sistema de confirmación para acciones destructivas (DB-backed) ───
// Las funciones savePendingDelete / getPendingDelete / clearPendingDelete,
// saveUndoSnapshot / findUndoSnapshot / executeUndo y
// isConfirmation / isCancellation vienen unificadas desde `agent-memory`.

// ─── Predictive suggestions (DB-backed) ───

async function savePredictiveSuggestions(suggestions: any[]): Promise<void> {
  try {
    const lastAgentMsg = await db.agentMessage.findFirst({
      where: { role: "agent" },
      orderBy: { createdAt: "desc" },
    });
    if (lastAgentMsg) {
      const meta = lastAgentMsg.meta ? JSON.parse(lastAgentMsg.meta) : {};
      meta._predictiveSuggestions = {
        suggestions,
        timestamp: Date.now(),
      };
      await db.agentMessage.update({
        where: { id: lastAgentMsg.id },
        data: { meta: JSON.stringify(meta).slice(0, 4000) },
      });
    }
  } catch {}
}

async function getPredictiveSuggestions(): Promise<{ suggestions: any[] } | null> {
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
        if (meta._predictiveSuggestions && Date.now() - meta._predictiveSuggestions.timestamp < 300000) {
          return meta._predictiveSuggestions;
        }
      } catch {}
    }
  } catch {}
  return null;
}

async function clearPredictiveSuggestions(): Promise<void> {
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
        if (meta._predictiveSuggestions) {
          delete meta._predictiveSuggestions;
          await db.agentMessage.update({
            where: { id: msg.id },
            data: { meta: JSON.stringify(meta).slice(0, 4000) || null },
          });
          break;
        }
      } catch {}
    }
  } catch {}
}

// ─── Multi-intent response ───

export function generateMultiIntentResponse(intents: ParsedCommand[], responses: AgentResponse[]): AgentResponse {
  const combinedText = responses.map((r, i) => `**${i + 1}.** ${r.text}`).join("\n\n---\n\n");
  const allSuggestions = [...new Set(responses.flatMap(r => r.suggestions || []))].slice(0, 4);
  return {
    text: `Procesé ambas acciones:\n\n${combinedText}`,
    intent: intents[0].intent,
    data: { individualResponses: responses },
    suggestions: allSuggestions.length > 0 ? allSuggestions : ["¿Cómo vamos?"],
  };
}

// Los handlers edit/delete/workflow/export ya están exportados arriba.

// ─── Punto de entrada extendido ───

export async function processExtendedMessage(
  text: string,
  originalMessage: string
): Promise<{ response: AgentResponse | null; wasExtended: boolean }> {
  const rawText = originalMessage || text;
  const norm = normalize(rawText);

  // 0. Verificar si hay una eliminación pendiente (DB-backed)
  const pd = await getPendingDelete();
  if (pd) {
    // Verificar expiración (2 minutos)
    if (Date.now() - (pd.timestamp || 0) > 120000) {
      await clearPendingDelete();
    } else if (isConfirmation(norm)) {
      // ✅ Confirmó la eliminación
      await clearPendingDelete();
      try {
        // Ejecutar con el id guardado
        const targetId = pd.id;
        // Construir la función execute basada en el tipo
        if (pd.type === "task") {
          await db.task.delete({ where: { id: targetId } });
        } else if (pd.type === "material") {
          await db.stockMovement.deleteMany({ where: { materialId: targetId } });
          await db.material.delete({ where: { id: targetId } });
        } else if (pd.type === "transaction") {
          await db.transaction.delete({ where: { id: targetId } });
        }

        // Guardar snapshot para undo
        if (pd.snapshot && Object.keys(pd.snapshot).length > 0) {
          const actionMap: Record<string, string> = { task: "delete_task", material: "delete_material", transaction: "delete_transaction" };
          await saveUndoSnapshot(
            pd.type,
            targetId,
            pd.snapshot,
            actionMap[pd.type] || "delete"
          );
        }

        return {
          response: {
            text: `✅ **Confirmado.**\n\n🗑️ **${pd.label}** eliminado correctamente.\n\n🔄 Podés deshacer esta acción diciendo *"deshacer"* o *"undo"* en los próximos 5 minutos.`,
            intent: "unknown",
            suggestions: ["Undo: deshacer", "Ver tareas", "Ver inventario", "Ver finanzas"],
            data: { _canUndo: true },
            route: pd.type === "task" ? "/tareas" : pd.type === "material" ? "/inventario" : "/finanzas",
          } as AgentResponse & { route?: string },
          wasExtended: true,
        };
      } catch (error: any) {
        return {
          response: {
            text: `❌ Error al eliminar: ${error.message}`,
            intent: "unknown",
          },
          wasExtended: true,
        };
      }
    } else if (isCancellation(norm)) {
      // ❌ Canceló
      await clearPendingDelete();
      return {
        response: {
          text: `❌ **Acción cancelada.** No se eliminó nada.`,
          intent: "unknown",
          suggestions: ["¿Cómo vamos?", "¿Qué alertas hay?"],
        },
        wasExtended: true,
      };
    }
    // Si no es ni confirmación ni cancelación, seguir con el flujo normal
  }

  // 1. Intentar multi-intent
  const multiResult = parseMultiIntent(rawText);
  if (multiResult.combined) {
    try {
      const { processAgentMessage } = await import("./agent");
      const responses: AgentResponse[] = [];
      for (const parsed of multiResult.intents) {
        const resp = await processAgentMessage(parsed.rawText || parsed.normalized);
        responses.push(resp);
      }
      return { response: generateMultiIntentResponse(multiResult.intents, responses), wasExtended: true };
    } catch {}
  }

  // 2. Detectar nuevos intents por palabras clave
  // --- EDITAR OBRA ---
  if (/(editar|modificar|cambiar|actualizar)\s+(obra|proyecto)/i.test(norm) ||
      /cambiar\s+(nombre|presupuesto|cliente)\s+(de\s+)?(la\s+)?(obra|proyecto)/i.test(norm)) {
    return { response: await handleEditProject(parseIntent(rawText), rawText), wasExtended: true };
  }

  // --- EDITAR TAREA ---
  if (/(editar|modificar|cambiar)\s+(la\s+)?tarea/i.test(norm)) {
    return { response: await handleEditTask(parseIntent(rawText), rawText), wasExtended: true };
  }

  // --- EDITAR MATERIAL ---
  if (/(editar|modificar|cambiar)\s+(el\s+)?material/i.test(norm) ||
      /cambiar\s+(precio|costo|stock|minimo)\s+(de\s+)?(el\s+)?material/i.test(norm)) {
    return { response: await handleEditMaterial(parseIntent(rawText), rawText), wasExtended: true };
  }

  // --- ELIMINAR TAREA (con confirmación) ---
  if (/(eliminar|borrar|remover|quitar)\s+(la\s+)?tarea/i.test(norm)) {
    return { response: await handleDeleteTask(parseIntent(rawText), rawText), wasExtended: true };
  }

  // --- ELIMINAR MATERIAL (con confirmación) ---
  if (/(eliminar|borrar|remover|quitar)\s+(el\s+)?material/i.test(norm)) {
    return { response: await handleDeleteMaterial(parseIntent(rawText), rawText), wasExtended: true };
  }

  // --- ELIMINAR GASTO / MOVIMIENTO (con confirmación) ---
  if (/(eliminar|borrar|remover|quitar)\s+(gasto|ingreso|movimiento)/i.test(norm)) {
    return { response: await handleDeleteTransaction(parseIntent(rawText), rawText), wasExtended: true };
  }

  // --- TRIGGER WORKFLOW ---
  if (/(ejecutar|correr|activar|lanzar)\s+(workflow|automatizacion)/i.test(norm)) {
    return { response: await handleTriggerWorkflow(parseIntent(rawText), rawText), wasExtended: true };
  }

  // --- LISTAR WORKFLOWS ---
  if (/(listar|ver|mostrar|que)\s+workflows/i.test(norm)) {
    return { response: await handleListWorkflows(), wasExtended: true };
  }

  // --- COMPARAR PROVEEDORES ---
  if (/(comparar|diferencia|vs)\s+(proveedor|precio)/i.test(norm) ||
      /quien\s+vende\s+mas\s+barato/i.test(norm)) {
    return { response: await handleSupplierCompare(parseIntent(rawText), rawText), wasExtended: true };
  }

  // --- PLAN DE COMPRAS ---
  if (/(plan\s+compra|que\s+comprar|compras\s+mensual|necesito\s+comprar)/i.test(norm)) {
    return { response: await handlePurchasePlan(), wasExtended: true };
  }

  // --- TENDENCIAS DE GASTOS ---
  if (/(tendencia|evolucion\s+gasto|serie|historial\s+categoria)/i.test(norm)) {
    return { response: await handleExpenseTrend(), wasExtended: true };
  }

  // --- EXPORTAR DATOS ---
  if (/(exportar|descargar|generar\s+reporte|crear\s+informe)/i.test(norm)) {
    return { response: await handleExportData(parseIntent(rawText), rawText), wasExtended: true };
  }

  // --- RAG: buscar respuesta similar en el historial ---
  // Si ningún handler específico matcheó, buscar en la memoria semántica
  // antes de devolver null. Esto permite que el agente "recuerde" respuestas
  // de conversaciones anteriores.
  try {
    const ragResult = await queryRAG(rawText);
    if (ragResult.found && ragResult.response) {
      return { response: ragResult.response, wasExtended: true };
    }
  } catch {
    // Silenciar errores de RAG
  }

  // --- DETECTAR PATRONES (sugerencias proactivas) ---
  if (/(que\s+recomendas\s+automatizar|que\s+workflow\s+me\s+recomendas|sugerime\s+una\s+automatizacion|detect[áa]\s+patrones)/i.test(norm)) {
    try {
      const suggestions = await detectPatterns();
      const response = generatePredictiveResponse(suggestions);
      // Guardar sugerencias en DB para que el usuario pueda aceptar con "1", "2", etc.
      if (suggestions.length > 0) {
        await savePredictiveSuggestions(suggestions);
      }
      return { response, wasExtended: true };
    } catch (error: any) {
      return {
        response: { text: `Error al analizar patrones: ${error.message}`, intent: "unknown" },
        wasExtended: true,
      };
    }
  }

  // --- RESPONDER A SUGERENCIA PREDICTIVA (crear workflow por número) ---
  const predMatch = rawText.match(/^(\d+)\s*$/);
  if (predMatch) {
    const num = parseInt(predMatch[1], 10);
    if (num >= 1 && num <= 9) {
      // Buscar sugerencias guardadas en DB
      const suggestions = await getPredictiveSuggestions();
      if (suggestions && suggestions.suggestions[num - 1]) {
        const selected = suggestions.suggestions[num - 1];
        try {
          await clearPredictiveSuggestions();
          const created = await createWorkflowFromSuggestion(selected);
          if (created) {
            return {
              response: {
                text: `✅ **Workflow creado desde tu sugerencia:**\n\n📌 **${selected.workflowName}**\n${selected.description}\n\nPodés verlo en **Automatizaciones** o ejecutarlo diciendo *"ejecutar workflow \"${selected.workflowName}\""*.`,
                intent: "unknown",
                suggestions: ["Ver automatizaciones", "Ejecutar workflow", "¿Cómo vamos?"],
                route: "/automatizaciones",
              } as AgentResponse & { route?: string },
              wasExtended: true,
            };
          }
        } catch {}
      }
    }
  }

  // --- UNDO: deshacer última operación destructiva ---
  if (/^(undo|deshacer|revertir|revierte|deshaz)\b/i.test(norm)) {
    const undoData = await findUndoSnapshot();
    if (undoData) {
      const success = await executeUndo(undoData);
      if (success) {
        return {
          response: {
            text: `↩️ **Operación revertida.**\n\nSe restauró **${undoData.action.replace(/_/g, " ")}** correctamente.`,
            intent: "unknown",
            suggestions: ["¿Cómo vamos?", "¿Qué alertas hay?"],
          },
          wasExtended: true,
        };
      } else {
        return {
          response: {
            text: `❌ No se pudo deshacer la operación. El registro original puede haber sido modificado.`,
            intent: "unknown",
          },
          wasExtended: true,
        };
      }
    } else {
      return {
        response: {
          text: `No hay operación para deshacer. Las operaciones de eliminación tienen undo disponible por 5 minutos.`,
          intent: "unknown",
          suggestions: ["¿Cómo vamos?"],
        },
        wasExtended: true,
      };
    }
  }

  // --- CREAR WORKFLOW DESDE TEXTO ---
  // Verificar tanto la versión original como la normalizada por NLU
  // (agent-nlu.ts transforma "cuando X, Y" → "crear workflow que cuando X, Y")
  const normText = originalMessage ? normalize(text) : norm;
  const hasWorkflowKeywords = /(automatiz[áa]|automatiza|cre[áa]r?\s+(un\s+)?workflow|cre[áa]r?\s+(una\s+)?automatizacion|cre[áa]r?\s+(un\s+)?workflow\s+que)/i.test(norm)
    || (normText !== norm && /(cre[áa]r?\s+(un\s+)?workflow|cre[áa]r?\s+(una\s+)?automatizacion)/i.test(normText));
  if (hasWorkflowKeywords) {
    try {
      const wfResult = await createWorkflowFromText(rawText);
      if (wfResult.success) {
        const responseText = generateWorkflowCreatedResponse(wfResult);
        return {
          response: {
            text: responseText,
            intent: "unknown",
            data: { workflow: wfResult },
            suggestions: ["Ver automatizaciones", "Ejecutar workflow", "¿Cómo vamos?"],
          },
          wasExtended: true,
        };
      } else {
        return {
          response: {
            text: wfResult.error || `No entendí la estructura. Ejemplos:\n\n*cuando el stock de cemento baje de 50, creame una tarea: reponer*\n*todos los lunes a las 9, mandame una alerta: revisión semanal*\n*cuando una obra supere el 85% del presupuesto, registrá un gasto en materiales*`,
            intent: "unknown",
            suggestions: ["cuando el stock de cemento baje de 50, creame una tarea", "Ver automatizaciones", "Ayuda"],
          },
          wasExtended: true,
        };
      }
    } catch (error: any) {
      return {
        response: {
          text: `Error al crear workflow: ${error.message}`,
          intent: "unknown",
          suggestions: ["Ver automatizaciones", "Ayuda"],
        },
        wasExtended: true,
      };
    }
  }

  return { response: null, wasExtended: false };
}

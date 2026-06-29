// ============================================================
// TOOL REGISTRY — Contrato único de herramientas
// ============================================================
// Sistema centralizado para registrar y ejecutar acciones
// del agente. Toda tool tiene:
//  - name: identificador único
//  - intent: intent del agente que mapea
//  - description: para documentación / MCP
//  - riskLevel: safe | moderate | destructive (define si pide confirmación)
//  - inputSchema: Zod schema para validar args
//  - execute: función que ejecuta y devuelve AgentResponse
// ============================================================

import { z } from "zod";
import type { Intent, AgentResponse } from "./agent";

export type RiskLevel = "safe" | "moderate" | "destructive";

export type ToolName =
  // CRUD obras
  | "create_project"
  | "update_project_progress"
  | "update_project_status"
  | "edit_project"
  | "close_project"
  // CRUD tareas
  | "create_task"
  | "complete_task"
  | "edit_task"
  | "delete_task"
  // CRUD transacciones
  | "create_expense"
  | "create_income"
  | "delete_transaction"
  // CRUD materiales
  | "add_materials"
  | "add_stock_movement"
  | "update_stock"
  | "edit_material"
  | "delete_material"
  | "reorder"
  // CRUD proveedores
  | "create_supplier"
  // Workflows / automatización
  | "trigger_workflow"
  | "list_workflows"
  | "list_project_tasks"
  | "list_automations"
  // Utilidades
  | "export_data"
  // Capabilities del agente (FASE 4-5)
  | "remember_preference"
  | "recall_preference"
  | "forget_preference"
  | "list_preferences"
  | "schedule_event"
  | "list_events"
  | "complete_event"
  | "cancel_event"
  | "send_notification"
  | "list_notifications"
  | "resolve_notification"
  | "dismiss_all_notifications"
  | "search_projects"
  | "search_clients"
  | "search_budgets"
  | "list_budget_ranges"
  | "generate_document";

export interface ToolCall<TArgs = Record<string, any>> {
  tool: ToolName;
  args: TArgs;
  rawText?: string;
}

export interface ToolContext {
  rawText?: string;
  conversationContext?: Record<string, any>;
}

export interface ToolDefinition<TArgs extends z.ZodTypeAny = z.ZodTypeAny> {
  name: ToolName;
  intent: Intent;
  description: string;
  riskLevel: RiskLevel;
  inputSchema: TArgs;
  execute: (args: z.infer<TArgs>, ctx: ToolContext) => Promise<AgentResponse>;
}

// ─── Schemas Zod reutilizables ───

const projectRefSchema = z
  .union([z.string(), z.number()])
  .optional()
  .describe("Código o número de obra (ej: '001', 'OB-001', 1)");

const amountSchema = z.number().nonnegative().describe("Monto en ARS");

const categorySchema = z
  .string()
  .describe("Categoría: materiales, mano_de_obra, servicios, venta, anticipo, otros");

const nonEmptyString = z.string().min(1);

// ─── SCHEMAS POR TOOL ───

const createProjectSchema = z.object({
  name: nonEmptyString,
  budget: z.number().nonnegative().optional(),
  clientName: z.string().optional(),
  address: z.string().optional(),
  type: z.enum(["obra", "remodelacion", "proyecto"]).optional(),
});

const updateProjectProgressSchema = z.object({
  projectRef: projectRefSchema,
  progress: z
    .number()
    .min(0)
    .max(100)
    .describe("Porcentaje de avance 0-100"),
});

const updateProjectStatusSchema = z.object({
  projectRef: projectRefSchema,
  status: z.enum(["planning", "in_progress", "paused", "completed", "cancelled"]),
});

const editProjectSchema = z.object({
  projectRef: projectRefSchema,
  name: z.string().optional(),
  budget: z.number().nonnegative().optional(),
  clientName: z.string().optional(),
  address: z.string().optional(),
});

const closeProjectSchema = z.object({
  projectRef: projectRefSchema,
});

const createTaskSchema = z.object({
  title: nonEmptyString,
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  dueDate: z.string().optional().describe("ISO 8601 o natural language"),
  assignee: z.string().optional(),
  projectRef: projectRefSchema,
});

const completeTaskSchema = z.object({
  taskTitle: nonEmptyString,
});

const editTaskSchema = z.object({
  taskTitle: nonEmptyString,
  title: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  assignee: z.string().optional(),
});

const deleteTaskSchema = z.object({
  taskTitle: nonEmptyString,
});

const createExpenseSchema = z.object({
  amount: amountSchema,
  category: categorySchema,
  description: z.string().optional(),
  projectRef: projectRefSchema,
  date: z.string().optional(),
  method: z.enum(["efectivo", "transferencia", "cheque", "tarjeta"]).optional(),
  recurring: z.enum(["mensual", "semanal"]).optional(),
});

const createIncomeSchema = z.object({
  amount: amountSchema,
  category: categorySchema.optional(),
  description: z.string().optional(),
  projectRef: projectRefSchema.optional(),
  date: z.string().optional(),
});

const deleteTransactionSchema = z.object({
  amount: amountSchema,
  description: z.string().optional(),
});

const addMaterialsSchema = z.object({
  items: z
    .array(
      z.object({
        name: nonEmptyString,
        sku: z.string().optional(),
        unit: z.string().optional(),
        unitCost: z.number().nonnegative().optional(),
        unitPrice: z.number().nonnegative().optional(),
        stock: z.number().nonnegative().optional(),
        minStock: z.number().nonnegative().optional(),
        category: z.string().optional(),
        supplierRef: z.string().optional(),
      })
    )
    .min(1),
  projectRef: projectRefSchema.optional(),
});

const addStockMovementSchema = z.object({
  materialName: nonEmptyString,
  quantity: z.number().positive(),
  type: z.enum(["incoming", "outgoing", "adjustment"]),
  unitCost: z.number().nonnegative().optional(),
  reason: z.string().optional(),
  supplierRef: z.string().optional(),
  projectRef: projectRefSchema.optional(),
});

const updateStockSchema = z.object({
  materialName: nonEmptyString,
  stock: z.number().nonnegative(),
});

const editMaterialSchema = z.object({
  materialName: nonEmptyString,
  unitCost: z.number().nonnegative().optional(),
  unitPrice: z.number().nonnegative().optional(),
  stock: z.number().nonnegative().optional(),
  minStock: z.number().nonnegative().optional(),
});

const deleteMaterialSchema = z.object({
  materialName: nonEmptyString,
});

const reorderSchema = z.object({
  category: z.string().optional(),
  projectRef: projectRefSchema.optional(),
});

const createSupplierSchema = z.object({
  name: nonEmptyString,
  phone: z.string().optional(),
  email: z.string().email().optional(),
  taxId: z.string().optional(),
  category: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
});

const triggerWorkflowSchema = z.object({
  workflowName: nonEmptyString.optional(),
  workflowId: nonEmptyString.optional(),
  variables: z.record(z.string(), z.any()).optional(),
});

const listWorkflowsSchema = z.object({
  enabledOnly: z.boolean().optional(),
});

const listProjectTasksSchema = z.object({
  projectRef: projectRefSchema,
  includeCompleted: z.boolean().optional(),
});

const listAutomationsSchema = z.object({});

const exportDataSchema = z.object({
  domain: z
    .enum(["finances", "inventory", "projects", "tasks", "suppliers", "summary"])
    .optional()
    .describe("Tipo de datos a exportar. Si se omite, devuelve resumen general."),
});

// ─── SCHEMAS: Capabilities (FASE 4-5) ────────────────────────

const rememberPreferenceSchema = z.object({
  key: z.string().min(1).max(60),
  value: z.any(),
  category: z.enum(["communication", "finance", "project", "ui", "general"]).default("general"),
});

const recallPreferenceSchema = z.object({
  key: z.string().min(1),
});

const forgetPreferenceSchema = z.object({
  key: z.string().min(1),
});

const listPreferencesSchema = z.object({});

const scheduleEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  date: z.string(),
  duration: z.number().int().min(15).max(480).optional(),
  projectRef: projectRefSchema,
  taskId: z.string().optional(),
  reminders: z.array(z.number()).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

const listEventsSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  projectRef: projectRefSchema,
  status: z.enum(["active", "completed", "cancelled"]).default("active"),
  limit: z.number().int().min(1).max(100).default(20),
});

const completeEventSchema = z.object({
  eventId: z.string(),
});

const cancelEventSchema = z.object({
  eventId: z.string(),
});

const sendNotificationSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
  type: z.enum(["alert", "task", "reminder", "info"]).default("alert"),
  projectRef: projectRefSchema,
  link: z.string().url().optional(),
});

const listNotificationsSchema = z.object({
  unreadOnly: z.boolean().default(false),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

const resolveNotificationSchema = z.object({
  notificationId: z.string(),
});

const dismissAllNotificationsSchema = z.object({});

const searchProjectsSchema = z.object({
  query: z.string().optional(),
  status: z.enum(["planning", "in_progress", "paused", "completed", "cancelled"]).optional(),
  minBudget: z.number().optional(),
  maxBudget: z.number().optional(),
  clientName: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

const searchClientsSchema = z.object({
  query: z.string().optional(),
  projectStatus: z.enum(["planning", "in_progress", "paused", "completed", "cancelled"]).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

const searchBudgetsSchema = z.object({
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  projectStatus: z.enum(["planning", "in_progress", "paused", "completed", "cancelled"]).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

const listBudgetRangesSchema = z.object({});

const generateDocumentSchema = z.object({
  type: z.enum(["project_report", "budget_summary", "financial_report", "task_summary", "inventory_report", "client_summary", "purchase_plan", "custom"]),
  projectRef: projectRefSchema,
  format: z.enum(["markdown", "text"]).default("markdown"),
  title: z.string().optional(),
  description: z.string().optional(),
});

// ─── MAPA DE SCHEMAS POR TOOL ───

export const toolSchemas: Record<ToolName, z.ZodTypeAny> = {
  create_project: createProjectSchema,
  update_project_progress: updateProjectProgressSchema,
  update_project_status: updateProjectStatusSchema,
  edit_project: editProjectSchema,
  close_project: closeProjectSchema,
  create_task: createTaskSchema,
  complete_task: completeTaskSchema,
  edit_task: editTaskSchema,
  delete_task: deleteTaskSchema,
  create_expense: createExpenseSchema,
  create_income: createIncomeSchema,
  delete_transaction: deleteTransactionSchema,
  add_materials: addMaterialsSchema,
  add_stock_movement: addStockMovementSchema,
  update_stock: updateStockSchema,
  edit_material: editMaterialSchema,
  delete_material: deleteMaterialSchema,
  reorder: reorderSchema,
  create_supplier: createSupplierSchema,
  trigger_workflow: triggerWorkflowSchema,
  list_workflows: listWorkflowsSchema,
  list_project_tasks: listProjectTasksSchema,
  list_automations: listAutomationsSchema,
  export_data: exportDataSchema,
  // Capabilities
  remember_preference: rememberPreferenceSchema,
  recall_preference: recallPreferenceSchema,
  forget_preference: forgetPreferenceSchema,
  list_preferences: listPreferencesSchema,
  schedule_event: scheduleEventSchema,
  list_events: listEventsSchema,
  complete_event: completeEventSchema,
  cancel_event: cancelEventSchema,
  send_notification: sendNotificationSchema,
  list_notifications: listNotificationsSchema,
  resolve_notification: resolveNotificationSchema,
  dismiss_all_notifications: dismissAllNotificationsSchema,
  search_projects: searchProjectsSchema,
  search_clients: searchClientsSchema,
  search_budgets: searchBudgetsSchema,
  list_budget_ranges: listBudgetRangesSchema,
  generate_document: generateDocumentSchema,
};

// ─── Mapeo entre ToolName e Intent del agente ───

export const toolToIntent: Record<ToolName, Intent> = {
  create_project: "action_create_project_direct",
  update_project_progress: "action_update_project_progress",
  update_project_status: "action_update_project_status",
  edit_project: "action_edit_project",
  close_project: "action_close_project",
  create_task: "action_create_task",
  complete_task: "action_complete_task",
  edit_task: "action_edit_task",
  delete_task: "action_delete_task",
  create_expense: "action_create_expense",
  create_income: "action_create_income",
  delete_transaction: "action_delete_transaction",
  add_materials: "action_add_materials",
  add_stock_movement: "action_add_stock_movement",
  update_stock: "action_update_stock",
  edit_material: "action_edit_material",
  delete_material: "action_delete_material",
  reorder: "action_reorder",
  create_supplier: "action_create_supplier",
  trigger_workflow: "action_trigger_workflow",
  list_workflows: "action_list_workflows",
  list_project_tasks: "action_list_project_tasks",
  list_automations: "config_list_automations",
  export_data: "action_export_data",
  // ─── Capabilities (FASE 4-5) ────────────────────────────────
  remember_preference: "capability_remember_preference",
  recall_preference: "capability_recall_preference",
  forget_preference: "capability_forget_preference",
  list_preferences: "capability_list_preferences",
  schedule_event: "capability_schedule_event",
  list_events: "capability_list_events",
  complete_event: "capability_complete_event",
  cancel_event: "capability_cancel_event",
  send_notification: "capability_send_notification",
  list_notifications: "capability_list_notifications",
  resolve_notification: "capability_resolve_notification",
  dismiss_all_notifications: "capability_dismiss_all_notifications",
  search_projects: "capability_search_projects",
  search_clients: "capability_search_clients",
  search_budgets: "capability_search_budgets",
  list_budget_ranges: "capability_list_budget_ranges",
  generate_document: "capability_generate_document",
};

// Mapeo inverso: Intent -> ToolName (para que el router elija tool según intent)
export const intentToTool: Partial<Record<Intent, ToolName>> = (() => {
  const out: Partial<Record<Intent, ToolName>> = {};
  for (const [tool, intent] of Object.entries(toolToIntent)) {
    out[intent] = tool as ToolName;
  }
  return out;
})();

// ─── Reglas de riesgo (mismatch con CONFIRMATION_INTENTS de agent-memory) ───

const destructiveTools: ToolName[] = [
  "delete_task",
  "delete_material",
  "delete_transaction",
  "close_project",
];

const moderateTools: ToolName[] = [
  "create_project",
  "update_project_progress",
  "update_project_status",
  "edit_project",
  "create_task",
  "complete_task",
  "edit_task",
  "create_expense",
  "create_income",
  "add_materials",
  "add_stock_movement",
  "update_stock",
  "edit_material",
  "reorder",
  "create_supplier",
  "trigger_workflow",
  // Capabilities moderadas
  "remember_preference",
  "forget_preference",
  "schedule_event",
  "complete_event",
  "cancel_event",
  "send_notification",
  "resolve_notification",
  "dismiss_all_notifications",
  "generate_document",
];

export function getRiskLevel(tool: ToolName): RiskLevel {
  if (destructiveTools.includes(tool)) return "destructive";
  if (moderateTools.includes(tool)) return "moderate";
  return "safe";
}

// ─── Validación de argumentos ───

export interface ToolValidationError {
  ok: false;
  errors: string[];
}

export interface ToolValidationSuccess<T> {
  ok: true;
  args: T;
}

export type ToolValidationResult<T = any> =
  | ToolValidationSuccess<T>
  | ToolValidationError;

export function validateToolArgs<T extends ToolName>(
  tool: T,
  args: unknown
): ToolValidationResult<z.infer<(typeof toolSchemas)[T]>> {
  const schema = toolSchemas[tool];
  const result = schema.safeParse(args || {});
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`
      ),
    };
  }
  return { ok: true, args: result.data };
}

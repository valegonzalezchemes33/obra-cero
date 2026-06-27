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
  | "export_data";

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

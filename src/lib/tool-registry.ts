import type { Intent } from "./agent";
import type { AgentResponse } from "./agent";

export type ToolName =
  | "export_data"
  | "update_project_progress"
  | "update_project_status"
  | "create_task"
  | "complete_task"
  | "create_project"
  | "create_expense"
  | "create_income"
  | "add_materials"
  | "add_stock_movement"
  | "create_supplier"
  | "list_workflows"
  | "trigger_workflow"
  | "list_project_tasks"
  | "edit_project"
  | "edit_task"
  | "edit_material"
  | "delete_task"
  | "delete_material"
  | "delete_transaction";

export interface ToolCall<TArgs = any> {
  tool: ToolName;
  args: TArgs;
}

export interface ToolExecutionResult {
  response: AgentResponse;
}

// Mapeo mínimo entre intents existentes y herramientas.
// Esto permite evolucionar el “router” sin tocar el agente por completo.
export const intentToTool: Partial<Record<Intent, ToolName>> = {
  action_export_data: "export_data" as ToolName,

  action_update_project_progress: "update_project_progress",
  action_update_project_status: "update_project_status",

  action_create_task: "create_task",
  action_complete_task: "complete_task",

  action_create_project_direct: "create_project",
  action_create_expense: "create_expense",
  action_create_income: "create_income",
  action_add_materials: "add_materials",
  action_add_stock_movement: "add_stock_movement",
  action_create_supplier: "create_supplier",

  action_list_workflows: "list_workflows",
  action_trigger_workflow: "trigger_workflow",

  action_list_project_tasks: "list_project_tasks",

  action_edit_project: "edit_project",
  action_edit_task: "edit_task",
  action_edit_material: "edit_material",

  action_delete_task: "delete_task",
  action_delete_material: "delete_material",
  action_delete_transaction: "delete_transaction",
};


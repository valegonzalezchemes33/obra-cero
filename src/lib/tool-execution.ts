import { type ToolCall, type ToolExecutionResult } from "./tool-registry";
import { type Intent, type ParsedCommand, type AgentResponse } from "./agent";
import { dispatchByIntent } from "./agent";

// Implementación inicial: “bridge” entre tool-call y el motor existente.
// No cambia la lógica de negocio todavía; cambia el enrutamiento.
export async function executeToolCall(call: ToolCall): Promise<ToolExecutionResult> {
  // Según la tool, reconstruimos un Intent/ParsedCommand para reutilizar dispatchByIntent.
  // Esto nos permite avanzar hacia “tool router” sin reescribir todos los handlers.

  // Heurística: tool->intent
  const toolToIntent: Record<string, Intent> = {
    export_data: "action_export_data" as Intent,
    update_project_progress: "action_update_project_progress" as Intent,
    update_project_status: "action_update_project_status" as Intent,
    create_task: "action_create_task" as Intent,
    complete_task: "action_complete_task" as Intent,
    create_project: "action_create_project_direct" as Intent,
    create_expense: "action_create_expense" as Intent,
    create_income: "action_create_income" as Intent,
    add_materials: "action_add_materials" as Intent,
    add_stock_movement: "action_add_stock_movement" as Intent,
    create_supplier: "action_create_supplier" as Intent,
    list_workflows: "action_list_workflows" as Intent,
    trigger_workflow: "action_trigger_workflow" as Intent,
    list_project_tasks: "action_list_project_tasks" as Intent,
    edit_project: "action_edit_project" as Intent,
    edit_task: "action_edit_task" as Intent,
    edit_material: "action_edit_material" as Intent,
    delete_task: "action_delete_task" as Intent,
    delete_material: "action_delete_material" as Intent,
    delete_transaction: "action_delete_transaction" as Intent,
  };

  const intent = toolToIntent[call.tool];
  const rawText = typeof call.args === "string" ? call.args : call.args?.rawText || call.args?.originalText || "";

  const parsed: ParsedCommand = {
    intent,
    rawText,
    normalized: rawText,
    confidence: 0.95,
    entities: call.args || {},
  };

  const response: AgentResponse = await dispatchByIntent(parsed, rawText);
  return { response };
}


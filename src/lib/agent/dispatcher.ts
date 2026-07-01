import * as h from "@/lib/agent/handlers";
import type { ParsedCommand, AgentResponse, AgentResponseWithEntities, Intent, AgentActionItem } from "@/lib/agent";

// ---------- Dispatch by intent (exportable, sin guardar mensajes) ----------

export async function dispatchByIntent(parsed: ParsedCommand, rawText?: string): Promise<AgentResponse> {
  const text = rawText || parsed.rawText;

  let response: AgentResponse;
  switch (parsed.intent) {
    case "greeting":
      response = await h.respondGreeting();
      break;
    case "query_profit":
      response = await h.respondQueryProfit();
      break;
    case "query_expenses":
      response = await h.respondQueryExpenses();
      break;
    case "query_income":
      response = await h.respondQueryIncome();
      break;
    case "query_low_stock":
      response = await h.respondQueryLowStock();
      break;
    case "query_stock":
      response = await h.respondQueryStock();
      break;
    case "query_stock_value":
      response = await h.respondQueryStockValue();
      break;
    case "query_dead_stock":
      response = await h.respondQueryDeadStock();
      break;
    case "query_material_history":
      response = await h.respondQueryMaterialHistory(parsed);
      break;
    case "query_project_status":
      response = await h.respondQueryProjectStatus();
      break;
    case "query_project_detail":
      response = await h.respondQueryProjectDetail(parsed);
      break;
    case "query_project_profitability":
    case "query_margin_by_project":
      response = await h.respondQueryMarginByProject();
      break;
    case "predict_budget":
      response = await h.respondPredictBudget();
      break;
    case "predict_project_eta":
      response = await h.respondPredictProjectEta(parsed);
      break;
    case "query_top_expense":
      response = await h.respondQueryTopExpense();
      break;
    case "query_supplier":
      response = await h.respondQuerySupplier();
      break;
    case "query_top_supplier":
      response = await h.respondQueryTopSupplier();
      break;
    case "query_best_supplier":
      response = await h.respondQueryBestSupplier();
      break;
    case "query_cashflow":
      response = await h.respondQueryCashflow();
      break;
    case "query_kpis":
      response = await h.respondQueryKpis();
      break;
    case "query_compare_period":
      response = await h.respondQueryComparePeriod();
      break;
    case "query_anomalies":
      response = await h.respondQueryAnomalies();
      break;
    case "query_tasks":
      response = await h.respondQueryTasks();
      break;
    case "query_overdue_tasks":
      response = await h.respondQueryOverdueTasks();
      break;
    case "alert_check":
      response = await h.respondAlertCheck();
      break;
    case "recommend":
      response = await h.respondRecommend();
      break;
    case "summarize":
      response = await h.respondSummarize();
      break;
    case "action_create_expense":
      response = await h.respondActionCreateExpense(parsed);
      break;
    case "action_create_income":
      response = await h.respondActionCreateIncome(parsed);
      break;
    case "action_create_project":
      response = await h.respondActionCreateProject();
      break;
    case "action_create_task":
      response = await h.respondActionCreateTask(parsed);
      break;
    case "action_reorder":
      response = await h.respondActionReorder();
      break;
    case "action_update_stock":
      response = await h.respondActionUpdateStock();
      break;
    case "action_close_project":
      response = await h.respondActionCloseProject(parsed);
      break;
    case "action_add_materials":
      response = await h.respondActionAddMaterials(parsed, text);
      break;
    case "action_add_stock_movement":
      response = await h.respondActionAddStockMovement(parsed, text);
      break;
    case "action_update_project_progress":
      response = await h.respondActionUpdateProjectProgress(parsed, text);
      break;
    case "action_update_project_status":
      response = await h.respondActionUpdateProjectStatus(parsed, text);
      break;
    case "action_create_project_direct":
      response = await h.respondActionCreateProjectDirect(parsed, text);
      break;
    case "action_create_supplier":
      response = await h.respondActionCreateSupplier(parsed, text);
      break;
    case "action_list_project_tasks":
      response = await h.respondActionListProjectTasks(parsed, text);
      break;
    case "action_complete_task":
      response = await h.respondActionCompleteTask(parsed, text);
      break;
    case "config_list_automations":
      response = await h.respondConfigListAutomations();
      break;
    case "help":
      response = await h.respondHelp();
      break;
    // ─── Handlers extendidos (editar, eliminar, workflows, exportar) ───
    case "action_edit_project": {
      const { handleEditProject } = await import("../agent-extended");
      response = await handleEditProject(parsed, text);
      break;
    }
    case "action_edit_task": {
      const { handleEditTask } = await import("../agent-extended");
      response = await handleEditTask(parsed, text);
      break;
    }
    case "action_edit_material": {
      const { handleEditMaterial } = await import("../agent-extended");
      response = await handleEditMaterial(parsed, text);
      break;
    }
    case "action_delete_task": {
      const { handleDeleteTask } = await import("../agent-extended");
      response = await handleDeleteTask(parsed, text);
      break;
    }
    case "action_delete_material": {
      const { handleDeleteMaterial } = await import("../agent-extended");
      response = await handleDeleteMaterial(parsed, text);
      break;
    }
    case "action_delete_transaction": {
      const { handleDeleteTransaction } = await import("../agent-extended");
      response = await handleDeleteTransaction(parsed, text);
      break;
    }
    case "action_trigger_workflow": {
      const { handleTriggerWorkflow } = await import("../agent-extended");
      response = await handleTriggerWorkflow(parsed, text);
      break;
    }
    case "action_list_workflows": {
      const { handleListWorkflows } = await import("../agent-extended");
      response = await handleListWorkflows();
      break;
    }
    case "action_export_data": {
      const { handleExportData } = await import("../agent-extended");
      response = await handleExportData(parsed, text);
      break;
    }
    // ─── Nuevos handlers ───
    case "action_edit_supplier": {
      const { handleEditSupplier } = await import("../agent-extended");
      response = await handleEditSupplier(parsed, text);
      break;
    }
    case "action_delete_supplier": {
      const { handleDeleteSupplier } = await import("../agent-extended");
      response = await handleDeleteSupplier(parsed, text);
      break;
    }
    case "action_get_project": {
      const { handleGetProject } = await import("../agent-extended");
      response = await handleGetProject(parsed, text);
      break;
    }
    case "action_get_material": {
      const { handleGetMaterial } = await import("../agent-extended");
      response = await handleGetMaterial(parsed, text);
      break;
    }
    case "action_get_supplier": {
      const { handleGetSupplier } = await import("../agent-extended");
      response = await handleGetSupplier(parsed, text);
      break;
    }
    case "action_get_task": {
      const { handleGetTask } = await import("../agent-extended");
      response = await handleGetTask(parsed, text);
      break;
    }
    case "action_bulk_complete_tasks": {
      const { handleBulkCompleteTasks } = await import("../agent-extended");
      response = await handleBulkCompleteTasks(parsed, text);
      break;
    }
    case "action_bulk_delete_tasks": {
      const { handleBulkDeleteTasks } = await import("../agent-extended");
      response = await handleBulkDeleteTasks(parsed, text);
      break;
    }
    case "action_create_schedule": {
      const { handleCreateSchedule } = await import("../agent-extended");
      response = await handleCreateSchedule(parsed, text);
      break;
    }
    case "action_list_schedules": {
      const { db } = await import("@/lib/db");
      const schedules = await db.agentSchedule.findMany({
        orderBy: { nextRun: "asc" },
        take: 50,
      });
      if (schedules.length === 0) {
        response = {
          text: "No hay schedules configurados. Creá uno desde Agendamiento o diciendo *crear schedule*.",
          intent: "action_list_schedules",
          suggestions: ["Crear schedule", "Ver automatizaciones"],
        };
      } else {
        const lines = schedules.map(s =>
          `• **${s.name}** — ${s.type} — cron: \`${s.cron}\`${s.enabled ? " (activo)" : " (inactivo)"}${s.lastRun ? ` — último: ${new Date(s.lastRun).toLocaleString("es-AR")}` : ""}`
        );
        response = {
          text: `**Schedules (${schedules.length}):**\n\n${lines.join("\n")}`,
          intent: "action_list_schedules",
          data: { schedules },
          suggestions: ["Crear schedule", "Ejecutar scheduler ahora", "Ver automatizaciones"],
        };
      }
      break;
    }
    // ─── Obsidian Vault ───
    case "obsidian_read_note": {
      const { readNote } = await import("../agent/capabilities/obsidian");
      response = await readNote(parsed.entities as any);
      break;
    }
    case "obsidian_write_note": {
      const { writeNote } = await import("../agent/capabilities/obsidian");
      response = await writeNote(parsed.entities as any);
      break;
    }
    case "obsidian_search_notes": {
      const { searchNotes } = await import("../agent/capabilities/obsidian");
      response = await searchNotes(parsed.entities as any);
      break;
    }
    case "obsidian_list_vault": {
      const { listVault } = await import("../agent/capabilities/obsidian");
      response = await listVault(parsed.entities as any);
      break;
    }
    case "obsidian_append_note": {
      const { appendToNote } = await import("../agent/capabilities/obsidian");
      response = await appendToNote(parsed.entities as any);
      break;
    }
    case "obsidian_list_tags": {
      const { listTags } = await import("../agent/capabilities/obsidian");
      response = await listTags();
      break;
    }
    case "obsidian_execute_command": {
      const { executeObsidianCommand } = await import("../agent/capabilities/obsidian");
      response = await executeObsidianCommand(parsed.entities as any);
      break;
    }
    default:
      response = {
        text: `No estoy seguro de qué necesitás. Escribí *ayuda* para ver todo lo que puedo hacer, o probá con: "¿cómo vamos?", "¿qué alertas hay?" o "recomendaciones".`,
        intent: "unknown",
        suggestions: ["Ayuda", "¿Cómo vamos?", "Recomendaciones"],
      };
  }

  return response;
}

// ---------- Dispatcher principal ----------

export async function tryGroqDispatch(rawText: string): Promise<AgentResponseWithEntities | null> {
  try {
    const { tryGroqCompoundIntent } = await import("../groq-integration");
    const compoundResult = await tryGroqCompoundIntent(rawText, []);
    if (!compoundResult.success || !compoundResult.intents || compoundResult.intents.length === 0) {
      return null;
    }

    const { processCompoundMessage, processMessageWithIntent, enrichQueryWithGroq } = await import("../agent-dispatcher");
    if (compoundResult.intents.length > 1) {
      const response = await processCompoundMessage(
        compoundResult.intents.map((intent) => ({ intent: intent.intent as Intent, entities: intent.entities || {} })),
        rawText
      );
      const combinedEntities = compoundResult.intents.reduce((acc, intent) => ({ ...acc, ...(intent.entities || {}) }), {});
      return { response, entities: combinedEntities };
    }

    const singleIntent = compoundResult.intents[0];
    if (singleIntent.intent.startsWith("action_")) {
      const response = await processMessageWithIntent(
        singleIntent.intent as Intent,
        singleIntent.entities || {},
        rawText,
        singleIntent.confidence || 0.85
      );
      return { response, entities: singleIntent.entities || {} };
    }

    const response = await enrichQueryWithGroq(
      singleIntent.intent as Intent,
      singleIntent.entities || {},
      rawText,
      singleIntent.confidence || 0.85,
      []
    );
    return { response, entities: singleIntent.entities || {} };
  } catch {
    return null;
  }
}

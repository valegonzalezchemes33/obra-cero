// ============================================================
// PARSER DE LENGUAJE NATURAL A WORKFLOWS
// Convierte frases del usuario en estructuras de workflow
// ============================================================
// Ejemplos:
//   "cuando el stock de cemento baje de 50, creame una tarea: reponer"
//   "todos los lunes a las 9, mandame una alerta: revisión semanal"
//   "cuando una obra supere el 85% del presupuesto, registrá un gasto"
//   "si hay tareas atrasadas, mandame una alerta: hay tareas vencidas"
// ============================================================

import { db } from "@/lib/db";
import { normalize } from "./agent";
import type {
  WorkflowStepConfig,
  ConditionConfig,
  ActionCreateTaskConfig,
  ActionSendAlertConfig,
  ActionCreateTransactionConfig,
  ActionUpdateProjectProgressConfig,
  ActionUpdateProjectStatusConfig,
  DelayConfig,
  TriggerConfig,
  WorkflowTrigger,
} from "./workflow-types";

// ─── Resultado del parsing ───

export interface WorkflowFromTextResult {
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  triggerConfig?: Partial<TriggerConfig>;
  steps: WorkflowStepConfig[];
  rawCondition: string;
  rawActions: string[];
  success: boolean;
  error?: string;
}

// ─── Split condición / acciones ───

function splitConditionAndActions(text: string): { condition: string; actions: string[] } | null {
  const norm = normalize(text);

  // Patrones de separación
  const separators = [
    /^(?:cuando|si|cada|todos?)\s+(.+?)\s+(?:entonces\s+)?(?:que\s+)?(?:me\s+)?(?:hacé|haga|hace|crea|creé|creame|manda|mande|mandame|registrá|registre|actualizá|actualice|enviá|envie|pone|ponga|ejecutá|ejecute)\b\s*(.*)$/i,
    /^(?:automatizá|automatiza|creá|crea)\s*(?::\s*)?(?:un\s+)?(?:workflow\s+)?(?:que\s+)?(?:cuando|si|cada)\s+(.+?)\s+(?:entonces\s+)?(?:que\s+)?(?:me\s+)?(?:hacé|haga|hace|crea|creé|creame|manda|mande|mandame|registrá|registre|actualizá|actualice|enviá|envie|pone|ponga|ejecutá|ejecute)\b\s*(.*)$/i,
    /^(?:creá|crea)\s+(?:un\s+)?workflow\s+(?:que\s+)?(?:cuando|si|cada)\s+(.+?)\s+(?:entonces\s+)?(?:hacé|haga|hace)\s+(.+)$/i,
  ];

  for (const pattern of separators) {
    const match = text.match(pattern);
    if (match) {
      const condition = match[1].trim();
      const actionPart = match[2].trim();
      // Dividir acciones múltiples por "y" o ", y"
      const actions = actionPart
        .split(/(?:,\s*)?y\s+(?:que\s+)?(?:me\s+)?(?=crea|manda|registrá|actualizá|enviá|pone|ejecutá)/i)
        .flatMap(a => a.split(/\s*y\s+(?:también|además)\s+/i))
        .map(a => a.trim())
        .filter(a => a.length > 0);
      return { condition, actions: actions.length > 0 ? actions : [actionPart] };
    }
  }

  return null;
}

// ─── Parsear condición ───

interface ParsedCondition {
  type: WorkflowTrigger;
  triggerConfig?: Partial<TriggerConfig>;
  steps: WorkflowStepConfig[];
  label: string;
}

function parseCondition(text: string): ParsedCondition {
  const norm = normalize(text);

  // --- Schedule: "todos los lunes a las 9" / "cada 5 minutos" / "todos los días a las 19" ---
  const scheduleMatch = norm.match(
    /(?:todos?|cada)\s+(?:los\s+)?(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|día|dias|días|mes|año)\s*(?:\s+a\s+las?\s+(\d{1,2}))?/i
  );
  if (scheduleMatch) {
    const dayMap: Record<string, number> = {
      lunes: 1, martes: 2, miércoles: 3, miercoles: 3,
      jueves: 4, viernes: 5, sábado: 6, sabado: 6, domingo: 0,
      día: -1, dias: -1, días: -1, mes: -1, año: -1,
    };
    const day = dayMap[scheduleMatch[1].toLowerCase()] ?? -1;
    const hour = scheduleMatch[2] ? parseInt(scheduleMatch[2]) : 9;
    const isDaily = scheduleMatch[1].toLowerCase() === "día" || scheduleMatch[1].toLowerCase() === "dias" || scheduleMatch[1].toLowerCase() === "días";
    const cron = isDaily
      ? `${hour} 0 * * *`
      : day >= 0 && day <= 6
      ? `${hour} 0 * * ${day}`
      : `0 ${hour} * * *`;

    return {
      type: "schedule",
      triggerConfig: { cron },
      steps: [], // Las acciones se agregan después
      label: `Programado: ${text}`,
    };
  }

  // --- Schedule simple: "cada X (minutos|horas|días)" ---
  const intervalMatch = norm.match(/cada\s+(\d+)\s+(min(?:uto)?s?|hora?s?|d[ií]a?s?)/i);
  if (intervalMatch) {
    const val = parseInt(intervalMatch[1]);
    const unit = intervalMatch[2].toLowerCase();
    let cron = "*/5 * * * *";
    if (unit.startsWith("min")) cron = `*/${val} * * * *`;
    else if (unit.startsWith("h")) cron = `0 */${val} * * *`;
    else if (unit.startsWith("d") || unit.startsWith("dí")) cron = `0 0 */${val} * *`;

    return {
      type: "schedule",
      triggerConfig: { cron },
      steps: [],
      label: `Programado cada ${val} ${unit}`,
    };
  }

  // --- Stock bajo: "haya stock bajo" / "faltan materiales" ---
  // No generamos condition step porque el trigger event_low_stock ya lleva
  // la condición implícita y el sistema event-driven aún no setea vars.material
  if (/stock\s+bajo/i.test(norm) || /materiales?\s+falt/i.test(norm)) {
    return {
      type: "event_low_stock",
      steps: [],
      label: "Stock bajo detectado",
    };
  }

  // --- Presupuesto: "una obra supere el [porcentaje]% del presupuesto" ---
  const budgetMatch = norm.match(
    /(?:una\s+)?obra\s+(?:supere|pase|exceda|esté\s+por\s+encima|llega)\s+(?:del?\s+)?(\d+)\s*%/i
  );
  if (budgetMatch || /presupuesto/i.test(norm) && /obra/i.test(norm)) {
    const pct = budgetMatch ? parseInt(budgetMatch[1]) : 85;
    return {
      type: "event_budget_overrun",
      steps: [
        {
          type: "condition",
          label: `¿Obra superó ${pct}% del presupuesto?`,
          config: {
            field: "project.budgetPct",
            operator: "gte",
            value: pct,
          } as ConditionConfig,
        },
      ],
      label: `Obra supera ${pct}% del presupuesto`,
    };
  }

  // --- Tareas atrasadas ---
  if (/tareas?\s+atrasadas?|tareas?\s+vencidas?/i.test(norm)) {
    return {
      type: "event_late_task",
      steps: [],
      label: "Tareas atrasadas",
    };
  }

  // --- Nueva obra ---
  if (/(?:nueva|nuevo|crea)\s+obra|obra\s+nueva/i.test(norm)) {
    return {
      type: "event_new_project",
      steps: [],
      label: "Nueva obra creada",
    };
  }

  // --- Gasto grande: "se registre un gasto de más de [monto]" ---
  const expenseMatch = norm.match(
    /(?:un\s+)?gasto\s+(?:de\s+)?(?:m[áa]s\s+de|mayor\s+a|superior\s+a)\s*\$?\s*(\d[\d.,]*)/i
  );
  if (expenseMatch || /gasto\s+(?:grande|significativo|supera)/i.test(norm)) {
    return {
      type: "event_new_transaction",
      steps: [],
      label: "Gasto significativo",
    };
  }

  // --- Manual / default ---
  return {
    type: "manual",
    steps: [],
    label: `Manual: ${text}`,
  };
}

// ─── Parsear acción ───

interface ParsedAction {
  steps: WorkflowStepConfig[];
  label: string;
}

function parseAction(text: string): ParsedAction {
  const norm = normalize(text);

  // --- Crear tarea ---
  const taskMatch = norm.match(
    /(?:cre[áa]|cre[ée]|nueva|creame|creáme|agenda|agendame)\s*(?::\s*)?(?:una\s+)?(?:tarea|pendiente)\s*(?::\s*)?["']?(.+?)["']?$/i
  );
  if (taskMatch) {
    const title = taskMatch[1].trim();
    const priority = /urgente|critical|alta|critical/i.test(norm) ? "critical"
      : /importante|high|alta/i.test(norm) ? "high"
      : "medium";

    return {
      label: `Crear tarea: ${title.slice(0, 60)}`,
      steps: [
        {
          type: "action_create_task",
          label: `Crear tarea: ${title.slice(0, 40)}`,
          config: {
            title,
            priority,
          } as ActionCreateTaskConfig,
        },
      ],
    };
  }

  // --- Enviar alerta ---
  const alertMatch = norm.match(
    /(?:mand[áa]|env[ií]a|cre[áa]|mostr[áa])\s*(?::\s*)?(?:una\s+)?(?:alerta|notificación|notificacion|aviso|mensaje)\s*(?::\s*)?["']?(.+?)["']?$/i
  );
  if (alertMatch) {
    const title = alertMatch[1].trim();
    const severity = /cr[íi]tica|urgente|critical/i.test(norm) ? "critical"
      : /importante|warning|media/i.test(norm) ? "warning"
      : "info";

    return {
      label: `Alerta: ${title.slice(0, 60)}`,
      steps: [
        {
          type: "action_send_alert",
          label: `Enviar alerta: ${title.slice(0, 40)}`,
          config: {
            title: title.slice(0, 200),
            description: title.slice(0, 500),
            severity,
          } as ActionSendAlertConfig,
        },
      ],
    };
  }

  // --- Registrar gasto ---
  const expenseMatch = norm.match(
    /(?:registr[áa]|carg[áa]|anot[áa])\s*(?::\s*)?(?:un\s+)?gasto\s+(?:de\s+)?\$?\s*(\d[\d.,]*)\s*(?:en\s+)?(.+?)?$/i
  );
  if (expenseMatch) {
    const amount = parseFloat(expenseMatch[1].replace(/[.,]/g, ""));
    const category = expenseMatch[2]?.trim() || "materiales";

    return {
      label: `Registrar gasto: $${amount} en ${category}`,
      steps: [
        {
          type: "action_create_expense",
          label: `Gasto de $${amount} en ${category}`,
          config: {
            type: "expense",
            category,
            description: `Gasto automático: ${category}`,
            amount,
          } as ActionCreateTransactionConfig,
        },
      ],
    };
  }

  // --- Registrar ingreso ---
  const incomeMatch = norm.match(
    /(?:registr[áa]|carg[áa])\s*(?::\s*)?(?:un\s+)?(?:ingreso|venta|cobro)\s+(?:de\s+)?\$?\s*(\d[\d.,]*)/i
  );
  if (incomeMatch) {
    const amount = parseFloat(incomeMatch[1].replace(/[.,]/g, ""));

    return {
      label: `Registrar ingreso: $${amount}`,
      steps: [
        {
          type: "action_create_income",
          label: `Ingreso de $${amount}`,
          config: {
            type: "income",
            category: "venta",
            description: "Ingreso automático",
            amount,
          } as ActionCreateTransactionConfig,
        },
      ],
    };
  }

  // --- Actualizar avance ---
  const progressMatch = norm.match(
    /(?:actualiz[áa]|pone|sete[áa])\s*(?::\s*)?(?:el\s+)?(?:avance|progreso)\s+(?:de\s+)?(?:la\s+)?(?:obra\s+)?(?:a|al)\s+(\d+)\s*%/i
  );
  if (progressMatch) {
    const pct = Math.min(100, Math.max(0, parseInt(progressMatch[1])));

    return {
      label: `Actualizar avance al ${pct}%`,
      steps: [
        {
          type: "action_update_project_progress",
          label: `Avance al ${pct}%`,
          config: {
            projectRef: "{{workflow.projectId}}",
            progress: pct,
          } as ActionUpdateProjectProgressConfig,
        },
      ],
    };
  }

  // --- Actualizar estado obra ---
  const statusMatch = norm.match(
    /(?:pone|dej[áa]|cambi[áa])\s*(?::\s*)?(?:la\s+)?(?:obra\s+)?(?:como|a|en)\s+(activa|pausada|terminada|finalizada|completada|cancelada)/i
  );
  if (statusMatch) {
    const statusMap: Record<string, string> = {
      activa: "in_progress", pausada: "paused",
      terminada: "finished", finalizada: "finished",
      completada: "finished", cancelada: "cancelled",
    };

    return {
      label: `Cambiar obra a ${statusMatch[1]}`,
      steps: [
        {
          type: "action_update_project_status",
          label: `Estado: ${statusMatch[1]}`,
          config: {
            projectRef: "{{workflow.projectId}}",
            status: statusMap[statusMatch[1].toLowerCase()] || statusMatch[1],
          } as ActionUpdateProjectStatusConfig,
        },
      ],
    };
  }

  // --- Esperar / delay ---
  const delayMatch = norm.match(
    /(?:esper[áa]|delay)\s+(?:por\s+)?(\d+)\s+(min(?:uto)?s?|hora?s?|d[ií]a?s?)/i
  );
  if (delayMatch) {
    const val = parseInt(delayMatch[1]);
    const unit = delayMatch[2].toLowerCase().startsWith("h") ? "hours"
      : delayMatch[2].toLowerCase().startsWith("d") ? "days"
      : "minutes";

    return {
      label: `Esperar ${val} ${unit}`,
      steps: [
        {
          type: "delay",
          label: `Delay ${val} ${unit}`,
          config: { unit, value: Math.min(val, 60) } as DelayConfig,
        },
      ],
    };
  }

  // --- Fallback: crear tarea genérica ---
  if (norm.length > 3) {
    return {
      label: `Crear tarea: ${text.slice(0, 60)}`,
      steps: [
        {
          type: "action_create_task",
          label: `Tarea automática`,
          config: {
            title: text.slice(0, 200),
            priority: "medium",
          } as ActionCreateTaskConfig,
        },
      ],
    };
  }

  return { steps: [], label: "(acción vacía)" };
}

// ─── Generar nombre del workflow ───

function generateWorkflowName(condition: string, actions: string[]): string {
  const condShort = condition.slice(0, 50).replace(/["']/g, "");
  const actionShort = actions[0]?.slice(0, 40).replace(/["']/g, "") || "acción automática";
  return `🤖 ${condShort} → ${actionShort}`.slice(0, 200);
}

function generateWorkflowDescription(condition: string, actions: string[]): string {
  const actionLines = actions.map((a, i) => `${i + 1}. ${a}`).join("\n");
  return `Creado desde el chat.\n\n**Condición:** ${condition}\n**Acciones:**\n${actionLines}`.slice(0, 500);
}

// ─── Parser principal ───

export async function createWorkflowFromText(text: string): Promise<WorkflowFromTextResult> {
  const result: WorkflowFromTextResult = {
    name: "",
    description: "",
    trigger: "manual",
    steps: [],
    rawCondition: "",
    rawActions: [],
    success: false,
  };

  // 1. Separar condición y acciones
  const split = splitConditionAndActions(text);
  if (!split) {
    return {
      ...result,
      success: false,
      error: `No entendí la estructura. Escribí algo como:\n\n*cuando el stock de cemento baje de 50, creame una tarea: reponer*`,
    };
  }

  result.rawCondition = split.condition;
  result.rawActions = split.actions;

  // 2. Parsear condición
  const parsedCondition = parseCondition(split.condition);
  result.trigger = parsedCondition.type;
  result.triggerConfig = parsedCondition.triggerConfig;

  // 3. Parsear cada acción
  const allSteps: WorkflowStepConfig[] = [...parsedCondition.steps];

  for (const actionText of split.actions) {
    const parsedAction = parseAction(actionText);
    if (parsedAction.steps.length === 0) {
      // Fallback: crear tarea con el texto completo
      allSteps.push({
        type: "action_create_task",
        label: `Tarea: ${actionText.slice(0, 40)}`,
        config: {
          title: actionText.slice(0, 200),
          priority: "medium",
        } as ActionCreateTaskConfig,
      });
    } else {
      allSteps.push(...parsedAction.steps);
    }
  }

  result.steps = allSteps;

  // 4. Generar nombre y descripción
  result.name = generateWorkflowName(split.condition, split.actions);
  result.description = generateWorkflowDescription(split.condition, split.actions);

  // 5. Guardar en DB
  try {
    const { getTenantSafe } = await import("@/lib/tenant");
    const orgId = (await getTenantSafe())?.organizationId ?? "default";

    const workflow = await db.workflow.create({
      data: {
        name: result.name,
        description: result.description,
        trigger: result.trigger,
        triggerConfig: result.triggerConfig ? JSON.stringify(result.triggerConfig) : null,
        enabled: true,
        organizationId: orgId,
      },
    });

    // Crear steps
    for (let i = 0; i < allSteps.length; i++) {
      const step = allSteps[i];
      await db.workflowStep.create({
        data: {
          workflowId: workflow.id,
          type: step.type,
          label: step.label || null,
          config: JSON.stringify(step),
          order: (i + 1) * 10,
          parentId: null,
        },
      });
    }

    result.success = true;
  } catch (error: any) {
    result.success = false;
    result.error = `Error al guardar el workflow: ${error.message}`;
  }

  return result;
}

// ─── Generar respuesta legible ───

export function generateWorkflowCreatedResponse(result: WorkflowFromTextResult): string {
  const triggerLabels: Record<string, string> = {
    manual: "Ejecución manual",
    schedule: "Programado (cron)",
    event_low_stock: "Stock bajo",
    event_budget_overrun: "Obra sobre presupuesto",
    event_late_task: "Tarea atrasada",
    event_new_project: "Nueva obra",
    event_new_transaction: "Nuevo movimiento",
  };

  const actionEmojis: Record<string, string> = {
    condition: "🔀",
    action_create_task: "📋",
    action_send_alert: "🔔",
    action_create_expense: "💸",
    action_create_income: "💰",
    action_update_project_progress: "📈",
    action_update_project_status: "🔄",
    delay: "⏳",
  };

  const triggerLabel = triggerLabels[result.trigger] || result.trigger;
  const actionLines = result.steps
    .filter(s => s.type !== "condition") // conditions son parte del trigger
    .map(s => `${actionEmojis[s.type] || "•"} **${s.label || s.type}**`)
    .join("\n");

  const cronInfo = result.triggerConfig?.cron
    ? `\n\n⏰ **Programación:** \`${result.triggerConfig.cron}\``
    : "";

  return (
    `✅ **Workflow creado exitosamente**\n\n` +
    `📌 **${result.name}**\n\n` +
    `**Disparador:** ${triggerLabel}${cronInfo}\n\n` +
    `**Pasos:**\n${actionLines}\n\n` +
    `Podés verlo y editarlo desde **Automatizaciones** o ejecutarlo diciendo *ejecutar workflow "${result.name}"*.`
  );
}

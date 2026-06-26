// ============================================================
// MOTOR DE EJECUCIÓN DE WORKFLOWS
// Procesa paso a paso los workflows, maneja condiciones,
// delays, loops, y ejecuta acciones contra la base de datos.
// ============================================================

import { db } from "./db";
import {
  type WorkflowStepConfig,
  type ConditionConfig,
  type ActionCreateTaskConfig,
  type ActionSendAlertConfig,
  type ActionCreateTransactionConfig,
  type ActionCreateProjectConfig,
  type ActionCreateSupplierConfig,
  type ActionUpdateProjectProgressConfig,
  type ActionUpdateProjectStatusConfig,
  type ActionAddMaterialsConfig,
  type DelayConfig,
  type LoopConfig,
  type ExecutionContext,
  type ExecutionLogEntry,
  type WorkflowWithSteps,
  type WorkflowStepWithParsed,
} from "./workflow-types";
import type {
  ActionSendEmailConfig,
  ActionRunWorkflowConfig,
  ActionWebhookConfig,
} from "./workflow-types";
import { normalize, generateSku } from "./agent";

// ─── Helpers ───

function interpolate(text: string, vars: Record<string, any>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const val = key.trim().split(".").reduce((obj: any, k: string) => obj?.[k], vars);
    return val !== undefined && val !== null ? String(val) : `{{${key}}}`;
  });
}

async function resolveProject(ref?: string) {
  if (!ref) return null;
  const norm = normalize(ref);
  if (/^\d+$/.test(norm)) {
    const padded = norm.padStart(3, "0");
    return await db.project.findFirst({ where: { OR: [{ code: `OB-${padded}` }, { code: { contains: norm } }] } });
  }
  if (/^ob[-]?\d+$/i.test(norm)) {
    return await db.project.findFirst({ where: { code: { contains: norm.replace(/\s/, "-").toUpperCase() } } });
  }
  const all = await db.project.findMany();
  let found = all.find((p) => normalize(p.name) === norm);
  if (found) return found;
  found = all.find((p) => normalize(p.name).includes(norm) || norm.includes(normalize(p.name)));
  if (found) return found;
  const words = norm.split(" ").filter((w) => w.length > 2);
  if (words.length > 0) {
    let best: (typeof all)[0] | null = null;
    let bestScore = 0;
    for (const p of all) {
      const pn = normalize(p.name);
      const score = words.filter((w) => pn.includes(w)).length;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (bestScore > 0) return best;
  }
  return null;
}

// ─── Evaluar condición ───

function evaluateCondition(config: ConditionConfig, vars: Record<string, any>): boolean {
  const value = config.field.split(".").reduce((obj: any, k: string) => obj?.[k], vars);
  switch (config.operator) {
    case "eq":
      return value === config.value;
    case "neq":
      return value !== config.value;
    case "gt":
      return Number(value) > Number(config.value);
    case "gte":
      return Number(value) >= Number(config.value);
    case "lt":
      return Number(value) < Number(config.value);
    case "lte":
      return Number(value) <= Number(config.value);
    case "contains":
      return String(value).includes(String(config.value));
    case "is_empty":
      return !value || (Array.isArray(value) && value.length === 0) || (typeof value === "object" && Object.keys(value).length === 0);
    case "not_empty":
      return !!value && (!Array.isArray(value) || value.length > 0);
    default:
      return false;
  }
}

// ─── Ejecutar una acción ───

async function executeAction(
  config: WorkflowStepConfig,
  ctx: ExecutionContext
): Promise<{ success: boolean; data?: any; error?: string }> {
  const vars = ctx.variables;

  try {
    switch (config.type) {
      case "action_create_task": {
        const c = config.config as ActionCreateTaskConfig;
        let projectId: string | undefined;
        if (c.projectRef) {
          const proj = await resolveProject(interpolate(c.projectRef, vars));
          if (proj) projectId = proj.id;
        }
        const dueDate = c.dueDays ? new Date(Date.now() + c.dueDays * 86400000) : null;
        const task = await db.task.create({
          data: {
            title: interpolate(c.title, vars).slice(0, 200),
            description: c.description ? interpolate(c.description, vars) : null,
            priority: c.priority || "medium",
            assignee: c.assignee ? interpolate(c.assignee, vars) : null,
            dueDate,
            projectId,
            createdBy: "workflow",
          },
        });
        ctx.variables.lastTask = task;
        return { success: true, data: task };
      }

      case "action_send_alert": {
        const c = config.config as ActionSendAlertConfig;
        const action = await db.agentAction.create({
          data: {
            type: "alert",
            severity: c.severity || "info",
            title: interpolate(c.title, vars).slice(0, 200),
            description: interpolate(c.description, vars).slice(0, 500),
            status: "active",
          },
        });
        ctx.variables.lastAlert = action;
        return { success: true, data: action };
      }

      case "action_create_expense":
      case "action_create_income": {
        const c = config.config as ActionCreateTransactionConfig;
        let projectId: string | undefined;
        if (c.projectRef) {
          const proj = await resolveProject(interpolate(c.projectRef, vars));
          if (proj) projectId = proj.id;
        }
        let supplierId: string | undefined;
        if (c.supplierRef) {
          const sup = await db.supplier.findFirst({ where: { name: { contains: interpolate(c.supplierRef, vars), mode: "insensitive" } } });
          if (sup) supplierId = sup.id;
        }
        const amount = typeof c.amount === "number" ? c.amount : parseFloat(interpolate(String(c.amount), vars));
        const tx = await db.transaction.create({
          data: {
            type: config.type === "action_create_expense" ? "expense" : "income",
            category: c.category || "otros",
            description: interpolate(c.description, vars),
            amount,
            projectId,
            supplierId,
            date: new Date(),
          },
        });
        ctx.variables.lastTransaction = tx;
        return { success: true, data: tx };
      }

      case "action_create_project": {
        const c = config.config as ActionCreateProjectConfig;
        const allProjects = await db.project.findMany({ select: { code: true } });
        let maxNum = 0;
        for (const p of allProjects) {
          const m = p.code?.match(/OB-(\d+)/i);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxNum) maxNum = n;
          }
        }
        const code = `OB-${String(maxNum + 1).padStart(3, "0")}`;
        const project = await db.project.create({
          data: {
            code,
            name: interpolate(c.name, vars),
            budget: c.budget || 0,
            clientName: c.clientName || null,
            status: "planning",
            type: "obra",
            progress: 0,
          },
        });
        ctx.variables.lastProject = project;
        return { success: true, data: project };
      }

      case "action_create_supplier": {
        const c = config.config as ActionCreateSupplierConfig;
        const supplier = await db.supplier.create({
          data: {
            name: interpolate(c.name, vars),
            phone: c.phone || null,
            email: c.email || null,
            category: c.category || null,
            rating: 3,
          },
        });
        ctx.variables.lastSupplier = supplier;
        return { success: true, data: supplier };
      }

      case "action_update_project_progress": {
        const c = config.config as ActionUpdateProjectProgressConfig;
        const project = await resolveProject(interpolate(c.projectRef, vars));
        if (!project) return { success: false, error: "Proyecto no encontrado" };
        const updated = await db.project.update({
          where: { id: project.id },
          data: {
            progress: Math.min(100, Math.max(0, c.progress)),
            ...(c.progress >= 100 ? { status: "finished", endDate: new Date() } : {}),
          },
        });
        ctx.variables.lastUpdatedProject = updated;
        return { success: true, data: updated };
      }

      case "action_update_project_status": {
        const c = config.config as ActionUpdateProjectStatusConfig;
        const project = await resolveProject(interpolate(c.projectRef, vars));
        if (!project) return { success: false, error: "Proyecto no encontrado" };
        const statusMap: Record<string, string> = {
          activa: "in_progress",
          "en curso": "in_progress",
          pausada: "paused",
          terminada: "finished",
          finalizada: "finished",
          planificacion: "planning",
        };
        const status = statusMap[c.status] || c.status;
        const updated = await db.project.update({
          where: { id: project.id },
          data: {
            status,
            ...(status === "finished" ? { progress: 100, endDate: new Date() } : {}),
          },
        });
        ctx.variables.lastUpdatedProject = updated;
        return { success: true, data: updated };
      }

      case "action_add_materials": {
        const c = config.config as ActionAddMaterialsConfig;
        const created: any[] = [];
        for (const item of c.items) {
          const name = interpolate(item.name, vars);
          const existing = await db.material.findFirst({
            where: { name: { contains: name, mode: "insensitive" } },
          });
          if (existing) {
            await db.material.update({
              where: { id: existing.id },
              data: { stock: { increment: item.qty } },
            });
            await db.stockMovement.create({
              data: {
                type: "incoming",
                quantity: item.qty,
                unitCost: existing.unitCost,
                reason: "compra",
                note: "Workflow automatizado",
                materialId: existing.id,
              },
            });
            created.push({ ...existing, updated: true });
          } else {
            const sku = generateSku(name);
            const mat = await db.material.create({
              data: {
                sku,
                name: name.charAt(0).toUpperCase() + name.slice(1),
                category: "general",
                unit: item.unit || "unidad",
                stock: item.qty,
                minStock: 0,
              },
            });
            await db.stockMovement.create({
              data: {
                type: "incoming",
                quantity: item.qty,
                unitCost: 0,
                reason: "compra",
                note: "Workflow automatizado",
                materialId: mat.id,
              },
            });
            created.push(mat);
          }
        }
        ctx.variables.lastMaterials = created;
        return { success: true, data: created };
      }

      case "action_reorder": {
        const materials = await db.material.findMany({
          include: { supplier: true },
        });
        const items = materials.filter((m) => m.stock <= m.minStock && m.minStock > 0);
        ctx.variables.reorderItems = items;
        return { success: true, data: items };
      }

      case "action_close_project": {
        const c = config.config as any;
        const project = await resolveProject(interpolate(c?.projectRef || "", vars));
        if (!project) return { success: false, error: "Proyecto no encontrado" };
        const transactions = await db.transaction.findMany({ where: { projectId: project.id } });
        const spent = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
        const updated = await db.project.update({
          where: { id: project.id },
          data: { status: "finished", progress: 100, endDate: new Date() },
        });
        ctx.variables.lastClosedProject = { project: updated, spent, income };
        return { success: true, data: { project: updated, spent, income } };
      }

      case "action_complete_task": {
        const c = config.config as any;
        const title = interpolate(c?.title || "", vars);
        const task = await db.task.findFirst({
          where: { title: { contains: title, mode: "insensitive" }, status: { in: ["pending", "in_progress"] } },
        });
        if (!task) return { success: false, error: "Tarea no encontrada" };
        const updated = await db.task.update({ where: { id: task.id }, data: { status: "completed" } });
        ctx.variables.lastCompletedTask = updated;
        return { success: true, data: updated };
      }

      case "delay": {
        const c = config.config as DelayConfig;
        const ms =
          c.unit === "minutes" ? c.value * 60000 : c.unit === "hours" ? c.value * 3600000 : c.value * 86400000;
        await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 30000))); // max 30s en ejecución real
        return { success: true, data: { delayed: ms } };
      }

      case "loop": {
        const c = config.config as LoopConfig;
        const maxIters = c.maxIterations || 10;
        const items = c.dataSource ? vars[c.dataSource] : [];
        if (Array.isArray(items)) {
          const results: any[] = [];
          for (let i = 0; i < Math.min(items.length, maxIters); i++) {
            ctx.variables.loopItem = items[i];
            ctx.variables.loopIndex = i;
            // Los sub-pasos del loop se ejecutan en el engine principal
            results.push({ index: i, item: items[i] });
          }
          return { success: true, data: results };
        }
        // Repeat N times
        const results: any[] = [];
        for (let i = 0; i < maxIters; i++) {
          ctx.variables.loopIndex = i;
          results.push({ index: i });
        }
        return { success: true, data: results };
      }

      case "action_send_email": {
        const c = config.config as ActionSendEmailConfig;
        // Registrar la intención de envío (requiere servicio SMTP externo configurado)
        const action = await db.agentAction.create({
          data: {
            type: "alert",
            severity: "info",
            title: `📧 Email pendiente: ${interpolate(c.subject, vars).slice(0, 200)}`,
            description: `Para: ${interpolate(c.to, vars).slice(0, 200)}\nAsunto: ${interpolate(c.subject, vars).slice(0, 200)}\nCuerpo: ${interpolate(c.body, vars).slice(0, 250)}`,
            status: "active",
          },
        });
        ctx.variables.lastEmail = action;
        return { success: true, data: action };
      }

      case "action_run_workflow": {
        const c = config.config as ActionRunWorkflowConfig;
        const subWorkflowId = interpolate(c.workflowId, vars);
        const result = await executeWorkflow(subWorkflowId, "event", ctx.variables);
        return result.success
          ? { success: true, data: result.logs }
          : { success: false, error: `Sub-workflow falló: ${result.logs.find(l => l.status === "failed")?.error || "error desconocido"}` };
      }

      case "action_webhook": {
        const c = config.config as ActionWebhookConfig;
        const url = interpolate(c.url, vars);
        const method = c.method || "POST";
        const headers = c.headers || {};
        const body = c.body ? interpolate(JSON.stringify(c.body), vars) : undefined;

        try {
          const response = await fetch(url, {
            method,
            headers: {
              "Content-Type": "application/json",
              ...headers,
            },
            body: method !== "GET" ? body : undefined,
          });

          const responseBody = await response.text();
          ctx.variables.lastWebhookResponse = { status: response.status, body: responseBody.slice(0, 1000) };

          return {
            success: response.ok,
            data: { status: response.status, body: responseBody.slice(0, 500) },
            error: response.ok ? undefined : `HTTP ${response.status}: ${responseBody.slice(0, 200)}`,
          };
        } catch (error: any) {
          return { success: false, error: `Error en webhook: ${error.message}` };
        }
      }

      case "action_update_stock": {
        const c = config.config as any;
        const materialName = interpolate(c.materialName || "", vars);
        const qty = typeof c.quantity === "number" ? c.quantity : parseFloat(interpolate(String(c.quantity || "0"), vars));
        const movementType = c.movementType || "incoming";

        const material = materialName
          ? await db.material.findFirst({ where: { name: { contains: materialName, mode: "insensitive" } } })
          : null;

        if (!material) return { success: false, error: `Material no encontrado: ${materialName}` };

        await db.material.update({
          where: { id: material.id },
          data: { stock: movementType === "incoming" ? { increment: qty } : { decrement: qty } },
        });

        await db.stockMovement.create({
          data: {
            type: movementType,
            quantity: qty,
            unitCost: material.unitCost,
            reason: movementType === "incoming" ? "compra" : "consumo",
            note: "Workflow automatizado",
            materialId: material.id,
          },
        });

        ctx.variables.lastStockUpdate = { material, qty, movementType };
        return { success: true, data: { material, qty, movementType } };
      }

      default:
        return { success: false, error: `Tipo de paso no soportado: ${config.type}` };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── Ejecutar workflow completo ───

export async function executeWorkflow(
  workflowId: string,
  trigger: "manual" | "schedule" | "event" | "webhook" = "manual",
  initialVars: Record<string, any> = {}
): Promise<{ success: boolean; execution: any; logs: ExecutionLogEntry[] }> {
  const workflow = await db.workflow.findUnique({
    where: { id: workflowId },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  if (!workflow) {
    return { success: false, execution: null, logs: [{ stepId: "0", stepType: "error", status: "failed", startedAt: new Date().toISOString(), error: "Workflow no encontrado" }] };
  }

  // Crear ejecución
  const execution = await db.workflowExecution.create({
    data: {
      workflowId,
      status: "running",
      triggeredBy: trigger,
      startedAt: new Date(),
    },
  });

  const ctx: ExecutionContext = {
    workflowId,
    executionId: execution.id,
    triggeredBy: trigger,
    variables: { ...initialVars, workflow: { id: workflow.id, name: workflow.name } },
    logs: [],
  };

  const steps = await db.workflowStep.findMany({
    where: { workflowId },
    orderBy: { order: "asc" },
  });

  let success = true;

  for (const step of steps) {
    const parsedConfig: WorkflowStepConfig = JSON.parse(step.config);
    const logEntry: ExecutionLogEntry = {
      stepId: step.id,
      stepLabel: step.label || undefined,
      stepType: step.type,
      status: "running",
      startedAt: new Date().toISOString(),
    };

    try {
      // Si es condición, evaluar
      if (parsedConfig.type === "condition") {
        const condConfig = parsedConfig.config as ConditionConfig;
        const result = evaluateCondition(condConfig, ctx.variables);
        logEntry.data = { condition: condConfig.field, operator: condConfig.operator, value: condConfig.value, result };
        logEntry.status = "completed";
        ctx.variables.lastConditionResult = result;
      } else {
        const result = await executeAction(parsedConfig, ctx);
        if (result.success) {
          logEntry.status = "completed";
          logEntry.data = result.data;
        } else {
          logEntry.status = "failed";
          logEntry.error = result.error;
          success = false;
        }
      }
    } catch (error: any) {
      logEntry.status = "failed";
      logEntry.error = error.message;
      success = false;
    }

    logEntry.completedAt = new Date().toISOString();
    ctx.logs.push(logEntry);

    // Si falló y no es condición ni delay ni loop, detener
    if (logEntry.status === "failed" && parsedConfig.type !== "condition" && parsedConfig.type !== "delay") {
      break;
    }
  }

  // Actualizar ejecución
  await db.workflowExecution.update({
    where: { id: execution.id },
    data: {
      status: success ? "completed" : "failed",
      completedAt: new Date(),
      log: JSON.stringify(ctx.logs),
      error: success ? null : ctx.logs.find((l) => l.status === "failed")?.error || null,
    },
  });

  return { success, execution: { ...execution, status: success ? "completed" : "failed" }, logs: ctx.logs };
}

// ─── Ejecutar todos los workflows con un trigger específico ───

export async function triggerWorkflows(
  event: string,
  vars: Record<string, any> = {}
): Promise<{ triggered: number; results: any[] }> {
  const workflows = await db.workflow.findMany({
    where: {
      enabled: true,
      trigger: event,
    },
  });

  const results: any[] = [];
  for (const wf of workflows) {
    try {
      const result = await executeWorkflow(wf.id, "event", vars);
      results.push({ workflowId: wf.id, name: wf.name, ...result });
    } catch (error: any) {
      results.push({ workflowId: wf.id, name: wf.name, success: false, error: error.message });
    }
  }

  return { triggered: results.length, results };
}

// ─── Verificar schedules pendientes ───

export async function checkSchedules(): Promise<any[]> {
  const now = new Date();
  const schedules = await db.agentSchedule.findMany({
    where: { enabled: true, OR: [{ nextRun: { lte: now } }, { nextRun: null }] },
  });

  const triggered: any[] = [];

  for (const sched of schedules) {
    try {
      const config = JSON.parse(sched.config);

      switch (sched.type) {
        case "check_alerts": {
          const { runAutomations } = await import("./agent");
          const alerts = await runAutomations();
          triggered.push({ scheduleId: sched.id, name: sched.name, type: sched.type, result: `${alerts.length} alertas` });
          break;
        }
        case "run_workflow": {
          if (config.workflowId) {
            const result = await executeWorkflow(config.workflowId, "schedule");
            triggered.push({ scheduleId: sched.id, name: sched.name, type: sched.type, result: result.success ? "completado" : "falló" });
          }
          break;
        }
        default:
          triggered.push({ scheduleId: sched.id, name: sched.name, type: sched.type, result: "tipo no soportado" });
      }

      // Calcular próxima ejecución
      const nextRun = getNextCronDate(sched.cron);
      await db.agentSchedule.update({
        where: { id: sched.id },
        data: { lastRun: now, nextRun },
      });
    } catch (error: any) {
      triggered.push({ scheduleId: sched.id, name: sched.name, error: error.message });
    }
  }

  return triggered;
}

// ─── Calcular próxima fecha cron (simplificado) ───

function getNextCronDate(cron: string): Date {
  const parts = cron.split(" ");
  if (parts.length < 5) return new Date(Date.now() + 60000);

  const minute = parts[0] === "*" ? undefined : parseInt(parts[0]);
  const hour = parts[1] === "*" ? undefined : parseInt(parts[1]);
  const dayOfMonth = parts[2] === "*" ? undefined : parseInt(parts[2]);
  const month = parts[3] === "*" ? undefined : parseInt(parts[3]) - 1;
  const dayOfWeek = parts[4] === "*" ? undefined : parseInt(parts[4]);

  const now = new Date();
  const next = new Date(now);

  // Simplificación: agregar intervalo basado en el patrón
  if (minute !== undefined && hour === undefined) {
    // Cada N minutos: sumar minutos hasta el próximo
    next.setMinutes(next.getMinutes() + minute);
  } else if (hour !== undefined && minute !== undefined) {
    // A una hora específica: avanzar al próximo día a esa hora
    if (next.getHours() >= hour || (next.getHours() === hour && next.getMinutes() >= minute)) {
      next.setDate(next.getDate() + 1);
    }
    next.setHours(hour, minute, 0, 0);
  } else {
    // Default: 5 minutos
    next.setMinutes(next.getMinutes() + 5);
  }

  return next;
}

// ─── Ejecutar el scheduler (llamado desde API) ───

export async function runScheduler(): Promise<any[]> {
  return await checkSchedules();
}

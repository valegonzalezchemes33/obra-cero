#!/usr/bin/env node
// ============================================================
// ObraCero MCP BRIDGE — Conecta tu sistema a Hermes Agent
// Expone tu Agent Engine, Workflow Engine, Automations,
// Scheduler y DB como tools nativas de Hermes
// ============================================================
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─── IMPORTS REALES DE TU SISTEMA ───
// @ts-ignore — TS no resuelve path aliases en modo standalone, pero funciona en runtime con tsx
import { db } from "../src/lib/db.js";
import { parseIntent, runAutomations, normalize, type AgentResponse, type AgentActionItem } from "../src/lib/agent.js";
import { processMessage } from "../src/lib/agent-extended.js";
import { executeWorkflow, triggerWorkflows, checkSchedules } from "../src/lib/workflow-engine.js";
import { createWorkflowFromText } from "../src/lib/workflow-from-text.js";
import { queryRAG } from "../src/lib/agent-rag.js";
import { detectPatterns, generatePredictiveResponse } from "../src/lib/agent-predictive.js";
import { getConversationContext, saveContextMetadata, getPendingAction, clearPendingAction } from "../src/lib/agent-memory.js";

const SERVER_NAME = "ObraCero Bridge";
const SERVER_VERSION = "1.0.0";

// ─── MCP SERVER ───
const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

// ═══════════════════════════════════════════════
// AGENT TOOLS — Chat, Acciones, Memoria, RAG
// ═══════════════════════════════════════════════

server.tool(
  "obracero_agent_chat",
  "Chatea con el agente interno de ObraCero (NLU, memoria conversacional, RAG, 45+ intenciones, predicciones). Responde en español argentino con formato profesional. Usa esto para consultas, análisis, KPIs, anomalías y recomendaciones.",
  {
    message: z.string().describe("Mensaje del usuario en español"),
    projectId: z.string().optional().describe("ID de obra opcional para contexto"),
  },
  async ({ message, projectId }) => {
    // processMessage ejecuta NLU + memory + RAG + predictive + responde
    const response: AgentResponse = await processMessage(message, projectId || null);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          respuesta: response.text,
          intencion: response.intent,
          datos: response.data,
          acciones: response.actions,
          sugerencias: response.suggestions,
        }, null, 2),
      }],
    };
  }
);

server.tool(
  "obracero_agent_parse",
  "Analiza un texto y devuelve la intención detectada + entidades extraídas (sin ejecutar nada). Útil para previsualizar cómo el agente interpreta un comando antes de ejecutarlo.",
  {
    text: z.string().describe("Texto a analizar"),
  },
  async ({ text }) => {
    const parsed = parseIntent(text);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          intencion: parsed.intent,
          confianza: parsed.confidence,
          entidades: parsed.entities,
          textoNormalizado: parsed.normalized,
        }, null, 2),
      }],
    };
  }
);

server.tool(
  "obracero_agent_memory_context",
  "Obtiene el contexto actual de la conversación (últimas referencias a obras, materiales, intenciones). El agente usa esto para resolver pronombres como 'esa obra' o 'este material'.",
  {},
  async () => {
    const ctx = await getConversationContext();
    const pending = await getPendingAction();
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          contexto: ctx,
          accionPendiente: pending,
        }, null, 2),
      }],
    };
  }
);

server.tool(
  "obracero_agent_rag",
  "Consulta la base de conocimiento RAG del agente (documentación interna, normativas, histórico de obras, contratos, etc.)",
  {
    query: z.string().describe("Consulta en lenguaje natural"),
    topK: z.number().default(5).describe("Número de resultados (1-20)"),
  },
  async ({ query, topK }) => {
    const results = queryRAG(query, Math.max(1, Math.min(20, topK)));
    return {
      content: [{
        type: "text",
        text: JSON.stringify(results, null, 2),
      }],
    };
  }
);

server.tool(
  "obracero_agent_predictive",
  "Análisis predictivo: detecta patrones en los datos y genera recomendaciones proactivas (presupuesto, forecast, ETA, riesgos).",
  {
    context: z.string().optional().describe("Contexto adicional para el análisis (opcional)"),
  },
  async ({ context }) => {
    const patterns = await detectPatterns();
    const predictions = generatePredictiveResponse(patterns, context || undefined);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ patrones: patterns, predicciones: predictions }, null, 2),
      }],
    };
  }
);

// ═══════════════════════════════════════════════
// WORKFLOW TOOLS — Ejecutar, Crear, Listar, Modificar
// ═══════════════════════════════════════════════

server.tool(
  "obracero_workflow_execute",
  "Ejecuta un workflow existente por ID. Retorna logs de cada paso: éxito/fallo, datos generados, errores.",
  {
    workflowId: z.string().describe("ID del workflow en la BD"),
    variables: z.record(z.any()).optional().describe("Variables iniciales para el workflow"),
    trigger: z.enum(["manual", "schedule", "event", "webhook"]).default("manual").describe("Tipo de disparador"),
  },
  async ({ workflowId, variables, trigger }) => {
    const result = await executeWorkflow(workflowId, trigger, variables || {});
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          exito: result.success,
          ejecucion: result.execution,
          pasos: result.logs.map((l: any) => ({
            paso: l.stepLabel || l.stepType,
            estado: l.status,
            datos: l.data,
            error: l.error,
          })),
        }, null, 2),
      }],
    };
  }
);

server.tool(
  "obracero_workflow_create_from_text",
  "Crea un workflow nuevo desde lenguaje natural. Ej: 'cuando el stock de cemento baje de 50, creame una tarea: reponer urgente' o 'todos los lunes a las 9 mandame una alerta: revisar pagos pendientes'. El parser extrae trigger, condiciones y acciones automáticamente.",
  {
    text: z.string().describe("Descripción en lenguaje natural del workflow"),
  },
  async ({ text }) => {
    const result = await createWorkflowFromText(text);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          exito: result.success,
          nombre: result.name,
          descripcion: result.description,
          trigger: result.trigger,
          triggerConfig: result.triggerConfig,
          pasos: result.steps.length,
          error: result.error,
        }, null, 2),
      }],
    };
  }
);

server.tool(
  "obracero_workflow_list",
  "Lista todos los workflows con sus pasos y últimas ejecuciones. Filtra por estado (activo/inactivo) o trigger.",
  {
    enabled: z.boolean().optional().describe("Filtrar por activo/inactivo"),
    trigger: z.string().optional().describe("Filtrar por tipo de trigger (manual|schedule|event|webhook)"),
    limit: z.number().default(20).describe("Máximo de resultados"),
  },
  async ({ enabled, trigger, limit }) => {
    const where: any = {};
    if (enabled !== undefined) where.enabled = enabled;
    if (trigger) where.trigger = trigger;

    const workflows = await (db as any).workflow.findMany({
      where,
      take: Math.min(limit, 100),
      orderBy: { updatedAt: "desc" },
      include: {
        steps: { orderBy: { order: "asc" } },
        executions: { orderBy: { startedAt: "desc" }, take: 5 },
      },
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify(workflows.map((wf: any) => ({
          id: wf.id,
          nombre: wf.name,
          descripcion: wf.description,
          trigger: wf.trigger,
          activo: wf.enabled,
          pasos: wf.steps.length,
          ultimaEjecucion: wf.executions[0]?.status || "nunca",
          ejecuciones: wf.executions.length,
        })), null, 2),
      }],
    };
  }
);

server.tool(
  "obracero_workflow_get",
  "Obtiene la definición completa de un workflow (nombre, trigger, todos los pasos con su config, historial de ejecuciones).",
  {
    workflowId: z.string().describe("ID del workflow"),
  },
  async ({ workflowId }) => {
    const workflow = await (db as any).workflow.findUnique({
      where: { id: workflowId },
      include: {
        steps: { orderBy: { order: "asc" } },
        executions: { orderBy: { startedAt: "desc" }, take: 10 },
      },
    });

    if (!workflow) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Workflow no encontrado" }) }] };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          ...workflow,
          pasos: workflow.steps.map((s: any) => ({
            id: s.id,
            tipo: s.type,
            label: s.label,
            config: JSON.parse(s.config),
            orden: s.order,
          })),
          ultimasEjecuciones: workflow.executions.map((e: any) => ({
            id: e.id,
            estado: e.status,
            inicio: e.startedAt,
            fin: e.completedAt,
            error: e.error,
          })),
        }, null, 2),
      }],
    };
  }
);

server.tool(
  "obracero_workflow_toggle",
  "Activa o desactiva un workflow por ID.",
  {
    workflowId: z.string().describe("ID del workflow"),
    enabled: z.boolean().describe("true para activar, false para desactivar"),
  },
  async ({ workflowId, enabled }) => {
    const updated = await (db as any).workflow.update({
      where: { id: workflowId },
      data: { enabled },
    });
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          ok: true,
          id: updated.id,
          nombre: updated.name,
          activo: updated.enabled,
        }, null, 2),
      }],
    };
  }
);

server.tool(
  "obracero_workflow_delete",
  "Elimina un workflow y todos sus pasos y ejecuciones. ¡IRREVERSIBLE!",
  {
    workflowId: z.string().describe("ID del workflow a eliminar"),
  },
  async ({ workflowId }) => {
    // Primero borrar ejecuciones y pasos (cascada no siempre funciona en todos los providers)
    await (db as any).workflowExecution.deleteMany({ where: { workflowId } });
    await (db as any).workflowStep.deleteMany({ where: { workflowId } });
    await (db as any).workflow.delete({ where: { id: workflowId } });
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ ok: true, eliminado: workflowId }, null, 2),
      }],
    };
  }
);

// ═══════════════════════════════════════════════
// TRIGGER WORKFLOWS BY EVENT
// ═══════════════════════════════════════════════

server.tool(
  "obracero_workflow_trigger_event",
  "Dispara todos los workflows asociados a un evento (ej: 'event_low_stock', 'event_budget_overrun', 'event_late_task', 'event_new_project', 'event_new_transaction').",
  {
    event: z.string().describe("Evento: event_low_stock | event_budget_overrun | event_expense_spike | event_late_task | event_new_project | event_new_transaction | event_new_material"),
    variables: z.record(z.any()).optional().describe("Datos del evento (ej: { projectId, materialId })"),
  },
  async ({ event, variables }) => {
    const result = await triggerWorkflows(event, variables || {});
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          workflowsDisparados: result.triggered,
          resultados: result.results.map((r: any) => ({
            workflow: r.name,
            exito: r.success,
            error: r.error,
            pasos: r.logs?.length || 0,
          })),
        }, null, 2),
      }],
    };
  }
);

// ═══════════════════════════════════════════════
// AUTOMATION TOOLS — Reglas de automatización
// ═══════════════════════════════════════════════

server.tool(
  "obracero_automation_run",
  "Ejecuta el motor de automatización: evalúa todas las reglas activas (stock bajo, presupuesto, gastos, tareas atrasadas) y retorna las alertas disparadas.",
  {},
  async () => {
    const alerts: AgentActionItem[] = await runAutomations();
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          alertasDisparadas: alerts.length,
          alertas: alerts.map((a: any) => ({
            tipo: a.type,
            titulo: a.title,
            descripcion: a.description,
            severidad: a.severity,
          })),
        }, null, 2),
      }],
    };
  }
);

server.tool(
  "obracero_automation_list",
  "Lista todas las reglas de automatización (AutomationRule) con su estado.",
  {},
  async () => {
    const rules = await (db as any).automationRule.findMany({ orderBy: { createdAt: "asc" } });
    return {
      content: [{
        type: "text",
        text: JSON.stringify(rules.map((r: any) => ({
          id: r.id,
          nombre: r.name,
          descripcion: r.description,
          trigger: r.trigger,
          accion: r.action,
          activo: r.enabled,
        })), null, 2),
      }],
    };
  }
);

server.tool(
  "obracero_automation_create",
  "Crea una regla de automatización nueva (stock bajo, presupuesto excedido, tareas atrasadas, etc.).",
  {
    name: z.string().describe("Nombre de la regla"),
    description: z.string().optional().describe("Descripción de qué hace"),
    trigger: z.enum(["low_stock", "budget_overrun", "expense_spike", "late_task", "manual"]).describe("Cuándo se dispara"),
    action: z.enum(["alert", "notify", "task"]).default("alert").describe("Qué acción ejecutar"),
    enabled: z.boolean().default(true).describe("Activar inmediatamente"),
  },
  async ({ name, description, trigger, action, enabled }) => {
    const rule = await (db as any).automationRule.create({
      data: { name, description, trigger, action, enabled },
    });
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ creado: true, id: rule.id, nombre: rule.name, trigger: rule.trigger, accion: rule.action }, null, 2),
      }],
    };
  }
);

server.tool(
  "obracero_automation_toggle",
  "Activa o desactiva una regla de automatización por ID.",
  {
    automationId: z.string().describe("ID de la regla"),
    enabled: z.boolean().describe("true para activar, false para desactivar"),
  },
  async ({ automationId, enabled }) => {
    const updated = await (db as any).automationRule.update({
      where: { id: automationId },
      data: { enabled },
    });
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ ok: true, id: updated.id, nombre: updated.name, activo: updated.enabled }, null, 2),
      }],
    };
  }
);

// ═══════════════════════════════════════════════
// SCHEDULER TOOLS — Jobs programados
// ═══════════════════════════════════════════════

server.tool(
  "obracero_scheduler_run",
  "Ejecuta el scheduler: verifica todos los jobs programados (AgentSchedule) y ejecuta los que correspondan. Retorna resultados de cada job.",
  {},
  async () => {
    const results = await checkSchedules();
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          jobsEjecutados: results.length,
          resultados: results.map((r: any) => ({
            scheduleId: r.scheduleId,
            nombre: r.name,
            tipo: r.type,
            resultado: r.result || r.error,
          })),
        }, null, 2),
      }],
    };
  }
);

server.tool(
  "obracero_scheduler_list",
  "Lista todos los jobs programados (AgentSchedule) con su cron, estado y última ejecución.",
  {},
  async () => {
    const schedules = await (db as any).agentSchedule.findMany({ orderBy: { createdAt: "asc" } });
    return {
      content: [{
        type: "text",
        text: JSON.stringify(schedules.map((s: any) => ({
          id: s.id,
          nombre: s.name,
          tipo: s.type,
          cron: s.cron,
          activo: s.enabled,
          ultimaEjecucion: s.lastRun,
          proximaEjecucion: s.nextRun,
        })), null, 2),
      }],
    };
  }
);

server.tool(
  "obracero_scheduler_create",
  "Crea un job programado nuevo con expresión cron. Tipos: check_alerts (revisar alertas), run_workflow (ejecutar un workflow por ID), analyze (análisis predictivo).",
  {
    name: z.string().describe("Nombre del job"),
    type: z.enum(["check_alerts", "run_workflow", "analyze"]).describe("Tipo de job"),
    cron: z.string().describe('Expresión cron (ej: "0 7 * * *" = todos los días 7am, "*/30 * * * *" = cada 30 min)'),
    config: z.record(z.any()).optional().describe("Config específica: { workflowId } para run_workflow"),
    enabled: z.boolean().default(true),
  },
  async ({ name, type, cron, config, enabled }) => {
    const schedule = await (db as any).agentSchedule.create({
      data: {
        name,
        type,
        cron,
        config: JSON.stringify(config || {}),
        enabled,
      },
    });
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ creado: true, id: schedule.id, nombre: schedule.name, cron: schedule.cron }, null, 2),
      }],
    };
  }
);

server.tool(
  "obracero_scheduler_toggle",
  "Activa o desactiva un job programado por ID.",
  {
    scheduleId: z.string(),
    enabled: z.boolean(),
  },
  async ({ scheduleId, enabled }) => {
    const updated = await (db as any).agentSchedule.update({
      where: { id: scheduleId },
      data: { enabled },
    });
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ ok: true, id: updated.id, nombre: updated.name, activo: updated.enabled }, null, 2),
      }],
    };
  }
);

// ═══════════════════════════════════════════════
// DB QUERY — Consultas read-only seguras
// ═══════════════════════════════════════════════

server.tool(
  "obracero_db_query",
  "Ejecuta consultas SQL SELECT en la base de datos de ObraCero (solo lectura, con límite automático). Usa esto para investigar datos, generar reportes personalizados o diagnosticar problemas.",
  {
    query: z.string().describe("SQL SELECT (solo lectura). Modelos: Project, Transaction, Task, Supplier, Material, StockMovement, Workflow, WorkflowStep, WorkflowExecution, AgentSchedule, AgentAction, AgentMessage, AutomationRule"),
    params: z.array(z.any()).optional().describe("Parámetros para consulta preparada (opcional)"),
    limit: z.number().default(50).max(200).describe("Límite de filas (máx 200)"),
  },
  async ({ query, params, limit }) => {
    const trimmed = query.trim();
    if (!/^select/i.test(trimmed)) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Solo se permiten consultas SELECT (read-only)" }) }] };
    }
    // Inyectar LIMIT si no tiene
    const finalQuery = /limit\s+\d+/i.test(trimmed) ? trimmed : `${trimmed} LIMIT ${limit}`;

    try {
      const rows = await (db as any).$queryRawUnsafe(finalQuery, ...(params || []));
      // Convertir fechas y BigInts a strings para JSON
      const safe = JSON.parse(JSON.stringify(rows, (_, v) =>
        typeof v === "bigint" ? String(v)
        : v instanceof Date ? v.toISOString()
        : v
      ));
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ filas: Array.isArray(safe) ? safe.length : 1, datos: safe }, null, 2),
        }],
      };
    } catch (e: any) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Error DB: ${e.message}`, query: finalQuery }) }] };
    }
  }
);

// ═══════════════════════════════════════════════
// ALERTAS / ACCIONES DEL AGENTE
// ═══════════════════════════════════════════════

server.tool(
  "obracero_alerts_list",
  "Lista las alertas activas generadas por el agente (AgentAction). Son alertas, tareas sugeridas, pedidos de reposición, etc.",
  {
    limit: z.number().default(20).describe("Cantidad máxima"),
    severity: z.enum(["info", "warning", "critical"]).optional().describe("Filtrar por severidad"),
  },
  async ({ limit, severity }) => {
    const where: any = { status: "active" };
    if (severity) where.severity = severity;

    const actions = await (db as any).agentAction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify(actions.map((a: any) => ({
          id: a.id,
          tipo: a.type,
          severidad: a.severity,
          titulo: a.title,
          descripcion: a.description,
          estado: a.status,
          creada: a.createdAt,
        })), null, 2),
      }],
    };
  }
);

server.tool(
  "obracero_alerts_resolve",
  "Marca alertas como resueltas o descartadas (por ID o array de IDs).",
  {
    ids: z.array(z.string()).describe("Array de IDs de alertas a resolver"),
  },
  async ({ ids }) => {
    const result = await (db as any).agentAction.updateMany({
      where: { id: { in: ids } },
      data: { status: "resolved" },
    });
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ resueltas: result.count, ids }, null, 2),
      }],
    };
  }
);

// ═══════════════════════════════════════════════
// PROYECTOS / OBRAS — Quick lookup
// ═══════════════════════════════════════════════

server.tool(
  "obracero_projects_list",
  "Lista todas las obras/proyectos con KPIs: presupuesto, gastado, ingresos, margen, progreso, estado.",
  {
    status: z.string().optional().describe("Filtrar: planning | in_progress | paused | finished | cancelled"),
    limit: z.number().default(20).describe("Máx resultados"),
  },
  async ({ status, limit }) => {
    const where: any = {};
    if (status) where.status = status;

    const projects = await (db as any).project.findMany({
      where,
      take: Math.min(limit, 50),
      orderBy: { updatedAt: "desc" },
      include: {
        transactions: { select: { type: true, amount: true } },
        tasks: { where: { status: { not: "completed" } }, select: { id: true } },
      },
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify(projects.map((p: any) => {
          const income = p.transactions.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + t.amount, 0);
          const spent = p.transactions.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0);
          const profit = income - spent;
          const margin = income > 0 ? ((profit / income) * 100).toFixed(1) : "0";
          return {
            id: p.id,
            codigo: p.code,
            nombre: p.name,
            estado: p.status,
            progreso: p.progress,
            presupuesto: p.budget,
            gastado: spent,
            ingresos: income,
            ganancia: profit,
            margen: `${margin}%`,
            tareasPendientes: p.tasks.length,
            cliente: p.clientName,
          };
        }), null, 2),
      }],
    };
  }
);

// ═══════════════════════════════════════════════
// MATERIALES / INVENTARIO
// ═══════════════════════════════════════════════

server.tool(
  "obracero_inventory_status",
  "Estado completo del inventario: materiales, stock actual, valor total, alertas de stock bajo, rotación.",
  {},
  async () => {
    const materials = await (db as any).material.findMany({
      orderBy: { stock: "asc" },
      include: { supplier: { select: { name: true } } },
    });

    const totalValue = materials.reduce((s: number, m: any) => s + m.stock * m.unitCost, 0);
    const lowStock = materials.filter((m: any) => m.stock <= m.minStock && m.minStock > 0);
    const outOfStock = materials.filter((m: any) => m.stock <= 0);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          totalMateriales: materials.length,
          valorTotalInventario: totalValue,
          stockBajo: lowStock.length,
          sinStock: outOfStock.length,
          materiales: materials.map((m: any) => ({
            sku: m.sku,
            nombre: m.name,
            stock: m.stock,
            unidad: m.unit,
            costoUnitario: m.unitCost,
            valorTotal: m.stock * m.unitCost,
            stockMinimo: m.minStock,
            proveedor: m.supplier?.name || "sin proveedor",
            estado: m.stock <= 0 ? "SIN_STOCK" : m.stock <= m.minStock ? "BAJO" : "OK",
          })),
        }, null, 2),
      }],
    };
  }
);

// ═══════════════════════════════════════════════
// CONVERSATION HISTORY
// ═══════════════════════════════════════════════

server.tool(
  "obracero_conversation_history",
  "Obtiene el historial de conversación del agente (últimos N mensajes).",
  {
    limit: z.number().default(20).describe("Cantidad de mensajes"),
  },
  async ({ limit }) => {
    const messages = await (db as any).agentMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify(messages.reverse().map((m: any) => ({
          rol: m.role,
          contenido: m.content.slice(0, 500),
          intencion: m.intent,
          fecha: m.createdAt,
        })), null, 2),
      }],
    };
  }
);

// ═══════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[${SERVER_NAME}] v${SERVER_VERSION} corriendo en stdio — ${new Date().toISOString()}`);
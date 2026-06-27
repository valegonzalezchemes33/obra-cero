#!/usr/bin/env node
// ============================================================
// ObraCero MCP BRIDGE — Cliente HTTP al endpoint /api/agent
// ============================================================
// Conecta ObraCero con Hermes Agent (u otro cliente MCP) exponiendo
// las tools nativas del agente. En vez de re-implementar la lógica
// del agente, este bridge hace HTTP requests a la app Next.js.
//
// Configurar con variables de entorno:
//   OBRACERO_BASE_URL   — URL base (default: http://localhost:3000)
//   OBRACERO_API_TOKEN  — opcional, para auth futura
// ============================================================

// @ts-ignore — el SDK MCP se instala por separado vía `npm install`
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// @ts-ignore
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.OBRACERO_BASE_URL || "http://localhost:3000";
const SERVER_NAME = "ObraCero Bridge";
const SERVER_VERSION = "1.1.0";

// ─── HTTP CLIENT ───

type ToolCallBody = Record<string, any>;

interface ToolExecResult {
  ok: boolean;
  tool?: string;
  riskLevel?: string;
  requiresConfirmation?: boolean;
  response?: {
    text: string;
    intent: string;
    data?: any;
    suggestions?: string[];
  };
  errors?: string[];
}

async function callApi(path: string, body?: ToolCallBody): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function executeTool(tool: string, args: Record<string, any>, rawText?: string): Promise<ToolExecResult> {
  return callApi("/api/agent/tools/execute", { tool, args, rawText });
}

// Helper para presentar resultados como contenido MCP text
function textResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

function errorResult(message: string, extra?: any) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: message, ...(extra || {}) }, null, 2),
      },
    ],
    isError: true,
  };
}

// ─── MCP SERVER ───

const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

// ═══════════════════════════════════════════════
// AGENT TOOLS — Chat, Acciones, Memoria, RAG
// ═══════════════════════════════════════════════

server.tool(
  "obracero_agent_chat",
  "Chatea con el agente interno de ObraCero (NLU + Groq + memoria + RAG + 45+ intenciones). Responde en español argentino con formato profesional. Útil para consultas, análisis, KPIs, anomalías y recomendaciones.",
  {
    message: z.string().describe("Mensaje del usuario en español"),
    projectId: z.string().optional().describe("ID de obra opcional para contexto"),
  },
  async ({ message, projectId }) => {
    try {
      const data = await callApi("/api/agent", {
        rawText: message,
        message,
      } as any);
      return textResult({
        respuesta: data.text,
        intencion: data.intent,
        datos: data.data,
        sugerencias: data.suggestions,
        metadata: {
          groqEnhanced: data._groqEnhanced,
          groqIntent: data._groqIntent,
          tool: data._tool,
          riskLevel: data._riskLevel,
        },
        projectIdRelacionado: projectId || null,
      });
    } catch (e: any) {
      return errorResult(e.message, { hint: `Verificar que Next.js esté corriendo en ${BASE_URL}` });
    }
  }
);

server.tool(
  "obracero_agent_parse",
  "Analiza un texto y devuelve la intención detectada + entidades extraídas (sin ejecutar nada). Útil para previsualizar cómo el agente interpreta un comando antes de ejecutarlo.",
  {
    text: z.string().describe("Texto a analizar"),
  },
  async ({ text }) => {
    try {
      const data = await callApi("/api/agent", { message: text, rawText: text } as any);
      return textResult({
        intencion: data.intent,
        confianza: data._groqConfidence,
        entidades: data._groqEntities,
        entidadesLocales: data.entities,
        respuesta: data.text,
      });
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "obracero_agent_memory_context",
  "Obtiene el contexto conversacional activo (última obra, material, intent). Útil para resolver pronombres en mensajes multi-turno.",
  {},
  async () => {
    try {
      const data = await callApi("/api/agent/conversation");
      return textResult({
        mensajes: Array.isArray(data) ? data.slice(-10) : data,
      });
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "obracero_agent_rag",
  "Consulta la base de conocimiento RAG del agente (TF-IDF + cosine sobre historial). Devuelve respuestas similares encontradas en conversaciones previas.",
  {
    query: z.string().describe("Consulta para búsqueda semántica"),
    topK: z.number().min(1).max(20).optional().describe("Cantidad de resultados (1-20)"),
  },
  async ({ query, topK }) => {
    try {
      const data = await callApi("/api/agent", { message: query, rawText: query } as any);
      return textResult({
        consulta: query,
        resultados: data.data?.ragResults || [],
        respuesta: data.text,
      });
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "obracero_agent_predictive",
  "Detecta patrones recurrentes en el sistema y genera sugerencias de automatizaciones / workflows.",
  {},
  async () => {
    try {
      const data = await callApi("/api/agent", { message: "detectá patrones", rawText: "detectá patrones" } as any);
      return textResult({
        sugerencias: data.data?.suggestions || [],
        sugerenciasTexto: data.data?.predictions || data.text,
      });
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

// ═══════════════════════════════════════════════
// TOOL REGISTRY — Catálogo y ejecución genérica
// ═══════════════════════════════════════════════

server.tool(
  "obracero_tools_list",
  "Lista todas las tools disponibles en el registro del agente (24 tools tipadas con Zod schemas).",
  {},
  async () => {
    try {
      const data = await callApi("/api/agent/tools");
      return textResult(data);
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "obracero_tools_execute",
  "Ejecuta una tool registrada por nombre y argumentos. Retorna ok/errors/riskLevel. Pensado para tool-calling nativo desde clientes LLM externos.",
  {
    tool: z.string().describe("Nombre de la tool (ej: 'create_expense', 'update_project_progress', 'export_data')"),
    args: z.record(z.string(), z.any()).describe("Argumentos validados por el Zod schema de la tool"),
  },
  async ({ tool, args }) => {
    try {
      const result = await executeTool(tool, args);
      if (!result.ok) {
        return errorResult(`Tool '${tool}' falló`, {
          validationErrors: result.errors,
          riskLevel: result.riskLevel,
        });
      }
      return textResult({
        ok: true,
        tool: result.tool,
        riskLevel: result.riskLevel,
        requiresConfirmation: result.requiresConfirmation,
        respuesta: result.response?.text,
        intencion: result.response?.intent,
        datos: result.response?.data,
        sugerencias: result.response?.suggestions,
      });
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

// ═══════════════════════════════════════════════
// WORKFLOW TOOLS — Ejecutar, listar, gestionar
// ═══════════════════════════════════════════════

server.tool(
  "obracero_workflow_execute",
  "Ejecuta un workflow manual o por trigger.",
  {
    workflowId: z.string().describe("ID del workflow"),
    variables: z.record(z.string(), z.any()).optional(),
  },
  async ({ workflowId, variables }) => {
    try {
      const data = await callApi("/api/workflows/execute", {
        workflowId,
        variables: variables || {},
      });
      return textResult(data);
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "obracero_workflow_create_from_text",
  "Crea un workflow desde lenguaje natural. Ej: 'cuando el stock de cemento baje de 50, creame una tarea: reponer'.",
  {
    text: z.string().describe("Descripción del workflow en lenguaje natural"),
  },
  async ({ text }) => {
    try {
      const data = await callApi("/api/workflows", {
        method: "POST",
        text,
      } as any);
      return textResult(data);
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "obracero_workflow_list",
  "Lista todos los workflows del sistema (con steps y última ejecución).",
  {
    enabledOnly: z.boolean().optional(),
    trigger: z.string().optional(),
    limit: z.number().min(1).max(100).optional(),
  },
  async ({ enabledOnly, trigger, limit }) => {
    try {
      const params = new URLSearchParams();
      if (enabledOnly !== undefined) params.set("enabled", String(enabledOnly));
      if (trigger) params.set("trigger", trigger);
      if (limit) params.set("limit", String(limit));
      const query = params.toString();
      const data = await callApi(`/api/workflows${query ? `?${query}` : ""}`);
      return textResult(data);
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "obracero_workflow_executions",
  "Lista las ejecuciones recientes de un workflow o todas.",
  {
    workflowId: z.string().optional(),
    limit: z.number().optional(),
  },
  async ({ workflowId, limit }) => {
    try {
      const params = new URLSearchParams();
      if (workflowId) params.set("workflowId", workflowId);
      if (limit) params.set("limit", String(limit));
      const query = params.toString();
      const data = await callApi(`/api/workflows/executions${query ? `?${query}` : ""}`);
      return textResult(data);
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "obracero_workflow_delete",
  "Elimina un workflow (irreversible).",
  {
    workflowId: z.string(),
  },
  async ({ workflowId }) => {
    try {
      const data = await callApi(`/api/workflows?id=${workflowId}`, undefined);
      return textResult(data);
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

// ═══════════════════════════════════════════════
// SCHEDULER TOOLS — Agente autónomo
// ═══════════════════════════════════════════════

server.tool(
  "obracero_scheduler_list",
  "Lista los jobs programados (cron, scheduler del agente autónomo).",
  {},
  async () => {
    try {
      const data = await callApi("/api/scheduler");
      return textResult(data);
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "obracero_scheduler_run",
  "Ejecuta manualmente el scheduler (corre jobs según su próximo cron).",
  {},
  async () => {
    try {
      const data = await callApi("/api/scheduler/run", {});
      return textResult(data);
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

// ═══════════════════════════════════════════════
// AUTOMATIONS TOOLS — Reglas legacy
// ═══════════════════════════════════════════════

server.tool(
  "obracero_automation_list",
  "Lista las reglas de automatización legacy.",
  {},
  async () => {
    try {
      const data = await callApi("/api/automations");
      return textResult(data);
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "obracero_automation_run",
  "Ejecuta el motor de automatizaciones y devuelve alertas activas.",
  {},
  async () => {
    try {
      const data = await callApi("/api/automations/run", {});
      return textResult(data);
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

// ═══════════════════════════════════════════════
// ALERTS & READ-ONLY QUERIES
// ═══════════════════════════════════════════════

server.tool(
  "obracero_alerts_list",
  "Lista alertas activas del agente.",
  {},
  async () => {
    try {
      const data = await callApi("/api/agent/actions");
      return textResult(data);
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "obracero_alerts_resolve",
  "Marca una alerta como resuelta.",
  {
    ids: z.array(z.string()).describe("IDs de alertas a resolver"),
  },
  async ({ ids }) => {
    try {
      const data = await callApi("/api/agent/actions", { ids });
      return textResult(data);
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "obracero_projects_list",
  "Lista obras con KPIs calculados (presupuesto, gastado, ingresos, ganancia, margen, tareas).",
  {},
  async () => {
    try {
      const data = await callApi("/api/projects");
      return textResult(data);
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "obracero_inventory_status",
  "Estado completo del inventario (valor total, stock bajo, sin stock, por material).",
  {},
  async () => {
    try {
      const data = await callApi("/api/materials");
      return textResult(data);
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "obracero_dashboard_summary",
  "Resumen del dashboard (KPIs, cashflow, gastos por categoría, insights).",
  {},
  async () => {
    try {
      const data = await callApi("/api/dashboard");
      return textResult(data);
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

server.tool(
  "obracero_conversation_history",
  "Historial reciente del chat con el agente.",
  {
    limit: z.number().min(1).max(200).optional(),
  },
  async ({ limit }) => {
    try {
      const q = limit ? `?limit=${limit}` : "";
      const data = await callApi(`/api/agent/conversation${q}`);
      return textResult(data);
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

// ═══════════════════════════════════════════════
// TOOL CALLING NATIVO — Permite que el LLM externo
// ejecute tools de ObraCero via OpenAI Function-Calling /
// Anthropic Tool-Use. Devuelve la lista + tool de execution.
// ═══════════════════════════════════════════════

server.tool(
  "obracero_llm_tool_call",
  "Invoca una tool de ObraCero desde un cliente LLM externo (compatible con OpenAI Function-Calling o Anthropic Tool-Use). Útil para tool-calling nativo multi-step.",
  {
    tool: z.string(),
    arguments: z.record(z.string(), z.any()),
  },
  async ({ tool, arguments: args }) => {
    try {
      const result = await executeTool(tool, args);
      return textResult(result);
    } catch (e: any) {
      return errorResult(e.message);
    }
  }
);

// ─── START MCP SERVER ───

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[obracero-bridge] Conectado. Base URL: ${BASE_URL}`);
}

main().catch((error) => {
  console.error("[obracero-bridge] Fatal:", error);
  process.exit(1);
});

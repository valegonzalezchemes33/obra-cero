// ============================================================
// TOOL EXECUTION — Bridge entre tool-calls y el motor del agente
// ============================================================
// Esta capa es el punto único de entrada para ejecutar tools
// desde cualquier origen: chat del agente, MCP bridge, workflows
// o futuros clientes LLM con tool-calling nativo.
// ============================================================

import {
  type ToolCall,
  type ToolContext,
  type RiskLevel,
  getRiskLevel,
  validateToolArgs,
  toolSchemas,
} from "./tool-registry";
import { type AgentResponse } from "./agent";
import {
  getToolDefinition,
  listToolDefinitions,
  type ExecutableTool,
} from "./tools/registry-definitions";

export interface ToolExecutionResult {
  ok: boolean;
  response: AgentResponse;
  tool: string;
  errors?: string[];
  riskLevel: RiskLevel;
  requiresConfirmation?: boolean;
  intent?: string;
}

// ─── Punto de entrada principal ───

export async function executeToolCall(
  call: ToolCall,
  ctx: ToolContext = {}
): Promise<ToolExecutionResult> {
  const { tool, args } = call;
  const context: ToolContext = {
    rawText: ctx.rawText ?? call.rawText,
    conversationContext: ctx.conversationContext,
  };

  // 1. Validar args con Zod
  const validation = validateToolArgs(tool, args);
  if (!validation.ok) {
    return {
      ok: false,
      tool,
      riskLevel: getRiskLevel(tool),
      errors: validation.errors,
      response: {
        text: `❌ Parámetros inválidos para **${tool}**:\n\n${validation.errors
          .map((e) => `• ${e}`)
          .join("\n")}`,
        intent: "unknown",
        suggestions: ["Ayuda"],
      },
    };
  }

  const riskLevel = getRiskLevel(tool);

  // 2. Resolver la definición de la tool y ejecutarla
  const definition = getToolDefinition(tool);
  if (!definition) {
    return {
      ok: false,
      tool,
      riskLevel,
      errors: [`No hay implementación registrada para la tool "${tool}".`],
      response: {
        text: `❌ La tool "${tool}" no está implementada todavía.`,
        intent: "unknown",
        suggestions: ["¿Cómo vamos?"],
      },
    };
  }

  try {
    const response = await definition.execute(validation.args, context);

    return {
      ok: true,
      tool,
      riskLevel,
      intent: definition.intent,
      requiresConfirmation: riskLevel === "destructive" || riskLevel === "moderate",
      response,
    };
  } catch (error: any) {
    return {
      ok: false,
      tool,
      riskLevel,
      errors: [error.message || "Error al ejecutar la tool"],
      response: {
        text: `❌ Error ejecutando **${tool}**: ${error.message || "Error desconocido"}`,
        intent: "unknown",
        suggestions: ["Ayuda"],
      },
    };
  }
}

// ─── Helpers para integración ───

/**
 * Ejecuta una tool desde un intent Groq ya resuelto.
 */
export async function executeToolFromIntent(
  intent: string,
  entities: Record<string, any>,
  rawText: string
): Promise<ToolExecutionResult | null> {
  const { intentToTool } = await import("./tool-registry");
  const tool = intentToTool[intent as keyof typeof intentToTool];
  if (!tool) return null;
  return executeToolCall({ tool, args: entities, rawText });
}

/**
 * Lista herramientas con definición ejecutable (no todas las registradas tienen implementación).
 */
export function listExecutableTools() {
  return listToolDefinitions();
}

/**
 * Lista completa del registry (incluye tools sin implementación).
 */
export function listAllRegisteredTools(): Array<{
  tool: string;
  riskLevel: RiskLevel;
  hasImplementation: boolean;
}> {
  return Object.keys(toolSchemas).map((toolName) => {
    const def = getToolDefinition(toolName as any);
    return {
      tool: toolName,
      riskLevel: getRiskLevel(toolName as any),
      hasImplementation: Boolean(def),
    };
  });
}

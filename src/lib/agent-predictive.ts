// ============================================================
// AUTOMATIZACIÓN PREDICTIVA
// Detecta patrones en el uso del sistema y sugiere
// workflows automáticos antes de que el usuario los pida.
// ============================================================

import { db } from "@/lib/db";
import { normalize } from "./agent";
import type { AgentResponse } from "./agent";

// ─── Patrones predefinidos que buscamos ───

interface PatternDefinition {
  id: string;
  name: string;
  description: string;
  detect: () => Promise<{ detected: boolean; confidence: number; details: string }>;
  generateWorkflowName: () => string;
  generateWorkflowDescription: () => string;
  generateSteps: () => any[];
}

const PATTERNS: PatternDefinition[] = [
  {
    id: "frequent_low_stock_query",
    name: "Consultas frecuentes de stock bajo",
    description: "Preguntás seguido por materiales que faltan. Podemos automatizar una alerta cuando el stock baje del mínimo.",
    detect: async () => {
      const recentMessages = await db.agentMessage.findMany({
        where: { role: "user", content: { contains: "stock" } },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      const stockQueries = recentMessages.filter(m =>
        /stock\s+bajo|materiales?\s+falt|reponer|qu[eé]\s+falta/i.test(m.content)
      ).length;
      return {
        detected: stockQueries >= 3,
        confidence: Math.min(0.95, 0.3 + stockQueries * 0.15),
        details: `${stockQueries} consultas de stock bajo en los últimos mensajes`,
      };
    },
    generateWorkflowName: () => "📦 Alerta automática de stock bajo",
    generateWorkflowDescription: () => "Creado automáticamente por el asistente — detectamos que consultás seguido por stock bajo.",
    generateSteps: () => [
      { type: "action_send_alert", label: "Notificar stock bajo", config: { title: "⚠️ Stock bajo detectado", description: "Revisá los materiales que están por debajo del mínimo.", severity: "warning" } },
      { type: "action_create_task", label: "Tarea de reposición", config: { title: "Reponer materiales con stock bajo", priority: "high", dueDays: 2 } },
    ],
  },
  {
    id: "frequent_expense_query",
    name: "Consultas frecuentes de gastos",
    description: "Preguntás mucho por los gastos. Podemos programar un resumen semanal automático.",
    detect: async () => {
      const recentMessages = await db.agentMessage.findMany({
        where: { role: "user", content: { contains: "gasto" } },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      const expenseQueries = recentMessages.filter(m =>
        /gastos?|egresos?|en qu[eé]\s+gast[eé]/i.test(m.content)
      ).length;
      return {
        detected: expenseQueries >= 3,
        confidence: Math.min(0.95, 0.3 + expenseQueries * 0.15),
        details: `${expenseQueries} consultas sobre gastos en los últimos mensajes`,
      };
    },
    generateWorkflowName: () => "📊 Resumen semanal de gastos",
    generateWorkflowDescription: () => "Creado automáticamente por el asistente — detectamos que consultás seguido por gastos.",
    generateSteps: () => [
      { type: "action_send_alert", label: "Resumen semanal", config: { title: "📊 Resumen semanal de gastos", description: "Revisión automática del estado financiero de la semana.", severity: "info" } },
    ],
  },
  {
    id: "frequent_project_query",
    name: "Consultas frecuentes de obras",
    description: "Seguís de cerca el estado de las obras. Podemos enviar un reporte diario automático.",
    detect: async () => {
      const recentMessages = await db.agentMessage.findMany({
        where: { role: "user", content: { contains: "obra" } },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      const projectQueries = recentMessages.filter(m =>
        /obras?|proyectos?|c[oó]mo van/i.test(m.content)
      ).length;
      return {
        detected: projectQueries >= 3,
        confidence: Math.min(0.95, 0.3 + projectQueries * 0.15),
        details: `${projectQueries} consultas sobre obras en los últimos mensajes`,
      };
    },
    generateWorkflowName: () => "🏗️ Reporte diario de obras",
    generateWorkflowDescription: () => "Creado automáticamente por el asistente — detectamos que consultás seguido por el estado de las obras.",
    generateSteps: () => [
      { type: "action_send_alert", label: "Reporte de obras", config: { title: "🏗️ Estado de obras del día", description: "Resumen automático del avance y alertas de las obras activas.", severity: "info" } },
    ],
  },
  {
    id: "frequent_overdue_tasks",
    name: "Tareas atrasadas recurrentes",
    description: "Suelen acumularse tareas sin completar. Podemos crear un workflow que escale las tareas atrasadas automáticamente.",
    detect: async () => {
      const overdueTasks = await db.task.count({
        where: { status: { in: ["pending", "in_progress"] }, dueDate: { lt: new Date() } },
      });
      return {
        detected: overdueTasks >= 3,
        confidence: Math.min(0.95, 0.3 + overdueTasks * 0.1),
        details: `${overdueTasks} tareas atrasadas actualmente`,
      };
    },
    generateWorkflowName: () => "⏰ Escalado automático de tareas atrasadas",
    generateWorkflowDescription: () => "Creado automáticamente por el asistente — hay tareas que se acumulan sin resolver.",
    generateSteps: () => [
      { type: "condition", label: "¿Hay tareas atrasadas?", config: { field: "overdueTasks", operator: "gt", value: 0 } },
      { type: "action_send_alert", label: "Alertar tareas atrasadas", config: { title: "⏰ Tareas atrasadas detectadas", description: "Revisar y reasignar las tareas vencidas.", severity: "warning" } },
    ],
  },
];

// ─── Resultado de la detección ───

export interface PredictiveSuggestion {
  patternId: string;
  name: string;
  description: string;
  confidence: number;
  details: string;
  workflowName: string;
  workflowDescription: string;
  steps: any[];
}

// ─── Detectar patrones ───

export async function detectPatterns(): Promise<PredictiveSuggestion[]> {
  const results: PredictiveSuggestion[] = [];

  for (const pattern of PATTERNS) {
    try {
      const detection = await pattern.detect();
      if (detection.detected && detection.confidence >= 0.4) {
        results.push({
          patternId: pattern.id,
          name: pattern.name,
          description: pattern.description,
          confidence: detection.confidence,
          details: detection.details,
          workflowName: pattern.generateWorkflowName(),
          workflowDescription: pattern.generateWorkflowDescription(),
          steps: pattern.generateSteps(),
        });
      }
    } catch {
      // Ignorar errores de detección
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

// ─── Crear workflow a partir de una sugerencia ───

export async function createWorkflowFromSuggestion(suggestion: PredictiveSuggestion): Promise<boolean> {
  try {
    const { getTenantSafe } = await import("@/lib/tenant");
    const orgId = (await getTenantSafe())?.organizationId ?? "default";

    const workflow = await db.workflow.create({
      data: {
        name: suggestion.workflowName,
        description: suggestion.workflowDescription,
        trigger: "manual",
        enabled: true,
        organizationId: orgId,
      },
    });

    for (let i = 0; i < suggestion.steps.length; i++) {
      const step = suggestion.steps[i];
      await db.workflowStep.create({
        data: {
          workflowId: workflow.id,
          type: step.type,
          label: step.label || null,
          config: JSON.stringify(step),
          order: (i + 1) * 10,
        },
      });
    }

    return true;
  } catch {
    return false;
  }
}

// ─── Generar respuesta con sugerencias predictivas ───

export function generatePredictiveResponse(suggestions: PredictiveSuggestion[]): AgentResponse {
  if (suggestions.length === 0) {
    return {
      text: `Analicé tu historial de uso y no encontré patrones para automatizar todavía. Seguí usando el sistema y vuelvo a revisar más adelante.`,
      intent: "unknown",
      suggestions: ["¿Cómo vamos?", "Recomendaciones"],
    };
  }

  const suggestionsText = suggestions
    .map(
      (s, i) =>
        `${i + 1}. **${s.name}**\n   ${s.description}\n   *(confianza: ${Math.round(s.confidence * 100)}%)*`
    )
    .join("\n\n");

  return {
    text: `🤖 **Analicé tu historial y encontré patrones que podríamos automatizar:**\n\n${suggestionsText}\n\n**¿Querés que cree alguno de estos workflows automáticos?**\n\nRespondé con el número (ej: *"1"*) o *"no, gracias"*.`,
    intent: "unknown",
    data: { suggestions },
    suggestions: suggestions.map((s, i) => `Crear workflow ${i + 1}: ${s.name}`).concat(["No, gracias"]),
  };
}

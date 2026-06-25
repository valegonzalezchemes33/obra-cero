// ============================================================
// TIPOS DEL SISTEMA DE WORKFLOWS / AUTOMATIZACIONES
// ============================================================

import type { Workflow, WorkflowStep, WorkflowExecution, AgentSchedule } from "@prisma/client";

// ─── Tipos de disparador ───

export type WorkflowTrigger =
  | "manual"
  | "schedule"
  | "event_low_stock"
  | "event_budget_overrun"
  | "event_expense_spike"
  | "event_late_task"
  | "event_new_project"
  | "event_new_transaction"
  | "event_new_material"
  | "webhook";

// ─── Tipos de paso ───

export type StepType =
  | "condition"
  | "action_create_task"
  | "action_send_alert"
  | "action_create_expense"
  | "action_create_income"
  | "action_create_project"
  | "action_create_supplier"
  | "action_update_project_progress"
  | "action_update_project_status"
  | "action_add_materials"
  | "action_add_stock_movement"
  | "action_reorder"
  | "action_close_project"
  | "action_complete_task"
  | "action_update_stock"
  | "action_send_email"
  | "action_webhook"
  | "action_run_workflow"
  | "delay"
  | "loop"
  | "end";

// ─── Configuración de cada paso ───

export interface ConditionConfig {
  field: string; // ej: "stock.totalValue", "projects[0].margin", "transactions.length"
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "is_empty" | "not_empty";
  value: any;
  thenSteps?: WorkflowStepConfig[];
  elseSteps?: WorkflowStepConfig[];
}

export interface ActionCreateTaskConfig {
  title: string; // puede incluir {{variables}}
  description?: string;
  priority?: "low" | "medium" | "high" | "critical";
  assignee?: string;
  dueDays?: number; // días desde hoy
  projectRef?: string;
}

export interface ActionSendAlertConfig {
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
}

export interface ActionCreateTransactionConfig {
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number; // o expresión
  projectRef?: string;
  supplierRef?: string;
}

export interface ActionCreateProjectConfig {
  name: string;
  budget?: number;
  clientName?: string;
}

export interface ActionCreateSupplierConfig {
  name: string;
  phone?: string;
  email?: string;
  category?: string;
}

export interface ActionUpdateProjectProgressConfig {
  projectRef: string;
  progress: number;
}

export interface ActionUpdateProjectStatusConfig {
  projectRef: string;
  status: string;
}

export interface ActionAddMaterialsConfig {
  items: { name: string; qty: number; unit?: string }[];
  projectRef?: string;
}

export interface ActionReorderConfig {
  useLowStock: boolean;
  customItems?: { materialRef: string; qty: number }[];
}

export interface ActionSendEmailConfig {
  to: string;
  subject: string;
  body: string;
}

export interface ActionWebhookConfig {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH";
  headers?: Record<string, string>;
  body?: any;
}

export interface ActionRunWorkflowConfig {
  workflowId: string;
}

export interface DelayConfig {
  unit: "minutes" | "hours" | "days";
  value: number;
}

export interface LoopConfig {
  type: "for_each" | "while" | "repeat";
  dataSource?: string; // ej: "materials.lowStock", "projects"
  maxIterations?: number;
  steps?: WorkflowStepConfig[];
}

// ─── Configuración unificada de step ───

export interface WorkflowStepConfig {
  id?: string;
  type: StepType;
  label?: string;
  config:
    | ConditionConfig
    | ActionCreateTaskConfig
    | ActionSendAlertConfig
    | ActionCreateTransactionConfig
    | ActionCreateProjectConfig
    | ActionCreateSupplierConfig
    | ActionUpdateProjectProgressConfig
    | ActionUpdateProjectStatusConfig
    | ActionAddMaterialsConfig
    | ActionReorderConfig
    | ActionSendEmailConfig
    | ActionWebhookConfig
    | ActionRunWorkflowConfig
    | DelayConfig
    | LoopConfig
    | Record<string, any>;
}

// ─── Trigger config ───

export interface TriggerConfig {
  type: WorkflowTrigger;
  cron?: string; // para schedule: "*/5 * * * *"
  eventType?: string;
  webhookUrl?: string;
  params?: Record<string, any>;
}

// ─── Workflow completo (extendido para UI) ───

export interface WorkflowWithSteps extends Workflow {
  steps: WorkflowStepWithParsed[];
}

export interface WorkflowStepWithParsed extends WorkflowStep {
  parsedConfig: WorkflowStepConfig;
}

// ─── Execution log ───

export interface ExecutionLogEntry {
  stepId: string;
  stepLabel?: string;
  stepType: string;
  status: "running" | "completed" | "failed" | "skipped";
  startedAt: string;
  completedAt?: string;
  data?: any;
  error?: string;
}

// ─── Contexto de ejecución ───

export interface ExecutionContext {
  workflowId: string;
  executionId: string;
  triggeredBy: string;
  variables: Record<string, any>;
  logs: ExecutionLogEntry[];
}

// ─── Workflow template ───

export interface WorkflowTemplate {
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  triggerConfig?: Partial<TriggerConfig>;
  steps: WorkflowStepConfig[];
}

// ─── Schedule check result ───

export interface ScheduleCheckResult {
  scheduleId: string;
  scheduleName: string;
  triggered: boolean;
  result?: string;
}

// ─── Workflow step type definitions for the visual builder ───

export const STEP_TYPE_META: Record<StepType, { label: string; icon: string; color: string; group: string }> = {
  condition: { label: "Condición", icon: "git-branch", color: "text-purple-500", group: "Lógica" },
  action_create_task: { label: "Crear tarea", icon: "list-checks", color: "text-blue-500", group: "Acciones" },
  action_send_alert: { label: "Enviar alerta", icon: "alert-triangle", color: "text-amber-500", group: "Acciones" },
  action_create_expense: { label: "Registrar gasto", icon: "trending-down", color: "text-red-500", group: "Finanzas" },
  action_create_income: { label: "Registrar ingreso", icon: "trending-up", color: "text-green-500", group: "Finanzas" },
  action_create_project: { label: "Crear obra", icon: "building-2", color: "text-indigo-500", group: "Obras" },
  action_create_supplier: { label: "Crear proveedor", icon: "truck", color: "text-orange-500", group: "Proveedores" },
  action_update_project_progress: { label: "Actualizar avance", icon: "percent", color: "text-indigo-500", group: "Obras" },
  action_update_project_status: { label: "Cambiar estado obra", icon: "refresh-cw", color: "text-indigo-500", group: "Obras" },
  action_add_materials: { label: "Agregar materiales", icon: "package", color: "text-cyan-500", group: "Inventario" },
  action_add_stock_movement: { label: "Mov. de stock", icon: "arrow-right-left", color: "text-cyan-500", group: "Inventario" },
  action_reorder: { label: "Generar pedido", icon: "shopping-cart", color: "text-cyan-500", group: "Inventario" },
  action_close_project: { label: "Cerrar obra", icon: "check-circle", color: "text-indigo-500", group: "Obras" },
  action_complete_task: { label: "Completar tarea", icon: "check-check", color: "text-blue-500", group: "Tareas" },
  action_update_stock: { label: "Actualizar stock", icon: "package-open", color: "text-cyan-500", group: "Inventario" },
  action_send_email: { label: "Enviar email", icon: "mail", color: "text-pink-500", group: "Comunicación" },
  action_webhook: { label: "Webhook", icon: "globe", color: "text-slate-500", group: "Integraciones" },
  action_run_workflow: { label: "Ejecutar workflow", icon: "workflow", color: "text-violet-500", group: "Workflows" },
  delay: { label: "Esperar", icon: "clock", color: "text-yellow-500", group: "Control" },
  loop: { label: "Repetir", icon: "repeat", color: "text-purple-500", group: "Control" },
  end: { label: "Finalizar", icon: "stop-circle", color: "text-red-500", group: "Control" },
};

// ─── Workflow templates predefinidos ───

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    name: "Stock bajo → Alerta + Tarea de reposición",
    description: "Cuando un material cae bajo el mínimo, envía alerta y crea tarea de reposición automática",
    trigger: "event_low_stock",
    steps: [
      {
        type: "action_send_alert",
        label: "Notificar stock bajo",
        config: {
          title: "⚠️ Stock bajo detectado",
          description: "El material {{material.name}} tiene {{material.stock}} {{material.unit}} (mín: {{material.minStock}})",
          severity: "warning",
        } as ActionSendAlertConfig,
      },
      {
        type: "action_create_task",
        label: "Crear tarea de reposición",
        config: {
          title: "Reponer {{material.name}} - stock bajo",
          description: "Stock actual: {{material.stock}} {{material.unit}}. Mínimo: {{material.minStock}}. Generar pedido urgente.",
          priority: "high",
          assignee: "Compras",
          dueDays: 2,
        } as ActionCreateTaskConfig,
      },
    ],
  },
  {
    name: "Obra sin presupuesto → Alerta crítica",
    description: "Cuando una obra supera el 85% del presupuesto sin estar terminada, alerta y programa revisión",
    trigger: "event_budget_overrun",
    steps: [
      {
        type: "condition",
        label: "¿Superó el 85%?",
        config: {
          field: "project.budgetPct",
          operator: "gte",
          value: 85,
        } as ConditionConfig,
      },
      {
        type: "action_send_alert",
        label: "Alerta de presupuesto",
        config: {
          title: "🚨 Presupuesto casi agotado",
          description: "{{project.code}} {{project.name}} gastó el {{project.budgetPct}}% del presupuesto con {{project.progress}}% de avance",
          severity: "critical",
        } as ActionSendAlertConfig,
      },
      {
        type: "action_create_task",
        label: "Revisar desvío",
        config: {
          title: "Revisar desvío de presupuesto en {{project.code}}",
          description: "La obra está por agotar su presupuesto sin completarse. Revisar partidas y ajustar.",
          priority: "critical",
          assignee: "Jefe de obra",
          dueDays: 1,
        } as ActionCreateTaskConfig,
      },
    ],
  },
  {
    name: "Resumen semanal automático (Lunes 9am)",
    description: "Cada lunes a las 9am, genera un resumen de alertas activas y KPIs del negocio",
    trigger: "schedule",
    triggerConfig: { cron: "0 9 * * 1" },
    steps: [
      {
        type: "action_send_alert",
        label: "Resumen semanal",
        config: {
          title: "📊 Resumen semanal automático",
          description: "Revisión programada del estado general del negocio. Revisar alertas activas, stock bajo y tareas vencidas.",
          severity: "info",
        } as ActionSendAlertConfig,
      },
    ],
  },
  {
    name: "Gasto grande (+$100K) → Alerta inmediata",
    description: "Cuando se registra un gasto mayor a $100,000, alerta y crea tarea de verificación",
    trigger: "event_new_transaction",
    steps: [
      {
        type: "condition",
        label: "¿Es gasto?",
        config: {
          field: "transaction.type",
          operator: "eq",
          value: "expense",
        } as ConditionConfig,
      },
      {
        type: "condition",
        label: "¿Supera $100,000?",
        config: {
          field: "transaction.amount",
          operator: "gte",
          value: 100000,
        } as ConditionConfig,
      },
      {
        type: "action_send_alert",
        label: "Alerta de gasto",
        config: {
          title: "💰 Gasto significativo",
          description: "Se registró {{transaction.description}} por ${{transaction.amount}}",
          severity: "info",
        } as ActionSendAlertConfig,
      },
      {
        type: "action_create_task",
        label: "Verificar gasto",
        config: {
          title: "Verificar gasto de ${{transaction.amount}} - {{transaction.description}}",
          description: "Gasto que supera el umbral de $100,000. Verificar que corresponda.",
          priority: "medium",
          assignee: "Administración",
          dueDays: 3,
        } as ActionCreateTaskConfig,
      },
    ],
  },
  {
    name: "Cierre de obra → Resumen financiero",
    description: "Marca obra como finalizada, envía alerta de cierre con resumen de ingresos y gastos",
    trigger: "manual",
    steps: [
      {
        type: "action_update_project_status",
        label: "Cambiar estado a finalizada",
        config: {
          projectRef: "{{workflow.projectId}}",
          status: "finished",
        } as ActionUpdateProjectStatusConfig,
      },
      {
        type: "action_send_alert",
        label: "Notificar cierre",
        config: {
          title: "✅ Obra finalizada",
          description: "La obra ha sido marcada como completada. Revisar resumen financiero.",
          severity: "info",
        } as ActionSendAlertConfig,
      },
    ],
  },
  {
    name: "Material nuevo → Registrar costo inicial",
    description: "Cuando se crea un material nuevo, actualiza automáticamente su costo según el mejor proveedor",
    trigger: "event_new_material",
    steps: [
      {
        type: "action_send_alert",
        label: "Nuevo material registrado",
        config: {
          title: "📦 Nuevo material: {{material.name}}",
          description: "Se registró {{material.name}} ({{material.sku}}). Stock inicial: {{material.stock}} {{material.unit}}",
          severity: "info",
        } as ActionSendAlertConfig,
      },
    ],
  },
  {
    name: "Tarea atrasada → Escalar al responsable",
    description: "Cuando una tarea vence y sigue pendiente, escala con alerta de mayor severidad",
    trigger: "event_late_task",
    steps: [
      {
        type: "action_send_alert",
        label: "Tarea atrasada",
        config: {
          title: "⏰ Tarea atrasada detectada",
          description: "{{task.title}} venció. Asignada a {{task.assignee || 'sin asignar'}}.",
          severity: "warning",
        } as ActionSendAlertConfig,
      },
      {
        type: "action_create_task",
        label: "Tarea de escalado",
        config: {
          title: "ESCALADO: {{task.title}} - sin resolver",
          description: "La tarea original venció y no fue completada. Tomar acción correctiva.",
          priority: "high",
          dueDays: 1,
        } as ActionCreateTaskConfig,
      },
    ],
  },
  {
    name: "Nueva obra → Setup inicial automático",
    description: "Cuando se crea una obra nueva, crea tareas de setup y da la bienvenida",
    trigger: "event_new_project",
    steps: [
      {
        type: "action_send_alert",
        label: "Bienvenida obra nueva",
        config: {
          title: "🏗️ Nueva obra creada: {{project.name}}",
          description: "{{project.code}} - Presupuesto: ${{project.budget}}. Iniciar configuración inicial.",
          severity: "info",
        } as ActionSendAlertConfig,
      },
      {
        type: "action_create_task",
        label: "Configurar obra nueva",
        config: {
          title: "Setup inicial: {{project.code}} {{project.name}}",
          description: "Configurar equipo de obra, proveedores y calendario de pagos.",
          priority: "high",
          assignee: "Jefe de obra",
          dueDays: 5,
        } as ActionCreateTaskConfig,
      },
      {
        type: "action_create_task",
        label: "Cargar presupuesto detallado",
        config: {
          title: "Cargar presupuesto detallado para {{project.code}}",
          description: "Desglosar presupuesto en partidas: materiales, mano de obra, equipos, servicios.",
          priority: "high",
          assignee: "Administración",
          dueDays: 7,
        } as ActionCreateTaskConfig,
      },
    ],
  },
  {
    name: "Pico de gastos mensual → Auditoría",
    description: "Si los gastos semanales superan $1,000,000, genera alerta y tarea de auditoría",
    trigger: "event_expense_spike",
    steps: [
      {
        type: "action_send_alert",
        label: "Pico de gastos detectado",
        config: {
          title: "📈 Pico de gastos en la semana",
          description: "Los gastos de esta semana superan el umbral. Revisar transacciones recientes.",
          severity: "warning",
        } as ActionSendAlertConfig,
      },
      {
        type: "action_create_task",
        label: "Auditar gastos",
        config: {
          title: "Auditar gastos de la semana - pico detectado",
          description: "Revisar todas las transacciones de la semana para identificar gastos innecesarios o errores.",
          priority: "high",
          assignee: "Administración",
          dueDays: 2,
        } as ActionCreateTaskConfig,
      },
    ],
  },
  {
    name: "Reporte diario de cierre (19hs)",
    description: "Cada día hábil a las 19hs, genera un resumen del día con movimientos y alertas",
    trigger: "schedule",
    triggerConfig: { cron: "0 19 * * 1-5" },
    steps: [
      {
        type: "action_send_alert",
        label: "Resumen del día",
        config: {
          title: "📋 Resumen diario",
          description: "Cierre del día. Revisar movimientos registrados y tareas pendientes.",
          severity: "info",
        } as ActionSendAlertConfig,
      },
      {
        type: "action_create_task",
        label: "Pendientes del día siguiente",
        config: {
          title: "Revisar pendientes para mañana",
          description: "Verificar tareas sin completar del día y priorizar para mañana.",
          priority: "medium",
          dueDays: 1,
        } as ActionCreateTaskConfig,
      },
    ],
  },
  {
    name: "Stock crítico sin movimiento → Revisar",
    description: "Si hay materiales sin movimiento por más de 90 días, alerta para considerar descarte o venta",
    trigger: "manual",
    steps: [
      {
        type: "action_send_alert",
        label: "Stock inmovilizado",
        config: {
          title: "📦 Stock sin rotación",
          description: "Hay materiales sin movimiento por más de 90 días. Revisar para liberar capital.",
          severity: "warning",
        } as ActionSendAlertConfig,
      },
      {
        type: "action_create_task",
        label: "Revisar stock muerto",
        config: {
          title: "Revisar materiales sin rotación",
          description: "Identificar materiales que no se movieron en 90+ días y decidir: mantener, vender o descartar.",
          priority: "low",
          assignee: "Administración",
          dueDays: 15,
        } as ActionCreateTaskConfig,
      },
    ],
  },
];

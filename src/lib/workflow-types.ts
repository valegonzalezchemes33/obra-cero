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
  | "action_call_llm"
  | "action_query_db"
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

export interface ActionQueryDbConfig {
  model: "transaction" | "task" | "material" | "project" | "supplier" | "stockMovement";
  where?: Record<string, any>;
  orderBy?: { field: string; direction: "asc" | "desc" };
  take?: number;
  outputVariable: string;
}

export interface ActionCallLlmConfig {
  systemPrompt: string;       // Prompt del sistema para Groq
  userPrompt: string;         // Prompt del usuario (puede incluir {{variables}})
  dataSource?: string;        // Variable del contexto a pasar como datos (ej: "transactions", "materials")
  outputVariable: string;     // Variable donde guardar el resultado (ej: "llmResult")
  model?: string;             // Modelo Groq a usar (opcional, default: llama-3.3-70b-versatile)
  temperature?: number;       // Temperatura (opcional, default: 0.3)
  maxTokens?: number;         // Máximo de tokens (opcional, default: 1024)
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
    | ActionCallLlmConfig
    | ActionQueryDbConfig
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
  action_call_llm: { label: "Llamar a Groq AI", icon: "brain", color: "text-emerald-500", group: "IA" },
  action_query_db: { label: "Consultar base de datos", icon: "database", color: "text-cyan-500", group: "Datos" },
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
  // ═══════════════════════════════════════════════════════════════
  // WORKFLOWS CON GROQ AI — Análisis inteligente
  // ═══════════════════════════════════════════════════════════════
  // Estos workflows usan el paso action_call_llm para que Groq
  // analice datos del sistema y genere insights accionables.
  // ═══════════════════════════════════════════════════════════════
  {
    name: "🤖 Análisis y optimización de stock con IA",
    description:
      "Usa Groq AI para analizar el inventario actual, identificar materiales con baja rotación, sugerir cantidades óptimas de reposición y priorizar compras según urgencia e impacto financiero.",
    trigger: "manual",
    steps: [
      {
        type: "action_reorder",
        label: "Obtener materiales bajo mínimo",
        config: { useLowStock: true } as ActionReorderConfig,
      },
      {
        type: "action_call_llm",
        label: "Groq analiza el stock",
        config: {
          systemPrompt:
            "Eres un asesor experto en gestión de inventarios para una constructora. Analizá los datos de stock y generá recomendaciones accionables.",
          userPrompt:
            "Analizá estos materiales con stock bajo o sin stock. Para cada uno:" +
            "\n1. Determiná la prioridad de compra (alta/media/baja) según si puede detener una obra" +
            "\n2. Sugerí la cantidad óptima a pedir considerando el consumo estimado" +
            "\n3. Identificá si algún material debería tener un proveedor alternativo" +
            "\n4. Calculá el costo total estimado de la reposición" +
            "\n\nFinalmente, indicá el monto total necesario y el top 3 de compras urgentes.",
          dataSource: "reorderItems",
          outputVariable: "stockAnalysis",
          temperature: 0.3,
          maxTokens: 2048,
        } as ActionCallLlmConfig,
      },
      {
        type: "action_send_alert",
        label: "Enviar análisis de stock",
        config: {
          title: "🤖 Análisis de stock por IA",
          description:
            "Groq AI analizó el inventario. Revisar recomendaciones de compra y prioridades. {{stockAnalysis}}",
          severity: "info",
        } as ActionSendAlertConfig,
      },
      {
        type: "action_create_task",
        label: "Tarea de compras prioritarias",
        config: {
          title: "Revisar análisis de stock generado por IA y ejecutar compras prioritarias",
          description:
            "Groq analizó el inventario y generó recomendaciones. Revisar el análisis y realizar las compras sugeridas.",
          priority: "high",
          assignee: "Compras",
          dueDays: 3,
        } as ActionCreateTaskConfig,
      },
    ],
  },
  {
    name: "🤖 Análisis financiero inteligente",
    description:
      "Usa Groq AI para analizar las finanzas reales de la constructora: consulta ingresos, gastos y transacciones recientes, y genera un informe con recomendaciones.",
    trigger: "manual",
    steps: [
      {
        type: "action_query_db",
        label: "Obtener transacciones recientes",
        config: {
          model: "transaction",
          orderBy: { field: "date", direction: "desc" },
          take: 50,
          outputVariable: "transactions",
        } as ActionQueryDbConfig,
      },
      {
        type: "action_call_llm",
        label: "Groq analiza finanzas",
        config: {
          systemPrompt:
            "Eres un analista financiero experto en construcción. Generá un informe claro con recomendaciones accionables basadas en los datos reales. Respondé en español argentino.",
          userPrompt:
            "Analizá estas transacciones reales y generá un informe con:" +
            "\n1. Resumen ejecutivo: ingresos totales, gastos totales, saldo" +
            "\n2. Principales categorías de gasto" +
            "\n3. Recomendaciones concretas para mejorar rentabilidad (3-5 acciones)" +
            "\n4. Alertas sobre gastos inusuales" +
            "\n\nFormateá con secciones claras y emojis.",
          dataSource: "transactions",
          outputVariable: "financialAnalysis",
          temperature: 0.4,
          maxTokens: 500,
        } as ActionCallLlmConfig,
      },
      {
        type: "action_send_alert",
        label: "Enviar análisis financiero",
        config: {
          title: "🤖 Análisis financiero por IA",
          description:
            "📊 Análisis financiero:\n{{financialAnalysis}}",
          severity: "info",
        } as ActionSendAlertConfig,
      },
      {
        type: "action_create_task",
        label: "Tarea de revisión financiera",
        config: {
          title: "Revisar análisis financiero generado por IA",
          description:
            "Groq generó un análisis financiero en base a datos reales. Revisar recomendaciones y asignar responsables.",
          priority: "high",
          assignee: "Administración",
          dueDays: 5,
        } as ActionCreateTaskConfig,
      },
    ],
  },
  {
    name: "🤖 Priorización inteligente de tareas",
    description:
      "Usa Groq AI para analizar las tareas pendientes reales de la base de datos y sugerir un orden de prioridad según urgencia e impacto en obras.",
    trigger: "manual",
    steps: [
      {
        type: "action_query_db",
        label: "Obtener tareas pendientes",
        config: {
          model: "task",
          where: { status: { not: "completed" } },
          orderBy: { field: "createdAt", direction: "desc" },
          take: 30,
          outputVariable: "tasks",
        } as ActionQueryDbConfig,
      },
      {
        type: "action_call_llm",
        label: "Groq prioriza tareas",
        config: {
          systemPrompt:
            "Eres un project manager experto en construcción. Analizá las tareas reales y sugerí priorización considerando urgencia, impacto en obras y recursos disponibles.",
          userPrompt:
            "Analizá estas tareas pendientes reales y:" +
            "\n1. Clasificá cada una como: urgente, importante, normal, o puede esperar" +
            "\n2. Sugerí orden de ejecución diario" +
            "\n3. Identificá tareas para reasignar a otro responsable" +
            "\n4. Detectá tareas que podrían cancelarse" +
            "\n\nPriorizá las vinculadas a obras activas y las vencidas.",
          dataSource: "tasks",
          outputVariable: "taskPrioritization",
          temperature: 0.3,
          maxTokens: 500,
        } as ActionCallLlmConfig,
      },
      {
        type: "action_send_alert",
        label: "Enviar priorización",
        config: {
          title: "🤖 Priorización de tareas por IA",
          description:
            "📋 Priorización:\n{{taskPrioritization}}",
          severity: "info",
        } as ActionSendAlertConfig,
      },
      {
        type: "action_create_task",
        label: "Reasignar según priorización",
        config: {
          title: "Revisar priorización de tareas generada por IA",
          description:
            "Groq analizó {{tasks.length}} tareas pendientes y generó una priorización. Revisar y reasignar según corresponda.",
          priority: "high",
          assignee: "Jefe de obra",
          dueDays: 1,
        } as ActionCreateTaskConfig,
      },
    ],
  },
  {
    name: "🤖 Reporte de salud de proyectos",
    description:
      "Usa Groq AI para analizar las obras reales de la base de datos: avance, presupuesto, riesgos y ETA. Genera un reporte ejecutivo con semáforo de salud.",
    trigger: "manual",
    steps: [
      {
        type: "action_query_db",
        label: "Obtener proyectos activos",
        config: {
          model: "project",
          where: { status: { not: "finished" } },
          orderBy: { field: "updatedAt", direction: "desc" },
          take: 20,
          outputVariable: "projects",
        } as ActionQueryDbConfig,
      },
      {
        type: "action_query_db",
        label: "Obtener transacciones por proyecto",
        config: {
          model: "transaction",
          orderBy: { field: "date", direction: "desc" },
          take: 100,
          outputVariable: "allTransactions",
        } as ActionQueryDbConfig,
      },
      {
        type: "action_call_llm",
        label: "Groq analiza proyectos",
        config: {
          systemPrompt:
            "Eres un controller de obras experto. Analizá los datos reales de proyectos y transacciones. Generá un reporte ejecutivo con alertas tempranas y recomendaciones accionables.",
          userPrompt:
            "Analizá estos proyectos reales y sus transacciones financieras. Generá:" +
            "\n1. Semáforo de salud por proyecto (🟢 verde / 🟡 amarillo / 🔴 rojo)" +
            "\n2. Principales riesgos por proyecto (presupuesto, atraso, materiales)" +
            "\n3. Recomendaciones específicas para cada obra" +
            "\n4. Ranking de proyectos que requieren atención inmediata" +
            "\n\nPara cada proyecto, considerá: avance vs tiempo transcurrido, presupuesto gastado, y estado actual.",
          dataSource: "projects",
          outputVariable: "projectHealthReport",
          temperature: 0.4,
          maxTokens: 600,
        } as ActionCallLlmConfig,
      },
      {
        type: "action_send_alert",
        label: "Enviar reporte de salud",
        config: {
          title: "🤖 Salud de proyectos por IA",
          description:
            "🏗️ Reporte de salud (basado en datos reales):\n{{projectHealthReport}}",
          severity: "info",
        } as ActionSendAlertConfig,
      },
      {
        type: "action_create_task",
        label: "Revisar proyectos críticos",
        config: {
          title: "Revisar proyectos con salud crítica según análisis de IA",
          description:
            "Groq analizó {{projects.length}} proyectos activos. Revisar los que están en rojo/amarillo y tomar acciones correctivas.",
          priority: "critical",
          assignee: "Director de obra",
          dueDays: 2,
        } as ActionCreateTaskConfig,
      },
    ],
  },
  {
    name: "🤖 Clasificación y alerta de gastos con IA",
    description:
      "Cuando se registra un nuevo gasto, Groq AI lo analiza para clasificarlo, detectar anomalías y sugerir acciones. Incluye alerta inteligente si el gasto requiere revisión.",
    trigger: "event_new_transaction",
    steps: [
      {
        type: "action_call_llm",
        label: "Groq clasifica el gasto",
        config: {
          systemPrompt:
            "Eres un asistente financiero que clasifica gastos de construcción. Tu respuesta DEBE terminar exactamente con '[REQUIERE_REVISION: SI]' o '[REQUIERE_REVISION: NO]' en la última línea.",
          userPrompt:
            "Clasificá este gasto:\n" +
            "- Tipo: {{transaction.type}}\n" +
            "- Monto: ${{transaction.amount}}\n" +
            "- Categoría: {{transaction.category}}\n" +
            "- Descripción: {{transaction.description}}\n" +
            "- Obra: {{transaction.projectId}}\n\n" +
            "Determiná:\n" +
            "1. Categoría correcta\n" +
            "2. ¿Monto inusualmente alto?\n" +
            "3. ¿Requiere revisión?\n" +
            "4. Acción sugerida\n\n" +
            "IMPORTANTE: tu última línea debe ser '[REQUIERE_REVISION: SI]' o '[REQUIERE_REVISION: NO]'",
          outputVariable: "expenseClassification",
          temperature: 0.2,
          maxTokens: 500,
        } as ActionCallLlmConfig,
      },
      {
        type: "condition",
        label: "¿Requiere revisión?",
        config: {
          field: "expenseClassification",
          operator: "contains",
          value: "REQUIERE_REVISION: SI",
        } as ConditionConfig,
      },
      {
        type: "action_create_task",
        label: "Tarea de revisión",
        config: {
          title: "Revisar gasto de ${{transaction.amount}} clasificado por IA",
          description:
            "Groq AI clasificó este gasto como posible anomalía:\n{{expenseClassification}}",
          priority: "medium",
          assignee: "Administración",
          dueDays: 3,
        } as ActionCreateTaskConfig,
      },
    ],
  },
];

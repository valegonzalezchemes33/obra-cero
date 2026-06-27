// ============================================================
// PROMPTS Y GUÍAS ESPECÍFICAS POR ACCIÓN
// ============================================================
// Centraliza todos los prompts, instrucciones y contexto
// para cada intención del agente, asegurando que cada acción
// sepa su sección correcta y los campos que necesita.

import type { Intent } from "./agent";

export interface ActionPromptConfig {
  section: string; // Dónde va: "obra", "materiales", "tareas", "transacciones", etc.
  description: string; // Descripción clara de qué hace
  requiredFields: string[]; // Campos obligatorios
  optionalFields: string[]; // Campos opcionales
  fieldLabels: Record<string, string>; // Labels amigables para cada campo
  fieldHints: Record<string, string>; // Pistas sobre qué espera cada campo
  actionPrompt: string; // Instrucción específica para el usuario
  executionGuide: string; // Guía sobre cómo se ejecutará
}

export const ACTION_PROMPTS: Partial<Record<Intent, ActionPromptConfig>> = {
  // ─── OBRAS ───
  action_create_project_direct: {
    section: "📋 OBRAS",
    description: "Crear una nueva obra/proyecto",
    requiredFields: ["name"],
    optionalFields: ["budget", "clientName"],
    fieldLabels: {
      name: "Nombre de la obra",
      budget: "Presupuesto ($)",
      clientName: "Nombre del cliente",
    },
    fieldHints: {
      name: "Ej: Casa García, Amarras Center, Reforma oficina",
      budget: "Ej: 250000, 1.5M (opcional)",
      clientName: "Ej: Juan García, Inmobiliaria XYZ (opcional)",
    },
    actionPrompt: "Necesito crear una obra nueva en la sección **OBRAS**. ¿Cuál es el nombre de la obra?",
    executionGuide: "✅ Se creará la obra con un código único OB-XXX y se registrará en la sección **OBRAS**.",
  },

  action_update_project_status: {
    section: "📋 OBRAS",
    description: "Cambiar el estado de una obra",
    requiredFields: ["projectRef", "status"],
    optionalFields: [],
    fieldLabels: {
      projectRef: "Código de la obra (OB-###)",
      status: "Nuevo estado",
    },
    fieldHints: {
      projectRef: "Ej: OB-001, OB-042",
      status: "Opciones: Planificación, En curso, Pausada, Finalizada",
    },
    actionPrompt: "Necesito actualizar el estado de una obra. ¿Cuál es el código (OB-###)?",
    executionGuide: "✅ Se actualizará el estado de la obra en la sección **OBRAS**.",
  },

  action_update_project_progress: {
    section: "📋 OBRAS",
    description: "Actualizar el porcentaje de avance de una obra",
    requiredFields: ["projectRef", "progress"],
    optionalFields: [],
    fieldLabels: {
      projectRef: "Código de la obra (OB-###)",
      progress: "Porcentaje de avance (%)",
    },
    fieldHints: {
      projectRef: "Ej: OB-001",
      progress: "Ej: 50, 75, 100",
    },
    actionPrompt: "Necesito actualizar el avance de una obra. ¿Cuál es el código (OB-###)?",
    executionGuide: "✅ Se actualizará el % de avance en la sección **OBRAS**.",
  },

  action_close_project: {
    section: "📋 OBRAS",
    description: "Cerrar/finalizar una obra",
    requiredFields: ["projectRef"],
    optionalFields: [],
    fieldLabels: {
      projectRef: "Código de la obra (OB-###)",
    },
    fieldHints: {
      projectRef: "Ej: OB-001",
    },
    actionPrompt: "Necesito cerrar una obra. ¿Cuál es el código (OB-###)?",
    executionGuide: "✅ La obra se marcará como FINALIZADA con 100% de avance en **OBRAS**.",
  },

  action_edit_project: {
    section: "📋 OBRAS",
    description: "Editar información de una obra existente",
    requiredFields: ["projectRef"],
    optionalFields: ["name", "budget", "clientName"],
    fieldLabels: {
      projectRef: "Código de la obra (OB-###)",
      name: "Nuevo nombre",
      budget: "Nuevo presupuesto",
      clientName: "Nuevo cliente",
    },
    fieldHints: {
      projectRef: "Ej: OB-001",
      name: "Ej: Casa García 2.0",
      budget: "Ej: 300000",
      clientName: "Ej: Juan Carlos García",
    },
    actionPrompt: "Necesito editar una obra. ¿Cuál es el código (OB-###)?",
    executionGuide: "✅ Se editará la información de la obra en **OBRAS**.",
  },

  // ─── MATERIALES ───
  action_add_materials: {
    section: "📦 MATERIALES",
    description: "Agregar/crear materiales en el inventario",
    requiredFields: ["items"],
    optionalFields: ["projectRef"],
    fieldLabels: {
      items: "Lista de materiales",
      projectRef: "Obra relacionada (OB-###, opcional)",
    },
    fieldHints: {
      items: "Ej: 10 bolsas de cemento, 5 bultos de arena, 100 ladrillos",
      projectRef: "Ej: OB-001 (déjalo en blanco si es stock general)",
    },
    actionPrompt: "Necesito agregar materiales al inventario en la sección **MATERIALES**. ¿Qué materiales querés agregar? (Especifica cantidad y tipo)",
    executionGuide: "✅ Los materiales se crearán o actualizarán en **MATERIALES**. Si especificas obra (OB-###), también se enlazarán con esa obra.",
  },

  action_add_stock_movement: {
    section: "📦 MATERIALES",
    description: "Registrar entrada/salida de stock",
    requiredFields: ["type", "materialName", "quantity"],
    optionalFields: ["unit", "projectRef"],
    fieldLabels: {
      type: "Tipo de movimiento",
      materialName: "Nombre del material",
      quantity: "Cantidad",
      unit: "Unidad de medida",
      projectRef: "Obra relacionada (OB-###, opcional)",
    },
    fieldHints: {
      type: "Entrada o Salida",
      materialName: "Ej: Cemento Portland",
      quantity: "Ej: 50",
      unit: "Ej: bolsas, kg, m3",
      projectRef: "Ej: OB-001",
    },
    actionPrompt: "Necesito registrar un movimiento de stock en **MATERIALES**. ¿Es entrada o salida?",
    executionGuide: "✅ Se registrará el movimiento en el historial de **MATERIALES** y se actualizará el stock.",
  },

  action_reorder: {
    section: "📦 MATERIALES",
    description: "Generar pedido de compra para materiales con stock bajo",
    requiredFields: [],
    optionalFields: [],
    fieldLabels: {},
    fieldHints: {},
    actionPrompt: "Voy a generar un pedido de compra para los materiales con stock bajo en **MATERIALES**.",
    executionGuide: "✅ Se generará un listado de compra con los materiales que están por debajo del stock mínimo.",
  },

  // ─── TAREAS ───
  action_create_task: {
    section: "✅ TAREAS",
    description: "Crear una nueva tarea",
    requiredFields: ["title"],
    optionalFields: ["description", "dueDate", "projectRef"],
    fieldLabels: {
      title: "Descripción de la tarea",
      description: "Detalles adicionales",
      dueDate: "Fecha de vencimiento",
      projectRef: "Obra relacionada (OB-###, opcional)",
    },
    fieldHints: {
      title: "Ej: Contactar proveedor, Revisar planos, Comprar materiales",
      description: "Ej: Llamar a Juan García antes de las 5pm",
      dueDate: "Ej: mañana, 25/06/2026, próxima semana",
      projectRef: "Ej: OB-001",
    },
    actionPrompt: "Necesito crear una tarea en **TAREAS**. ¿Cuál es la descripción de la tarea?",
    executionGuide: "✅ La tarea se creará en la sección **TAREAS** y se marcará como pendiente.",
  },

  action_complete_task: {
    section: "✅ TAREAS",
    description: "Marcar una tarea como completada",
    requiredFields: ["taskTitle"],
    optionalFields: [],
    fieldLabels: {
      taskTitle: "Descripción de la tarea",
    },
    fieldHints: {
      taskTitle: "Ej: Contactar proveedor",
    },
    actionPrompt: "Necesito marcar una tarea como completada en **TAREAS**. ¿Cuál es la descripción de la tarea?",
    executionGuide: "✅ La tarea se marcará como COMPLETADA en la sección **TAREAS**.",
  },

  action_edit_task: {
    section: "✅ TAREAS",
    description: "Editar una tarea existente",
    requiredFields: ["taskTitle"],
    optionalFields: ["description", "dueDate"],
    fieldLabels: {
      taskTitle: "Descripción actual",
      description: "Nueva descripción",
      dueDate: "Nueva fecha de vencimiento",
    },
    fieldHints: {
      taskTitle: "Ej: Contactar proveedor",
      description: "Ej: Llamar a Juan García el próximo lunes",
      dueDate: "Ej: próximo viernes",
    },
    actionPrompt: "Necesito editar una tarea en **TAREAS**. ¿Cuál es la descripción actual de la tarea?",
    executionGuide: "✅ La tarea se editará en la sección **TAREAS**.",
  },

  action_delete_task: {
    section: "✅ TAREAS",
    description: "Eliminar una tarea",
    requiredFields: ["taskTitle"],
    optionalFields: [],
    fieldLabels: {
      taskTitle: "Descripción de la tarea",
    },
    fieldHints: {
      taskTitle: "Ej: Contactar proveedor",
    },
    actionPrompt: "Necesito eliminar una tarea en **TAREAS**. ¿Cuál es la descripción de la tarea?",
    executionGuide: "⚠️ La tarea será ELIMINADA de la sección **TAREAS**. Esta acción no se puede deshacer.",
  },

  // ─── TRANSACCIONES ───
  action_create_expense: {
    section: "💰 TRANSACCIONES",
    description: "Registrar un gasto",
    requiredFields: ["amount", "category"],
    optionalFields: ["projectRef", "description"],
    fieldLabels: {
      amount: "Monto del gasto ($)",
      category: "Categoría",
      projectRef: "Obra relacionada (OB-###, opcional)",
      description: "Descripción adicional",
    },
    fieldHints: {
      amount: "Ej: 5000, 150.50",
      category: "Ej: materiales, mano de obra, servicios, equipos, alquiler, transporte",
      projectRef: "Ej: OB-001",
      description: "Ej: Compra de cemento en Ferretería XYZ",
    },
    actionPrompt: "Necesito registrar un gasto en **TRANSACCIONES**. ¿Cuál es el monto?",
    executionGuide: "✅ El gasto se registrará en la sección **TRANSACCIONES** y se desglosará por categoría.",
  },

  action_create_income: {
    section: "💰 TRANSACCIONES",
    description: "Registrar un ingreso",
    requiredFields: ["amount"],
    optionalFields: ["projectRef", "description"],
    fieldLabels: {
      amount: "Monto del ingreso ($)",
      projectRef: "Obra relacionada (OB-###, opcional)",
      description: "Descripción",
    },
    fieldHints: {
      amount: "Ej: 50000, 1200.75",
      projectRef: "Ej: OB-001",
      description: "Ej: Cobro anticipo cliente",
    },
    actionPrompt: "Necesito registrar un ingreso en **TRANSACCIONES**. ¿Cuál es el monto?",
    executionGuide: "✅ El ingreso se registrará en la sección **TRANSACCIONES**.",
  },

  action_delete_transaction: {
    section: "💰 TRANSACCIONES",
    description: "Eliminar una transacción",
    requiredFields: ["amount"],
    optionalFields: [],
    fieldLabels: {
      amount: "Monto de la transacción",
    },
    fieldHints: {
      amount: "Ej: 5000",
    },
    actionPrompt: "Necesito eliminar una transacción en **TRANSACCIONES**. ¿Cuál es el monto?",
    executionGuide: "⚠️ La transacción será ELIMINADA. Esta acción no se puede deshacer.",
  },

  // ─── PROVEEDORES ───
  action_create_supplier: {
    section: "🏢 PROVEEDORES",
    description: "Crear un nuevo proveedor",
    requiredFields: ["name"],
    optionalFields: ["phone", "email", "category"],
    fieldLabels: {
      name: "Nombre del proveedor",
      phone: "Teléfono",
      email: "Email",
      category: "Rubro/Categoría",
    },
    fieldHints: {
      name: "Ej: Ferretería XYZ, Construcciones García",
      phone: "Ej: +54 11 4567-8900",
      email: "Ej: contacto@proveedorxyz.com",
      category: "Ej: materiales, herramientas, mano de obra",
    },
    actionPrompt: "Necesito crear un proveedor en **PROVEEDORES**. ¿Cuál es el nombre?",
    executionGuide: "✅ El proveedor se registrará en la sección **PROVEEDORES**.",
  },

  // ─── WORKFLOWS ───
  action_trigger_workflow: {
    section: "⚙️ AUTOMACIONES",
    description: "Ejecutar un workflow/automatización",
    requiredFields: ["workflowName"],
    optionalFields: [],
    fieldLabels: {
      workflowName: "Nombre del workflow",
    },
    fieldHints: {
      workflowName: "Ej: Generar reporte mensual, Notificar clientes",
    },
    actionPrompt: "Necesito ejecutar un workflow en **AUTOMACIONES**. ¿Cuál es el nombre?",
    executionGuide: "✅ El workflow se ejecutará en la sección **AUTOMACIONES**.",
  },

  action_list_workflows: {
    section: "⚙️ AUTOMACIONES",
    description: "Listar workflows disponibles",
    requiredFields: [],
    optionalFields: [],
    fieldLabels: {},
    fieldHints: {},
    actionPrompt: "Voy a mostrar los workflows disponibles en **AUTOMACIONES**.",
    executionGuide: "✅ Se mostrará el listado de workflows en **AUTOMACIONES**.",
  },

  action_export_data: {
    section: "📊 EXPORTACIÓN",
    description: "Exportar datos a archivo",
    requiredFields: [],
    optionalFields: [],
    fieldLabels: {},
    fieldHints: {},
    actionPrompt: "Voy a preparar la exportación de datos.",
    executionGuide: "✅ Los datos se exportarán en el formato solicitado.",
  },

  action_edit_material: {
    section: "📦 MATERIALES",
    description: "Editar información de un material",
    requiredFields: ["materialName"],
    optionalFields: ["price", "unit", "minStock"],
    fieldLabels: {
      materialName: "Nombre del material",
      price: "Precio unitario",
      unit: "Unidad de medida",
      minStock: "Stock mínimo",
    },
    fieldHints: {
      materialName: "Ej: Cemento Portland",
      price: "Ej: 500, 1250.50",
      unit: "Ej: bolsa, kg, m3",
      minStock: "Ej: 10",
    },
    actionPrompt: "Necesito editar un material en **MATERIALES**. ¿Cuál es el nombre del material?",
    executionGuide: "✅ El material se editará en la sección **MATERIALES**.",
  },

  action_delete_material: {
    section: "📦 MATERIALES",
    description: "Eliminar un material del inventario",
    requiredFields: ["materialName"],
    optionalFields: [],
    fieldLabels: {
      materialName: "Nombre del material",
    },
    fieldHints: {
      materialName: "Ej: Cemento Portland",
    },
    actionPrompt: "Necesito eliminar un material en **MATERIALES**. ¿Cuál es el nombre?",
    executionGuide: "⚠️ El material será ELIMINADO de **MATERIALES**. Esta acción no se puede deshacer.",
  },

  // Defaults para intents no mapeados
  greeting: {
    section: "💬 CHAT",
    description: "Saludo del usuario",
    requiredFields: [],
    optionalFields: [],
    fieldLabels: {},
    fieldHints: {},
    actionPrompt: "Bienvenido a ObraCero. ¿En qué puedo ayudarte?",
    executionGuide: "✅ Responderé tu saludo.",
  },

  help: {
    section: "💬 CHAT",
    description: "Solicitud de ayuda",
    requiredFields: [],
    optionalFields: [],
    fieldLabels: {},
    fieldHints: {},
    actionPrompt: "¿Necesitás ayuda?",
    executionGuide: "✅ Te mostraré las opciones disponibles.",
  },

  unknown: {
    section: "❓ DESCONOCIDO",
    description: "Intención no reconocida",
    requiredFields: [],
    optionalFields: [],
    fieldLabels: {},
    fieldHints: {},
    actionPrompt: "No entendí bien tu solicitud.",
    executionGuide: "⚠️ Podría no ejecutarse correctamente.",
  },

  // Query intents (sin handlers específicos, pero documentados)
  query_profit: {
    section: "📊 CONSULTAS",
    description: "Consultar ganancia/utilidad",
    requiredFields: [],
    optionalFields: ["projectRef"],
    fieldLabels: {},
    fieldHints: {},
    actionPrompt: "Voy a obtener la información de ganancia.",
    executionGuide: "✅ Se mostrará la ganancia acumulada o por obra.",
  },

  query_expenses: {
    section: "📊 CONSULTAS",
    description: "Consultar gastos",
    requiredFields: [],
    optionalFields: ["projectRef", "category"],
    fieldLabels: {},
    fieldHints: {},
    actionPrompt: "Voy a obtener la información de gastos.",
    executionGuide: "✅ Se mostrarán los gastos desglosados.",
  },

  query_income: {
    section: "📊 CONSULTAS",
    description: "Consultar ingresos",
    requiredFields: [],
    optionalFields: ["projectRef"],
    fieldLabels: {},
    fieldHints: {},
    actionPrompt: "Voy a obtener la información de ingresos.",
    executionGuide: "✅ Se mostrarán los ingresos registrados.",
  },

  query_stock: {
    section: "📊 CONSULTAS",
    description: "Consultar estado del stock",
    requiredFields: [],
    optionalFields: ["materialName"],
    fieldLabels: {},
    fieldHints: {},
    actionPrompt: "Voy a obtener la información del inventario.",
    executionGuide: "✅ Se mostrará el stock de materiales.",
  },

  query_project_status: {
    section: "📊 CONSULTAS",
    description: "Consultar estado de una obra",
    requiredFields: [],
    optionalFields: ["projectRef"],
    fieldLabels: {},
    fieldHints: {},
    actionPrompt: "Voy a obtener el estado de las obras.",
    executionGuide: "✅ Se mostrarán los detalles de las obras.",
  },

  query_tasks: {
    section: "📊 CONSULTAS",
    description: "Consultar tareas pendientes",
    requiredFields: [],
    optionalFields: [],
    fieldLabels: {},
    fieldHints: {},
    actionPrompt: "Voy a obtener las tareas pendientes.",
    executionGuide: "✅ Se mostrarán las tareas sin completar.",
  },

  predict_budget: {
    section: "📊 CONSULTAS",
    description: "Predicción de presupuesto/costos",
    requiredFields: [],
    optionalFields: ["projectRef"],
    fieldLabels: {},
    fieldHints: {},
    actionPrompt: "Voy a analizar la proyección de costos.",
    executionGuide: "✅ Se mostrará una predicción de gastos.",
  },

  recommend: {
    section: "💡 INTELIGENCIA",
    description: "Obtener recomendaciones",
    requiredFields: [],
    optionalFields: [],
    fieldLabels: {},
    fieldHints: {},
    actionPrompt: "Voy a generar recomendaciones.",
    executionGuide: "✅ Se mostrarán sugerencias para optimizar.",
  },

  summarize: {
    section: "📄 REPORTES",
    description: "Generar resumen",
    requiredFields: [],
    optionalFields: ["projectRef"],
    fieldLabels: {},
    fieldHints: {},
    actionPrompt: "Voy a generar un resumen.",
    executionGuide: "✅ Se mostrará un resumen de la información.",
  },
};

/**
 * Obtener la configuración de prompt para una intención específica
 */
const FALLBACK_PROMPT: ActionPromptConfig = {
  section: "💬 CHAT",
  description: "Acción del agente",
  requiredFields: [],
  optionalFields: [],
  fieldLabels: {},
  fieldHints: {},
  actionPrompt: "Procesando tu solicitud.",
  executionGuide: "✅ Operación completada.",
};

export function getActionPromptConfig(intent: Intent): ActionPromptConfig {
  return ACTION_PROMPTS[intent] || FALLBACK_PROMPT;
}

/**
 * Obtener la sección donde va una acción
 */
export function getActionSection(intent: Intent): string {
  return getActionPromptConfig(intent).section;
}

/**
 * Generar mensaje de error cuando se confunde acción
 */
export function generateContextualWarning(intent: Intent, userText: string): string {
  const config = getActionPromptConfig(intent);
  return `⚠️ Detecté que querés **${config.description}** en la sección **${config.section}**. ${config.actionPrompt}`;
}

/**
 * Generar guía de ejecución
 */
export function generateExecutionGuide(intent: Intent): string {
  return getActionPromptConfig(intent).executionGuide;
}

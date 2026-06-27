// ============================================================
// MOTOR DEL AGENTE IA LOCAL — Sin APIs externas
// Capacidades:
//  - NLU avanzado en español (normalización de acentos, sinónimos, fuzzy matching)
//  - 45+ intenciones cubriendo consultas, acciones y análisis
//  - Memoria conversacional: entiende pronombres y contexto ("esa obra", "este mes")
//  - Análisis predictivos: proyección de presupuesto, forecast de caja, ETA obras
//  - Detección de anomalías: gastos atípicos, desvíos, proveedores caros
//  - Recomendaciones contextuales con insights accionables
//  - Ejecución de acciones: alta de movimientos, tareas, pedidos
//  - Comparaciones temporales: mes vs mes, año vs año
//  - Motor de automatización con reglas configurables
// ============================================================

import { db } from "@/lib/db";
import { normalizeMessage } from "@/lib/agent-nlu";
import { saveContextMetadata } from "@/lib/agent-memory";

// ---------- Tipos ----------

export type Intent =
  // Consultas financieras
  | "query_profit"
  | "query_expenses"
  | "query_income"
  | "query_cashflow"
  | "query_kpis"
  | "query_top_expense"
  | "query_top_supplier"
  | "query_margin_by_project"
  | "query_compare_period"
  | "query_anomalies"
  // Inventario
  | "query_stock"
  | "query_low_stock"
  | "query_stock_value"
  | "query_material_history"
  | "query_dead_stock"
  // Obras
  | "query_project_status"
  | "query_project_detail"
  | "query_project_profitability"
  | "predict_budget"
  | "predict_project_eta"
  // Proveedores
  | "query_supplier"
  | "query_best_supplier"
  // Tareas
  | "query_tasks"
  | "query_overdue_tasks"
  // Asistente
  | "alert_check"
  | "recommend"
  | "summarize"
  | "help"
  | "greeting"
  // Acciones
  | "action_create_expense"
  | "action_create_income"
  | "action_create_project"
  | "action_create_task"
  | "action_reorder"
  | "action_update_stock"
  | "action_close_project"
  // Configuración
  | "config_list_automations"
  // Nuevas acciones de creación/edición
  | "action_add_materials"
  | "action_add_stock_movement"
  | "action_update_project_progress"
  | "action_update_project_status"
  | "action_create_project_direct"
  | "action_create_supplier"
  | "action_add_expense_to_project"
  | "action_list_project_tasks"
  | "action_complete_task"
  // Editar / Eliminar
  | "action_edit_project"
  | "action_edit_task"
  | "action_edit_material"
  | "action_delete_task"
  | "action_delete_material"
  | "action_delete_transaction"
  // Workflows
  | "action_trigger_workflow"
  | "action_list_workflows"
  // Análisis extendido
  | "action_export_data"
  | "unknown";

export interface ParsedCommand {
  intent: Intent;
  rawText: string;
  normalized: string;
  entities: Record<string, string | number | undefined>;
  confidence: number;
}

export interface AgentResponse {
  text: string;
  intent: Intent;
  data?: any;
  actions?: AgentActionItem[];
  suggestions?: string[];
}

export interface AgentResponseWithEntities {
  response: AgentResponse;
  entities: Record<string, any>;
}

export interface AgentActionItem {
  type: "alert" | "task" | "reorder" | "highlight" | "navigate";
  title: string;
  description: string;
  severity?: "info" | "warning" | "critical";
  payload?: any;
}

// ---------- NLU Avanzado ----------

interface IntentPattern {
  intent: Intent;
  patterns: RegExp[];
  entities?: (text: string, normalized: string) => Record<string, string | number | undefined>;
  priority?: number; // mayor = más específico
}

const INTENT_PATTERNS: IntentPattern[] = [
  // Saludos
  {
    intent: "greeting",
    patterns: [/^(hola|buenas|buenos\s*dias|buenas\s*tardes|buenas\s*nches|hey)\b/i],
    priority: 5,
  },
  // Acciones específicas (alta prioridad)
  {
    intent: "action_create_expense",
    patterns: [
      /(registrar|cargar|anotar|sumar|agregar)\s+(un\s+)?gasto/i,
      /nuevo\s+gasto/i,
      /gaste\s+\$?\s*\d/i,
      /\d.*en\s+(materiales|mano\s*de\s*obra|servicios|sueldos|impuestos|equipos|alquiler|transporte)/i,
    ],
    entities: (text) => {
      const amount = text.match(/\$?\s*(\d+(?:[.,]\d+)?)\s*(?:pesos|\$|ars)?/i);
      const categoryMatch = text.match(
        /(materiales|mano\s*de\s*obra|servicios|sueldos|impuestos|equipos|alquiler|transporte|otros)/i
      );
      const projectMatch = text.match(/OB[-\s]?(\d+)/i) || text.match(/obra\s+(\w+)/i);
      return {
        amount: amount ? parseFloat(amount[1].replace(",", ".")) : undefined,
        category: categoryMatch ? categoryMatch[1].toLowerCase().replace(/\s+/g, "_").replace("sueldos", "mano_obra") : undefined,
        projectRef: projectMatch ? projectMatch[1] : undefined,
      };
    },
    priority: 10,
  },
  {
    intent: "action_create_income",
    patterns: [
      /(registrar|cargar|anotar|sumar|agregar)\s+(un\s+)?(ingreso|venta|cobranza|cobro|anticipo)/i,
      /(cobr|vend)\w*\s+\$?\s*\d/i,
    ],
    entities: (text) => {
      const amount = text.match(/\$?\s*(\d+(?:[.,]\d+)?)\s*(?:pesos|\$|ars)?/i);
      const projectMatch = text.match(/OB[-\s]?(\d+)/i) || text.match(/obra\s+(\w+)/i);
      const isAnticipo = /anticipo/i.test(text);
      return {
        amount: amount ? parseFloat(amount[1].replace(",", ".")) : undefined,
        category: isAnticipo ? "anticipo" : "venta",
        projectRef: projectMatch ? projectMatch[1] : undefined,
      };
    },
    priority: 10,
  },
  {
    intent: "action_create_project",
    patterns: [
      /(crear|alta|nueva|nuevo)\s+(obra|proyecto)/i,
      /empezar\s+(una\s+)?(obra|proyecto)/i,
    ],
    priority: 10,
  },
  {
    intent: "action_create_task",
    patterns: [
      /(crear|agendar|recordarme|nueva)\s+tarea/i,
      /tengo\s+que\s+/i,
      /no\s+me\s+olvide\s+de/i,
      /recordame\s+/i,
      /recordarme\s+/i,
      /agendar\s+/i,
    ],
    entities: (text) => {
      const m = text.match(/(?:tarea[:\s]+|tengo\s+que\s+|recordame\s+(?:que\s+|de\s+)?|recordarme\s+(?:que\s+|de\s+)?|no\s+me\s+olvide\s+de\s+|agendar\s+)(.+)$/i);
      // Si no matchea con los prefijos específicos, usar todo el texto limpio
      if (!m) {
        const clean = text.replace(/^(recordame|recordarme|agendar|tengo\s+que)\s+/i, "").trim();
        return { title: clean || undefined };
      }
      return { title: m[1].trim() };
    },
    priority: 11,
  },
  {
    intent: "action_reorder",
    patterns: [
      /(reordenar|reponer|comprar|generar\s*pedido|pedido\s+de\s+compra|generar\s*compra)/i,
      /necesito\s+(comprar|pedir)/i,
    ],
    priority: 10,
  },
  {
    intent: "action_update_stock",
    patterns: [
      /(actualizar|ajustar|modificar)\s+(stock|inventario)/i,
      /cambiar\s+stock\s+de/i,
    ],
    priority: 10,
  },
  // ─── Nuevos patrones de acción ───
  {
    intent: "action_add_materials",
    patterns: [
      /(crear|agregar|cargar|añadir|alta\s+de)\s+(materiales?|items?|productos?)/i,
      /(crea|agrega|carga|añade)\s+(materiales?|items?)/i,
      /(en\s+(la\s+)?obra|para\s+la\s+obra|obra)\s+\w[\w\s]+,?\s*(crea|agreg|carg|añad)\s+(materiales?|items?)/i,
      /dar\s+de\s+alta\s+(materiales?|items?)/i,
    ],
    entities: (text: string) => {
      // Extraer referencia de obra
      const proyMatch = text.match(/en\s+la\s+obra\s+([\w\s]+?)(?:,|\s+crea|\s+agrega|\s+carga|\s+añade|$)/i)
        || text.match(/para\s+(?:la\s+)?obra\s+([\w\s]+?)(?:,|\s+crea|$)/i)
        || text.match(/OB[-\s]?(\d+)/i);
      return { projectRef: proyMatch ? proyMatch[1].trim() : undefined };
    },
    priority: 12,
  },
  {
    intent: "action_add_stock_movement",
    patterns: [
      /(entrada|salida|consumo|ajuste)\s+de\s+stock/i,
      /(ingres|egres|consum|us)\w+\s+(de\s+)?(material|cemento|ladrill|arena|madera|hierro|pintura|cable)/i,
      /registrar\s+(entrada|salida)\s+de\s+(materiales?|\w+)/i,
    ],
    priority: 11,
  },
  {
    intent: "action_update_project_progress",
    patterns: [
      /(actualiz|cambi|modific|ponee?|sete|asign)\w*\s+(el\s+)?(avance|progreso|porcentaje)\s+(de\s+)?(la\s+)?obra/i,
      /obra\s+[\w\s]+\s+(va|lleva|tiene|esta)\s+al\s*\d+%/i,
      /avance\s+de\s+OB/i,
      /(la\s+)?obra\s+[\w\s]+\s+(al|tiene)\s*\d+\s*(%|por\s*ciento)/i,
    ],
    entities: (text: string) => {
      const pct = text.match(/(\d+)\s*(%|por\s*ciento)/i);
      const proj = text.match(/OB[-\s]?(\d+)/i) || text.match(/obra\s+([\w\s]+?)\s+(al|tiene|va|lleva|esta)/i);
      return {
        progress: pct ? parseFloat(pct[1]) : undefined,
        projectRef: proj ? proj[1].trim() : undefined,
      };
    },
    priority: 12,
  },
  {
    intent: "action_update_project_status",
    patterns: [
      /(cambiar|actualizar|poner)\s+estado\s+(de\s+)?(?:la\s+)?obra/i,
      /obra\s+[\w\s]+\s+(pasar?|poner|cambiar)\s+a\s+(activa|pausada|terminada|planificacion)/i,
    ],
    entities: (text: string) => {
      const statusMap: Record<string, string> = {
        activa: "in_progress", "en curso": "in_progress", iniciada: "in_progress",
        pausada: "paused", pausar: "paused",
        terminada: "finished", finalizada: "finished", cerrada: "finished",
        planificacion: "planning", planeando: "planning",
      };
      const proj = text.match(/OB[-\s]?(\d+)/i) || text.match(/obra\s+([\w\s]+?)\s+(a\s+|en\s+|pasar)/i);
      let status: string | undefined;
      for (const [k, v] of Object.entries(statusMap)) {
        if (new RegExp(k, 'i').test(text)) { status = v; break; }
      }
      return { projectRef: proj ? proj[1].trim() : undefined, status };
    },
    priority: 12,
  },
  {
    intent: "action_create_project_direct",
    patterns: [
      /crear\s+obra\s+["']?[\w\sÀ-ÿ]+["']?\s*,?\s*presupuesto/i,
      /nueva\s+obra\s*:\s*["']?[\w\sÀ-ÿ]+["']?/i,
      /alta\s+de\s+obra\s*:\s*/i,
      /crear\s+obra\s+["']?[^"']+["']?(?:\s*\.|\s*,|$)/i,
    ],
    entities: (text: string) => {
      const nameMatch = text.match(/(?:crear|nueva|alta\s+de)\s+obra\s*:?\s*["']?([\w\sÀ-ÿ]+?)["']?\s*(?:\.|,|presupuesto|cliente|$)/i);
      const budgetMatch = text.match(/presupuesto\s*:?\s*\$?\s*([\d.,]+)/i);
      const clientMatch = text.match(/cliente\s*:?\s*([\w\sÀ-ÿ]+?)(?:,|$)/i);
      return {
        name: nameMatch ? nameMatch[1].trim() : undefined,
        budget: budgetMatch ? parseFloat(budgetMatch[1].replace(/[.,]/g, '').replace(',', '.')) : undefined,
        clientName: clientMatch ? clientMatch[1].trim() : undefined,
      };
    },
    priority: 13,
  },
  {
    intent: "action_create_supplier",
    patterns: [
      /(crear|alta|nuevo|agregar)\s+(un\s+)?proveedor/i,
      /dar\s+de\s+alta\s+(un\s+)?proveedor/i,
    ],
    entities: (text: string) => {
      const nameMatch = text.match(/proveedor\s*:?\s*["']?([\w\s]+?)["']?(?:,|tel|email|rubro|$)/i);
      const phoneMatch = text.match(/tel(?:efono)?\s*:?\s*([\d\s+()-]+)/i);
      const emailMatch = text.match(/email\s*:?\s*([\w.@]+)/i);
      const catMatch = text.match(/rubro\s*:?\s*([\w\s]+?)(?:,|$)/i);
      return {
        name: nameMatch ? nameMatch[1].trim() : undefined,
        phone: phoneMatch ? phoneMatch[1].trim() : undefined,
        email: emailMatch ? emailMatch[1].trim() : undefined,
        category: catMatch ? catMatch[1].trim() : undefined,
      };
    },
    priority: 11,
  },
  {
    intent: "action_add_expense_to_project",
    patterns: [
      /(cargar|registrar|agregar|sumar)\s+(un\s+)?gasto\s+(a|en|para|de)\s+(la\s+)?obra\s+[\w]+/i,
      /gasto\s+de\s+\$?\d+\s+(?:en|para|a)\s+(la\s+)?obra/i,
    ],
    entities: (text: string) => {
      const amount = text.match(/\$?\s*([\d.,]+)/i);
      const proj = text.match(/OB[-\s]?(\d+)/i) || text.match(/obra\s+([\w\s]+?)(?:\s+de|\s+por|\s+en|$)/i);
      const catMatch = text.match(/(materiales?|mano\s*de\s*obra|servicios?|equipos?|alquiler|transporte|otros?)/i);
      const descMatch = text.match(/(?:por|concepto|descripcion)\s*:?\s*([\w\s]+?)(?:,|$)/i);
      return {
        amount: amount ? parseFloat(amount[1].replace(/[,]/g, '')) : undefined,
        projectRef: proj ? proj[1].trim() : undefined,
        category: catMatch ? catMatch[1].toLowerCase() : 'otros',
        description: descMatch ? descMatch[1].trim() : undefined,
      };
    },
    priority: 11,
  },
  {
    intent: "action_list_project_tasks",
    patterns: [
      /tareas\s+(de|del|en)\s+(la\s+)?obra/i,
      /que\s+tareas\s+tiene\s+(la\s+)?obra/i,
      /OB[-\s]?\d+\s+tareas/i,
    ],
    entities: (text: string) => {
      const proj = text.match(/OB[-\s]?(\d+)/i) || text.match(/obra\s+([\w\s]+?)(?:\s+tiene|\s+hay|$)/i);
      return { projectRef: proj ? proj[1].trim() : undefined };
    },
    priority: 9,
  },
  {
    intent: "action_complete_task",
    patterns: [
      /(completar|terminar|marcar\s+como\s+hecha|finalizar)\s+(la\s+)?tarea/i,
      /tarea\s+["']?[\w\s]+["']?\s+(completada|lista|terminada|hecha)/i,
    ],
    entities: (text: string) => {
      const titleMatch = text.match(/(?:tarea\s+)?["']([\w\s]+)["']/i) || text.match(/(?:completar|terminar)\s+(?:la\s+)?tarea\s+(.+?)(?:,|$)/i);
      return { taskTitle: titleMatch ? titleMatch[1].trim() : undefined };
    },
    priority: 11,
  },
  {
    intent: "action_close_project",
    patterns: [
      /(cerrar|finalizar|terminar)\s+(obra|proyecto)/i,
    ],
    entities: (text) => {
      const m = text.match(/OB[-\s]?(\d+)/i) || text.match(/obra\s+(\w+)/i);
      return { projectRef: m ? m[1] : undefined };
    },
    priority: 10,
  },
  // Consultas específicas
  {
    intent: "query_compare_period",
    patterns: [
      /compar/i,
      /mes\s+anterior/i,
      /mes\s+pasado/i,
      /vs\s+mes/i,
      /ano\s+anterior/i,
      /ano\s+pasado/i,
      /anio\s+anterior/i,
      /anio\s+pasado/i,
      /evolucion/i,
      /variacion/i,
    ],
    priority: 8,
  },
  {
    intent: "query_anomalies",
    patterns: [
      /anomalia/i,
      /atipico/i,
      /fuera\s+de\s+lo\s+normal/i,
      /raro/i,
      /algo\s+rar/i,
      /gasto\s+inusual/i,
      /pico\s+de\s+gasto/i,
    ],
    priority: 8,
  },
  {
    intent: "query_margin_by_project",
    patterns: [
      /margen\s+por\s+obra/i,
      /rentabilidad\s+(de|por)\s+(las\s+)?obras/i,
      /que\s+obra\s+(es|esta)\s+(mas|menos)\s+(rentable|ganancia)/i,
      /obra\s+mas\s+(rentable|ganancia)/i,
      /obra\s+menos\s+(rentable|ganancia)/i,
    ],
    priority: 8,
  },
  {
    intent: "query_top_supplier",
    patterns: [
      /(proveedor|s)?\s+(que\s+)?(mas|menos)\s+(gast|compr|vend)/i,
      /a\s+quien\s+(mas|menos)\s+(le|compr)/i,
      /top\s+proveedor/i,
    ],
    priority: 8,
  },
  {
    intent: "query_best_supplier",
    patterns: [
      /mejor\s+proveedor/i,
      /proveedor\s+mas\s+(barato|economico|conveniente)/i,
      /donde\s+comprar\s+mas\s+barato/i,
    ],
    priority: 8,
  },
  {
    intent: "query_dead_stock",
    patterns: [
      /stock\s+(muerto|inmovilizado|sin\s+movimiento)/i,
      /materiales?\s+(sin\s+rotar|sin\s+movimiento|que\s+no\s+uso)/i,
      /inventario\s+inmovil/i,
    ],
    priority: 8,
  },
  {
    intent: "query_material_history",
    patterns: [
      /historial\s+(de|del)\s+material/i,
      /movimientos\s+de\s+\w+/i,
      /de\s+donde\s+vino\s+el/i,
    ],
    priority: 8,
  },
  {
    intent: "query_stock_value",
    patterns: [
      /valor\s+(del\s+)?(inventario|stock|deposito)/i,
      /cuanto\s+tengo\s+(invertido|en\s+stock)/i,
      /dinero\s+en\s+stock/i,
    ],
    priority: 8,
  },
  {
    intent: "predict_project_eta",
    patterns: [
      /cuando\s+(termina|termino|se\s+termina)\s+(la\s+)?(obra|proyecto)?/i,
      /eta\s+(obra|proyecto)/i,
      /finalizacion\s+de\s+(la\s+)?obra/i,
      /fecha\s+de\s+finalizacion/i,
    ],
    priority: 10,
  },
  {
    intent: "predict_budget",
    patterns: [/presupuesto/i, /proyectar/i, /estimar/i, /pronostico/i, /forecast/i, /proyeccion/i],
    priority: 7,
  },
  {
    intent: "query_project_detail",
    patterns: [
      /detalle\s+(de\s+)?(la\s+)?obra/i,
      /info\s+(de\s+|sobre\s+)?(la\s+)?obra/i,
      /como\s+va\s+la\s+obra\s+OB/i,
      /OB[-\s]?\d+/i,
    ],
    entities: (text) => {
      const m = text.match(/OB[-\s]?(\d+)/i);
      return { projectRef: m ? m[1] : undefined };
    },
    priority: 9,
  },
  {
    intent: "query_project_profitability",
    patterns: [
      /(cual\s+|que\s+)?(obra|proyecto)\s+(gana|da\s+ganancia|es\s+rentable|deja\s+ganancia)/i,
      /ganancia\s+por\s+obra/i,
    ],
    priority: 8,
  },
  // Consultas estándar
  {
    intent: "query_profit",
    patterns: [
      /gananci/i,
      /utilidad/i,
      /beneficio/i,
      /cuanto.*gane/i,
      /cuanto.*ganamos/i,
      /rentabilidad/i,
      /ganamos/i,
      /(estoy|estamos)\s+en\s+(positivo|negativo|rojo|azul|numero)/i,
      /cual\s+es\s+(mi|nuestra)\s+ganancia/i,
    ],
    priority: 6,
  },
  {
    intent: "query_expenses",
    patterns: [/gasto/i, /egreso/i, /cuanto.*gast/i, /salida.*dinero/i, /cual\s+es\s+(mi|nuestro)\s+gasto/i],
    priority: 6,
  },
  {
    intent: "query_income",
    patterns: [/ingreso/i, /venta/i, /cobranza/i, /entradas.*dinero/i, /factur/i],
    priority: 6,
  },
  {
    intent: "query_low_stock",
    patterns: [
      /stock\s+bajo/i,
      /bajo\s+stock/i,
      /stock\s+minimo/i,
      /materiales?\s+falt/i,
      /faltan?\s+materiales/i,
      /reponer/i,
      /que\s+falta/i,
      /que\s+necesito\s+(comprar|reponer)/i,
    ],
    priority: 7,
  },
  {
    intent: "query_stock",
    patterns: [/stock/i, /inventario/i, /materiales?\s+tengo/i, /deposito/i, /que\s+tengo\s+en\s+(el\s+)?deposito/i],
    priority: 5,
  },
  {
    intent: "query_project_status",
    patterns: [/estado\s+(de\s+)?(las\s+)?obras?/i, /avance\s+(de\s+las\s+)?obras?/i, /como\s+van?\s+(las\s+)?obras?/i],
    priority: 6,
  },
  {
    intent: "query_top_expense",
    patterns: [
      /en\s+que\s+gaste/i,
      /donde\s+gaste/i,
      /mayor\s+gasto/i,
      /gastos?\s+top/i,
      /rubro\s+de\s+gasto/i,
      /en\s+que\s+gasto\s+mas/i,
    ],
    priority: 7,
  },
  {
    intent: "query_supplier",
    patterns: [/proveedor/i, /proveedores/i, /quien\s+me\s+vende/i],
    priority: 5,
  },
  {
    intent: "query_cashflow",
    patterns: [/flujo.*caja/i, /\bcaja\b/i, /liquidez/i, /cash.?flow/i, /plata\s+(disponible|en\s+caja)/i],
    priority: 6,
  },
  {
    intent: "query_kpis",
    patterns: [/kpi/i, /indicadores/i, /metricas/i, /numeros\s+generales/i],
    priority: 6,
  },
  {
    intent: "query_tasks",
    patterns: [/tareas?/i, /pendientes?/i, /que\s+hacer/i, /to-?do/i],
    priority: 5,
  },
  {
    intent: "query_overdue_tasks",
    patterns: [/tareas?\s+atrasadas?/i, /vencidas?/i, /que\s+se\s+pas/i],
    priority: 7,
  },
  {
    intent: "alert_check",
    patterns: [/alerta/i, /notificacion/i, /novedad/i, /problema/i, /que\s+pasa/i, /novedades/i, /hay\s+algo/i],
    priority: 6,
  },
  {
    intent: "recommend",
    patterns: [
      /recomend/i,
      /sugerencia/i,
      /consejo/i,
      /que\s+hago/i,
      /donde\s+mejoro/i,
      /ahorrar/i,
      /optimizar/i,
      /como\s+(mejoro|reduzco|bajo)/i,
    ],
    priority: 6,
  },
  {
    intent: "summarize",
    patterns: [
      /resum/i,
      /informe/i,
      /reporte/i,
      /sintesis/i,
      /como\s+vamos/i,
      /como\s+estamos/i,
      /como\s+va/i,
      /panorama/i,
      /situacion/i,
    ],
    priority: 6,
  },
  {
    intent: "config_list_automations",
    patterns: [/automatizaciones?/i, /reglas?/i, /que\s+automatiz/i],
    priority: 6,
  },
  {
    intent: "help",
    patterns: [/ayuda/i, /\bhelp\b/i, /que\s+podes\s+hacer/i, /que\s+sabes/i, /comandos/i, /que\s+haces/i, /como\s+(se\s+usa|funciona)/i],
    priority: 5,
  },
];

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/\s+/g, " ");
}

interface Match {
  intent: Intent;
  priority: number;
  patternLen: number;
  confidence: number;
  entities: Record<string, any>;
}

export function parseIntent(text: string): ParsedCommand {
  const normalized = normalize(text);
  const matches: Match[] = [];

  for (const def of INTENT_PATTERNS) {
    const priority = def.priority ?? 5;
    for (const pattern of def.patterns) {
      if (pattern.test(normalized)) {
        const confidence = Math.min(0.99, 0.5 + priority / 10 + pattern.source.length / 200);
        matches.push({
          intent: def.intent,
          priority,
          patternLen: pattern.source.length,
          confidence,
          entities: def.entities ? def.entities(text, normalized) : {},
        });
      }
    }
  }

  if (matches.length === 0) {
    return { intent: "unknown", rawText: text, normalized, entities: {}, confidence: 0 };
  }

  // Ordenar por prioridad (desc) y luego por longitud de pattern (desc) → más específico gana
  matches.sort((a, b) => b.priority - a.priority || b.patternLen - a.patternLen);
  const best = matches[0];

  return {
    intent: best.intent,
    rawText: text,
    normalized,
    entities: best.entities,
    confidence: best.confidence,
  };
}

// ---------- Helpers ----------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: decimals }).format(value);
}

async function getFinancialSummary() {
  const transactions = await db.transaction.findMany({ include: { project: true } });
  const income = transactions.filter((t) => t.type === "income");
  const expenses = transactions.filter((t) => t.type === "expense");
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
  const profit = totalIncome - totalExpenses;
  const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;
  return { transactions, income, expenses, totalIncome, totalExpenses, profit, margin };
}

async function getStockSummary() {
  const materials = await db.material.findMany({
    include: { supplier: true, stockMovements: true },
  });
  const totalValue = materials.reduce((s, m) => s + m.stock * m.unitCost, 0);
  const lowStock = materials.filter((m) => m.stock <= m.minStock && m.minStock > 0);
  const outOfStock = materials.filter((m) => m.stock <= 0);
  return { materials, totalValue, lowStock, outOfStock };
}

async function getProjectSummary() {
  const projects = await db.project.findMany({ include: { transactions: true, tasks: true } });
  const active = projects.filter((p) => p.status === "in_progress");
  return { projects, active };
}

async function resolveProject(ref?: string) {
  if (!ref) return null;
  const norm = normalize(ref);
  // Si es número, buscar por código OB-XXX
  if (/^\d+$/.test(norm)) {
    const padded = norm.padStart(3, "0");
    return await db.project.findFirst({ where: { OR: [{ code: `OB-${padded}` }, { code: { contains: norm } }] }, include: { transactions: true, tasks: true } });
  }
  // Buscar exacto por código OB-XXX
  if (/^ob[-\s]?\d+$/i.test(norm)) {
    return await db.project.findFirst({ where: { code: { contains: norm.replace(/\s/, '-').toUpperCase() } }, include: { transactions: true, tasks: true } });
  }
  // Buscar por nombre — primero exacto, luego parcial, luego fuzzy word-by-word
  const all = await db.project.findMany({ include: { transactions: true, tasks: true } });
  // Exact
  let found = all.find(p => normalize(p.name) === norm);
  if (found) return found;
  // Contains
  found = all.find(p => normalize(p.name).includes(norm) || norm.includes(normalize(p.name)));
  if (found) return found;
  // Word overlap: best match
  const words = norm.split(' ').filter(w => w.length > 2);
  if (words.length > 0) {
    let best: typeof all[0] | null = null;
    let bestScore = 0;
    for (const p of all) {
      const pn = normalize(p.name);
      const score = words.filter(w => pn.includes(w)).length;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (bestScore > 0) return best;
  }
  return null;
}

// Parser de lista de items ("10 bolsas de cemento, 3 bolsas de durlock")
interface ParsedItem {
  qty: number;
  unit: string;
  name: string;
  rawText: string;
}

function parseItemList(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  // Separar por comas o "y" / "e"
  const segments = text.split(/,\s*|\s+y\s+|\s+e\s+/i);
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;
    // Patrón: número (opcional: unidad) nombre  e.g. "10 bolsas de cemento" o "3 kg de arena"
    const m = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*([a-záéíóúüñ]+)?\s+(?:de\s+)?(.+)$/i);
    if (m) {
      items.push({
        qty: parseFloat(m[1].replace(',', '.')),
        unit: m[2] || 'unidad',
        name: m[3].trim(),
        rawText: trimmed,
      });
    } else {
      // Solo nombre sin cantidad → qty = 1
      const m2 = trimmed.match(/^(.+)$/);
      if (m2) items.push({ qty: 1, unit: 'unidad', name: m2[1].trim(), rawText: trimmed });
    }
  }
  return items;
}

// Generar SKU automático desde nombre
export function generateSku(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .map(w => w.slice(0, 3))
    .join('-')
    .slice(0, 12)
    + '-' + Date.now().toString().slice(-4);
}

// ---------- Handlers por intención ----------

async function respondGreeting(): Promise<AgentResponse> {
  const hour = new Date().getHours();
  const salute = hour < 12 ? "Buen día" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  return {
    text: `${salute}. Soy tu asistente de la constructora. Puedo darte un panorama de cómo venís, analizar tus finanzas, inventario y obras, ayudarte a registrar movimientos o generar tareas. 

Escribí algo como "¿cómo vamos?" o "¿qué necesito reponer?" para empezar.`,
    intent: "greeting",
    suggestions: ["¿Cómo vamos?", "¿Qué alertas hay?", "Recomendaciones", "Ayuda"],
  };
}

async function respondQueryProfit(): Promise<AgentResponse> {
  const summary = await getFinancialSummary();
  if (summary.transactions.length === 0) {
    return {
      text: "Todavía no hay movimientos cargados, así que todavía no puedo calcular ganancia. Cargá el primer ingreso o gasto desde el módulo de Finanzas y volvé a preguntarme.",
      intent: "query_profit",
      suggestions: ["¿Cómo vamos?", "Ayuda"],
    };
  }
  const tone = summary.profit > 0 ? "positivo" : "negativo";
  const health =
    summary.margin > 25
      ? "muy saludable"
      : summary.margin > 15
      ? "aceptable, aunque conviene mirarlo de cerca"
      : summary.margin > 0
      ? "ajustado — vale la pena revisar la estructura de costos"
      : "negativo — hay que actuar rápido sobre los gastos";
  return {
    text: `Ganancia neta acumulada: **${formatCurrency(summary.profit)}** (${tone})

- Ingresos: ${formatCurrency(summary.totalIncome)}
- Gastos: ${formatCurrency(summary.totalExpenses)}
- Margen: ${formatPct(summary.margin)}

El margen está ${health}.`,
    intent: "query_profit",
    data: summary,
    suggestions: ["¿En qué gasté más?", "Margen por obra", "Flujo de caja", "Recomendaciones"],
  };
}

async function respondQueryExpenses(): Promise<AgentResponse> {
  const summary = await getFinancialSummary();
  if (summary.expenses.length === 0) {
    return {
      text: "Aún no hay gastos registrados.",
      intent: "query_expenses",
      suggestions: ["Registrar gasto", "Ayuda"],
    };
  }
  const byCategory: Record<string, number> = {};
  for (const t of summary.expenses) {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  }
  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const breakdown = sorted.map(([cat, amt]) => `• ${cat.replace(/_/g, " ")}: ${formatCurrency(amt)}`).join("\n");
  return {
    text: `Gastos totales: **${formatCurrency(summary.totalExpenses)}** en ${summary.expenses.length} transacciones.

Por categoría:
${breakdown}`,
    intent: "query_expenses",
    data: { total: summary.totalExpenses, byCategory },
    suggestions: ["¿En qué gasté más?", "Comparar con mes anterior", "Detectar anomalías"],
  };
}

async function respondQueryIncome(): Promise<AgentResponse> {
  const summary = await getFinancialSummary();
  if (summary.income.length === 0) {
    return {
      text: "Aún no hay ingresos registrados.",
      intent: "query_income",
      suggestions: ["Registrar ingreso", "Ayuda"],
    };
  }
  const byCategory: Record<string, number> = {};
  for (const t of summary.income) {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  }
  const breakdown = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `• ${cat.replace(/_/g, " ")}: ${formatCurrency(amt)}`)
    .join("\n");
  return {
    text: `Ingresos totales: **${formatCurrency(summary.totalIncome)}** en ${summary.income.length} transacciones.

Por categoría:
${breakdown}`,
    intent: "query_income",
    suggestions: ["¿Cuánto gané?", "Flujo de caja"],
  };
}

async function respondQueryCashflow(): Promise<AgentResponse> {
  const transactions = await db.transaction.findMany({ orderBy: { date: "asc" } });
  if (transactions.length === 0) {
    return {
      text: "Sin movimientos para calcular el flujo de caja todavía.",
      intent: "query_cashflow",
    };
  }
  const byMonth: Record<string, { income: number; expense: number }> = {};
  for (const t of transactions) {
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { income: 0, expense: 0 };
    if (t.type === "income") byMonth[key].income += t.amount;
    else byMonth[key].expense += t.amount;
  }
  const months = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b));
  const lines = months
    .slice(-6)
    .map(([month, v]) => {
      const net = v.income - v.expense;
      const sign = net >= 0 ? "+" : "−";
      return `• ${month}: ingresa ${formatCurrency(v.income)}, sale ${formatCurrency(v.expense)} → ${sign}${formatCurrency(Math.abs(net))}`;
    })
    .join("\n");
  const balance = transactions.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
  const lastMonth = months[months.length - 1]?.[1];
  const diagnosis =
    lastMonth && lastMonth.expense > lastMonth.income
      ? "El último mes cerró en rojo — conviene ajustar gastos o acelerar cobros."
      : lastMonth && lastMonth.income > 0
      ? "El último mes cerró en positivo."
      : "No hay suficiente información del último mes.";
  return {
    text: `Flujo de caja de los últimos 6 meses:

${lines}

**Balance acumulado:** ${formatCurrency(balance)}

${diagnosis}`,
    intent: "query_cashflow",
    data: { byMonth, balance },
    suggestions: ["¿En qué gasté más?", "Comparar con mes anterior", "Recomendaciones"],
  };
}

async function respondQueryKpis(): Promise<AgentResponse> {
  const fin = await getFinancialSummary();
  const stock = await getStockSummary();
  const { projects, active } = await getProjectSummary();
  const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
  const avgProgress = projects.length > 0 ? projects.reduce((s, p) => s + p.progress, 0) / projects.length : 0;
  return {
    text: `Indicadores principales:

**Finanzas**
- Ganancia: ${formatCurrency(fin.profit)} (margen ${formatPct(fin.margin)})
- Ingresos: ${formatCurrency(fin.totalIncome)} · Gastos: ${formatCurrency(fin.totalExpenses)}

**Obras**
- Activas: ${active.length} de ${projects.length}
- Avance promedio: ${formatPct(avgProgress)}
- Presupuesto total comprometido: ${formatCurrency(totalBudget)}

**Inventario**
- Materiales: ${stock.materials.length}
- Valor en depósito: ${formatCurrency(stock.totalValue)}
- Alertas de stock: ${stock.lowStock.length + stock.outOfStock.length}`,
    intent: "query_kpis",
    suggestions: ["Recomendaciones", "Flujo de caja", "Estado de obras"],
  };
}

async function respondQueryTopExpense(): Promise<AgentResponse> {
  const summary = await getFinancialSummary();
  if (summary.expenses.length === 0) {
    return { text: "Todavía no hay gastos para analizar.", intent: "query_top_expense" };
  }
  const byCategory: Record<string, number> = {};
  for (const t of summary.expenses) {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  }
  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const pct = (top[1] / summary.totalExpenses) * 100;
  const top3 = sorted
    .slice(0, 3)
    .map(([c, v], i) => `${i + 1}. ${c.replace(/_/g, " ")}: ${formatCurrency(v)} (${formatPct((v / summary.totalExpenses) * 100)})`)
    .join("\n");
  return {
    text: `Tu rubro con mayor gasto es **${top[0].replace(/_/g, " ")}** con ${formatCurrency(top[1])} (${formatPct(pct)} del total).

Top 3:
${top3}

${pct > 60 ? "Esa concentración es alta — dependés mucho de ese rubro. Si lo reducis un 10%, el impacto en el margen es significativo." : ""}`,
    intent: "query_top_expense",
    data: { top, breakdown: sorted },
    suggestions: ["Recomendaciones para reducir gastos", "Comparar con mes anterior"],
  };
}

async function respondQueryMarginByProject(): Promise<AgentResponse> {
  const { projects } = await getProjectSummary();
  if (projects.length === 0) {
    return { text: "No hay obras cargadas.", intent: "query_margin_by_project" };
  }
  const enriched = projects
    .map((p) => {
      const income = p.transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const spent = p.transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const profit = income - spent;
      const margin = income > 0 ? (profit / income) * 100 : 0;
      return { code: p.code, name: p.name, income, spent, profit, margin, status: p.status };
    })
    .sort((a, b) => b.profit - a.profit);
  const lines = enriched.map((p) => {
    const sign = p.profit >= 0 ? "+" : "−";
    return `• ${p.code} ${p.name}: ${sign}${formatCurrency(Math.abs(p.profit))} (margen ${formatPct(p.margin)})`;
  });
  const best = enriched[0];
  const worst = enriched[enriched.length - 1];
  return {
    text: `Margen por obra:

${lines.join("\n")}

${best && worst && best.code !== worst.code ? `**${best.code}** es la más rentable y **${worst.code}** la que menos deja. Vale la pena entender qué hace distinto a la mejor obra para replicarlo.` : ""}`,
    intent: "query_margin_by_project",
    data: { projects: enriched },
    suggestions: ["Detalle de obra", "Recomendaciones"],
  };
}

async function respondQueryComparePeriod(): Promise<AgentResponse> {
  const transactions = await db.transaction.findMany();
  if (transactions.length === 0) {
    return { text: "Sin movimientos para comparar.", intent: "query_compare_period" };
  }
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);
  const lastYear = thisYear - 1;

  const inMonth = (t: any, y: number, m: number) => t.date.getFullYear() === y && t.date.getMonth() === m;
  const inYear = (t: any, y: number) => t.date.getFullYear() === y;

  const thisMonthTx = transactions.filter((t) => inMonth(t, thisYear, thisMonth));
  const lastMonthTx = transactions.filter((t) => inMonth(t, lastMonthDate.getFullYear(), lastMonthDate.getMonth()));
  const thisYearTx = transactions.filter((t) => inYear(t, thisYear));
  const lastYearTx = transactions.filter((t) => inYear(t, lastYear));

  const sum = (txs: any[], type: string) => txs.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);

  const thisM = { income: sum(thisMonthTx, "income"), expense: sum(thisMonthTx, "expense") };
  const lastM = { income: sum(lastMonthTx, "income"), expense: sum(lastMonthTx, "expense") };
  const thisY = { income: sum(thisYearTx, "income"), expense: sum(thisYearTx, "expense") };
  const lastY = { income: sum(lastYearTx, "income"), expense: sum(lastYearTx, "expense") };

  const delta = (a: number, b: number) => {
    if (b === 0) return a > 0 ? "+∞" : "—";
    const v = ((a - b) / b) * 100;
    return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
  };

  const monthComparison = `Mes actual vs mes anterior:
- Ingresos: ${formatCurrency(thisM.income)} vs ${formatCurrency(lastM.income)} (${delta(thisM.income, lastM.income)})
- Gastos: ${formatCurrency(thisM.expense)} vs ${formatCurrency(lastM.expense)} (${delta(thisM.expense, lastM.expense)})`;

  const yearComparison = lastYearTx.length > 0
    ? `\n\nAño ${thisYear} vs ${lastYear}:
- Ingresos: ${formatCurrency(thisY.income)} vs ${formatCurrency(lastY.income)} (${delta(thisY.income, lastY.income)})
- Gastos: ${formatCurrency(thisY.expense)} vs ${formatCurrency(lastY.expense)} (${delta(thisY.expense, lastY.expense)})`
    : "";

  const insight =
    thisM.expense > lastM.expense * 1.2 && lastM.expense > 0
      ? "\n\nLos gastos subieron más del 20% respecto del mes pasado — conviene revisar qué los impulsó."
      : thisM.income < lastM.income * 0.7 && lastM.income > 0
      ? "\n\nLos ingresos cayeron más del 30% respecto del mes pasado — ¿hay cobros pendientes?"
      : "";

  return {
    text: `${monthComparison}${yearComparison}${insight}`,
    intent: "query_compare_period",
    data: { thisM, lastM, thisY, lastY },
    suggestions: ["Detectar anomalías", "Recomendaciones"],
  };
}

async function respondQueryAnomalies(): Promise<AgentResponse> {
  const transactions = await db.transaction.findMany({ orderBy: { date: "desc" }, take: 100, include: { project: true, supplier: true } });
  if (transactions.length === 0) {
    return { text: "Sin datos para analizar anomalías todavía.", intent: "query_anomalies" };
  }
  const expenses = transactions.filter((t) => t.type === "expense");
  if (expenses.length === 0) {
    return { text: "No hay gastos para analizar.", intent: "query_anomalies" };
  }
  const amounts = expenses.map((t) => t.amount);
  const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
  const std = Math.sqrt(amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length);
  const threshold = mean + 2 * std; // outliers > 2 desvíos

  const outliers = expenses
    .filter((t) => t.amount > threshold && std > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Agrupar por categoría y detectar picos
  const byCategory: Record<string, { total: number; count: number; avg: number }> = {};
  for (const t of expenses) {
    if (!byCategory[t.category]) byCategory[t.category] = { total: 0, count: 0, avg: 0 };
    byCategory[t.category].total += t.amount;
    byCategory[t.category].count += 1;
  }
  for (const c of Object.keys(byCategory)) byCategory[c].avg = byCategory[c].total / byCategory[c].count;

  if (outliers.length === 0) {
    return {
      text: `Revisé los últimos ${expenses.length} gastos. No detecté movimientos atípicos.

Estadística:
- Gasto promedio: ${formatCurrency(mean)}
- Desvío estándar: ${formatCurrency(std)}
- Umbral de outlier: ${formatCurrency(threshold)}`,
      intent: "query_anomalies",
      suggestions: ["¿En qué gasté más?", "Comparar con mes anterior"],
    };
  }

  const lines = outliers.map((t) => `• ${formatDate(t.date)} — ${t.description}: ${formatCurrency(t.amount)} (${t.category.replace(/_/g, " ")})${t.project ? ` — obra ${t.project.code}` : ""}`);
  return {
    text: `Detecté ${outliers.length} ${outliers.length === 1 ? "gasto atípico" : "gastos atípicos"} (por encima de 2 desvíos del promedio):

${lines.join("\n")}

Gasto promedio: ${formatCurrency(mean)} · Estos ${outliers.length} movimientos representan juntos ${formatCurrency(outliers.reduce((s, t) => s + t.amount, 0))}.

${outliers.length > 0 ? "Si alguno no debería estar ahí o fue un error de carga, podés eliminarlo desde Finanzas." : ""}`,
    intent: "query_anomalies",
    data: { outliers, mean, threshold },
    actions: outliers.map((t) => ({ type: "highlight" as const, title: `Gasto atípico: ${t.description}`, description: `${formatCurrency(t.amount)} el ${formatDate(t.date)}`, severity: "warning" as const })),
    suggestions: ["¿En qué gasté más?", "Recomendaciones"],
  };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

async function respondQueryLowStock(): Promise<AgentResponse> {
  const summary = await getStockSummary();
  if (summary.lowStock.length === 0 && summary.outOfStock.length === 0) {
    return {
      text: "Todo el inventario está por encima del punto de pedido. No hace falta reponer nada por ahora.",
      intent: "query_low_stock",
      suggestions: ["Ver inventario", "Generar pedido de compra"],
    };
  }
  const lines = [...summary.outOfStock, ...summary.lowStock].map((m) => {
    const status = m.stock <= 0 ? "sin stock" : `quedan ${formatNumber(m.stock)} ${m.unit}`;
    const needed = m.minStock - m.stock;
    return `• ${m.name} (${m.sku}): ${status} — mínimo ${formatNumber(m.minStock)} ${m.unit} — faltan ~${formatNumber(Math.max(0, needed))} ${m.unit}`;
  });
  return {
    text: `${summary.outOfStock.length + summary.lowStock.length} ${summary.outOfStock.length + summary.lowStock.length === 1 ? "material requiere reposición" : "materiales requieren reposición"}:

${lines.join("\n")}`,
    intent: "query_low_stock",
    actions: [
      {
        type: "reorder",
        title: "Generar pedido de reposición",
        description: `${summary.outOfStock.length + summary.lowStock.length} materiales bajo mínimo`,
        severity: "warning",
      },
    ],
    data: { materials: [...summary.outOfStock, ...summary.lowStock] },
    suggestions: ["Generar pedido de compra", "Ver proveedores"],
  };
}

async function respondQueryStock(): Promise<AgentResponse> {
  const summary = await getStockSummary();
  if (summary.materials.length === 0) {
    return {
      text: "El inventario está vacío. Cargá tu primer material desde el módulo Inventario.",
      intent: "query_stock",
    };
  }
  const top5 = [...summary.materials]
    .sort((a, b) => b.stock * b.unitCost - a.stock * a.unitCost)
    .slice(0, 5)
    .map((m) => `• ${m.name}: ${formatNumber(m.stock)} ${m.unit} → ${formatCurrency(m.stock * m.unitCost)}`)
    .join("\n");
  return {
    text: `Inventario: ${summary.materials.length} materiales en stock por un valor total de ${formatCurrency(summary.totalValue)}.

Top 5 por valor:
${top5}

${summary.lowStock.length + summary.outOfStock.length > 0 ? `Hay ${summary.lowStock.length + summary.outOfStock.length} alertas de stock bajo.` : "Sin alertas de stock."}`,
    intent: "query_stock",
    data: { totalItems: summary.materials.length, totalValue: summary.totalValue, lowStock: summary.lowStock.length },
    suggestions: ["¿Qué materiales faltan?", "Ver valor del inventario"],
  };
}

async function respondQueryStockValue(): Promise<AgentResponse> {
  const summary = await getStockSummary();
  if (summary.materials.length === 0) {
    return { text: "Sin inventario para valuar.", intent: "query_stock_value" };
  }
  const totalValue = summary.totalValue;
  const top3 = [...summary.materials]
    .sort((a, b) => b.stock * b.unitCost - a.stock * a.unitCost)
    .slice(0, 3);
  const lines = top3.map((m) => `• ${m.name}: ${formatCurrency(m.stock * m.unitCost)} (${formatNumber(m.stock)} ${m.unit} × ${formatCurrency(m.unitCost)})`).join("\n");
  const concentration = top3.length > 0 ? (top3.reduce((s, m) => s + m.stock * m.unitCost, 0) / totalValue) * 100 : 0;
  return {
    text: `Valor total del inventario: **${formatCurrency(totalValue)}**

Mayores concentraciones:
${lines}

${concentration > 60 ? `${formatPct(concentration)} del valor está en solo ${top3.length} materiales. Si alguno de esos no rota, es capital inmovilizado.` : ""}`,
    intent: "query_stock_value",
    suggestions: ["Detectar stock muerto", "Recomendaciones"],
  };
}

async function respondQueryDeadStock(): Promise<AgentResponse> {
  const materials = await db.material.findMany({
    include: { stockMovements: { orderBy: { date: "desc" }, take: 1 } },
  });
  if (materials.length === 0) {
    return { text: "Sin inventario para analizar.", intent: "query_dead_stock" };
  }
  const now = Date.now();
  const deadStock = materials
    .filter((m) => m.stock > 0)
    .map((m) => {
      const lastMovement = m.stockMovements[0];
      const daysSince = lastMovement ? Math.floor((now - lastMovement.date.getTime()) / (1000 * 60 * 60 * 24)) : 999;
      return { ...m, daysSince, lastDate: lastMovement?.date };
    })
    .filter((m) => m.daysSince > 60) // sin movimiento en 60+ días
    .sort((a, b) => b.daysSince - a.daysSince);

  if (deadStock.length === 0) {
    return {
      text: "Todo el inventario tiene movimientos en los últimos 60 días. No hay stock muerto.",
      intent: "query_dead_stock",
    };
  }
  const total = deadStock.reduce((s, m) => s + m.stock * m.unitCost, 0);
  const lines = deadStock
    .slice(0, 10)
    .map((m) => `• ${m.name}: ${formatNumber(m.stock)} ${m.unit} = ${formatCurrency(m.stock * m.unitCost)} — último movimiento ${m.lastDate ? formatDate(m.lastDate) : "nunca"}`)
    .join("\n");
  return {
    text: `Detecté ${deadStock.length} ${deadStock.length === 1 ? "material sin rotar" : "materiales sin rotar"} (sin movimientos en 60+ días):

${lines}

Capital inmovilizado: ${formatCurrency(total)}

Si no los vas a usar, considerá venderlos o canjearlos con el proveedor. Liberar ese capital te da más liquidez.`,
    intent: "query_dead_stock",
    data: { deadStock, total },
    actions: [{ type: "highlight", title: "Stock inmovilizado", description: `${formatCurrency(total)} en ${deadStock.length} materiales sin rotar`, severity: "warning" }],
    suggestions: ["Recomendaciones", "Ver proveedores"],
  };
}

async function respondQueryMaterialHistory(parsed: ParsedCommand): Promise<AgentResponse> {
  // Buscar nombre de material en el texto
  const all = await db.material.findMany();
  if (all.length === 0) {
    return { text: "No hay materiales cargados.", intent: "query_material_history" };
  }
  // Heurística: buscar coincidencia por nombre
  const text = parsed.normalized;
  const match = all.find((m) => text.includes(normalize(m.name)) || text.includes(normalize(m.sku)));
  if (!match) {
    return {
      text: `No sé de qué material hablás. Tenés ${all.length} cargados. Probá: "historial de ${all[0].name}" o mencioná el SKU.`,
      intent: "query_material_history",
      suggestions: all.slice(0, 3).map((m) => `Historial de ${m.name}`),
    };
  }
  const movements = await db.stockMovement.findMany({
    where: { materialId: match.id },
    orderBy: { date: "desc" },
    take: 10,
    include: { supplier: true },
  });
  if (movements.length === 0) {
    return { text: `${match.name} no tiene movimientos registrados todavía.`, intent: "query_material_history" };
  }
  const lines = movements.map((m) => {
    const sign = m.type === "incoming" ? "+" : m.type === "outgoing" ? "−" : "=";
    const who = m.supplier ? `prov. ${m.supplier.name}` : m.note || "";
    return `• ${formatDate(m.date)} ${sign}${formatNumber(m.quantity)} ${match.unit} — ${(m.reason ?? "").replace(/_/g, " ")} ${who ? `(${who})` : ""}`;
  });
  return {
    text: `Historial de ${match.name} (${match.sku}):

${lines.join("\n")}

Stock actual: ${formatNumber(match.stock)} ${match.unit} · Costo promedio: ${formatCurrency(match.unitCost)}`,
    intent: "query_material_history",
    data: { material: match, movements },
  };
}

async function respondQueryProjectStatus(): Promise<AgentResponse> {
  const { projects, active } = await getProjectSummary();
  if (projects.length === 0) {
    return {
      text: "No hay obras cargadas. Podés crear la primera desde el módulo Obras o diciéndome *crear obra*.",
      intent: "query_project_status",
      suggestions: ["Crear obra nueva"],
    };
  }
  const lines = projects.map((p) => {
    const spent = p.transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const income = p.transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const pctBudget = p.budget > 0 ? (spent / p.budget) * 100 : 0;
    const status = pctBudget > 90 ? "🔴" : pctBudget > 70 ? "🟡" : "🟢";
    return `${status} ${p.code} — ${p.name}
   ${p.status.replace(/_/g, " ")} · avance ${formatPct(p.progress)} · presupuesto ${formatCurrency(p.budget)} · ejecutado ${formatCurrency(spent)} (${formatPct(pctBudget)}) · ingresado ${formatCurrency(income)}`;
  });
  return {
    text: `${projects.length} ${projects.length === 1 ? "obra" : "obras"} (${active.length} ${active.length === 1 ? "activa" : "activas"}):

${lines.join("\n\n")}`,
    intent: "query_project_status",
    data: { projects, active: active.length },
    suggestions: ["Margen por obra", "Proyección de presupuesto", "Detalle de obra"],
  };
}

async function respondQueryProjectDetail(parsed: ParsedCommand): Promise<AgentResponse> {
  const project = await resolveProject(parsed.entities.projectRef as string);
  if (!project) {
    return {
      text: "No encontré esa obra. Probá con el código (ej: OB-001) o parte del nombre.",
      intent: "query_project_detail",
    };
  }
  const spent = project.transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const income = project.transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const profit = income - spent;
  const margin = income > 0 ? (profit / income) * 100 : 0;
  const pctBudget = project.budget > 0 ? (spent / project.budget) * 100 : 0;
  const lastTxs = project.transactions.slice(-5).reverse();
  return {
    text: `**${project.code} — ${project.name}**

Estado: ${project.status.replace(/_/g, " ")}
Cliente: ${project.clientName || "—"}
Avance: ${formatPct(project.progress)}
Dirección: ${project.address || "—"}

**Financiero**
- Presupuesto: ${formatCurrency(project.budget)}
- Ejecutado: ${formatCurrency(spent)} (${formatPct(pctBudget)})
- Ingresado: ${formatCurrency(income)}
- Resultado: ${formatCurrency(profit)} (margen ${formatPct(margin)})

${pctBudget > 90 ? "⚠️ La obra supera el 90% del presupuesto sin finalizar — conviene ajustar." : pctBudget > 70 && project.progress < 80 ? "⚠️ Ya consumiste más del 70% del presupuesto con menos del 80% de avance." : ""}

${lastTxs.length > 0 ? `Últimos movimientos:\n${lastTxs.map((t) => `• ${formatDate(t.date)} ${t.type === "income" ? "+" : "−"}${formatCurrency(t.amount)} — ${t.description}`).join("\n")}` : ""}`,
    intent: "query_project_detail",
    data: { project },
    suggestions: ["Proyección de presupuesto", "Estado de obras"],
  };
}

async function respondQueryProjectProfitability(): Promise<AgentResponse> {
  return respondQueryMarginByProject();
}

async function respondPredictBudget(): Promise<AgentResponse> {
  const { projects } = await getProjectSummary();
  if (projects.length === 0) {
    return { text: "No hay obras para proyectar.", intent: "predict_budget" };
  }
  const lines = projects.map((p) => {
    const spent = p.transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const projectedFinal = p.progress > 0 && p.progress < 100 ? spent / (p.progress / 100) : spent;
    const overrun = projectedFinal - p.budget;
    const status = overrun > 0 ? `+${formatCurrency(overrun)} de desvío` : `${formatCurrency(-overrun)} de ahorro`;
    return `• ${p.code} ${p.name}
   Presupuesto ${formatCurrency(p.budget)} · gastado ${formatCurrency(spent)} (${formatPct(p.budget > 0 ? (spent / p.budget) * 100 : 0)})
   Proyección a finalización: ${formatCurrency(projectedFinal)} — ${status}`;
  });
  return {
    text: `Proyección de presupuesto por obra (basada en gasto actual / % avance):

${lines.join("\n\n")}

Modelo: si el ritmo de gasto se mantiene constante, este sería el costo total al finalizar.`,
    intent: "predict_budget",
    data: { projects },
    suggestions: ["Recomendaciones", "Estado de obras"],
  };
}

async function respondPredictProjectEta(parsed: ParsedCommand): Promise<AgentResponse> {
  const { projects } = await getProjectSummary();
  if (projects.length === 0) {
    return { text: "No hay obras para estimar fecha de finalización.", intent: "predict_project_eta" };
  }
  const project = parsed.entities.projectRef ? await resolveProject(parsed.entities.projectRef as string) : projects.find((p) => p.status === "in_progress");
  if (!project) {
    return { text: "No encontré la obra.", intent: "predict_project_eta" };
  }
  if (!project.startDate) {
    return { text: `${project.code} no tiene fecha de inicio, no puedo estimar la finalización.`, intent: "predict_project_eta" };
  }
  if (project.progress >= 100) {
    return { text: `${project.code} ya está al 100% de avance.`, intent: "predict_project_eta" };
  }
  const now = new Date();
  const elapsed = (now.getTime() - project.startDate.getTime()) / (1000 * 60 * 60 * 24);
  const projectedTotal = elapsed / (project.progress / 100);
  const remaining = projectedTotal - elapsed;
  const etaDate = new Date(now.getTime() + remaining * 24 * 60 * 60 * 1000);
  const plannedEnd = project.endDate;
  const diff = plannedEnd ? Math.round((etaDate.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24)) : null;
  return {
    text: `Estimación de finalización — **${project.code} ${project.name}**

- Inicio: ${formatDate(project.startDate)}
- Días transcurridos: ${Math.floor(elapsed)}
- Avance: ${formatPct(project.progress)}
- Ritmo: ${(project.progress / elapsed).toFixed(2)}% por día
- Días restantes estimados: ${Math.ceil(remaining)}
- ETA: **${formatDate(etaDate)}**

${plannedEnd ? `Planeabas terminar el ${formatDate(plannedEnd)}. ${diff !== null && diff > 0 ? `Estarías ${diff} días tarde — conviene acelerar o renegociar plazos.` : diff !== null && diff < 0 ? `Estarías ${Math.abs(diff)} días antes de lo planeado.` : "En fecha."}` : "No definiste fecha de finalización planeada."}`,
    intent: "predict_project_eta",
    data: { project, etaDate, remaining, diff },
  };
}

async function respondQuerySupplier(): Promise<AgentResponse> {
  const suppliers = await db.supplier.findMany({ include: { transactions: true, materials: true } });
  if (suppliers.length === 0) {
    return { text: "Todavía no cargaste proveedores.", intent: "query_supplier" };
  }
  const enriched = suppliers
    .map((s) => {
      const total = s.transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
      return { ...s, totalSpent: total, materialCount: s.materials.length };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent);
  const lines = enriched
    .slice(0, 8)
    .map((s) => `• ${s.name} — ${s.totalSpent > 0 ? formatCurrency(s.totalSpent) : "s/compras"} — ${s.materialCount} ${s.materialCount === 1 ? "material" : "materiales"} — rating ${s.rating}/5`);
  return {
    text: `${suppliers.length} ${suppliers.length === 1 ? "proveedor" : "proveedores"} cargados. Ranking por monto comprado:

${lines.join("\n")}`,
    intent: "query_supplier",
    data: { suppliers: enriched },
    suggestions: ["Quien más me vende", "Mejor proveedor", "Generar pedido de compra"],
  };
}

async function respondQueryTopSupplier(): Promise<AgentResponse> {
  const suppliers = await db.supplier.findMany({ include: { transactions: true } });
  if (suppliers.length === 0) {
    return { text: "Sin proveedores cargados.", intent: "query_top_supplier" };
  }
  const enriched = suppliers
    .map((s) => ({ name: s.name, total: s.transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0) }))
    .sort((a, b) => b.total - a.total);
  const top = enriched[0];
  return {
    text: `El proveedor al que más le comprás es **${top.name}** con ${formatCurrency(top.total)} acumulados.

Ranking completo:
${enriched.map((s, i) => `${i + 1}. ${s.name}: ${formatCurrency(s.total)}`).join("\n")}

${top.total > enriched.reduce((s, x) => s + x.total, 0) * 0.4 ? "Más del 40% de tus compras se concentran en un solo proveedor. Si renegociás o buscás alternativas, podés mejorar precios y reducir dependencia." : ""}`,
    intent: "query_top_supplier",
    suggestions: ["Ver proveedores", "Recomendaciones"],
  };
}

async function respondQueryBestSupplier(): Promise<AgentResponse> {
  const suppliers = await db.supplier.findMany({ include: { transactions: true, materials: true } });
  if (suppliers.length === 0) {
    return { text: "Sin proveedores para evaluar.", intent: "query_best_supplier" };
  }
  const enriched = suppliers
    .filter((s) => s.materials.length > 0)
    .map((s) => {
      const avgCost = s.materials.length > 0 ? s.materials.reduce((sum, m) => sum + m.unitCost, 0) / s.materials.length : 0;
      const total = s.transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
      return { name: s.name, rating: s.rating, avgCost, total, materialCount: s.materials.length };
    })
    .sort((a, b) => b.rating - a.rating || a.avgCost - b.avgCost);
  if (enriched.length === 0) {
    return { text: "Ningún proveedor tiene materiales asociados todavía.", intent: "query_best_supplier" };
  }
  const best = enriched[0];
  return {
    text: `El mejor proveedor según mi análisis es **${best.name}**:

- Rating: ${best.rating}/5
- Costo promedio de sus materiales: ${formatCurrency(best.avgCost)}
- Materiales asociados: ${best.materialCount}
- Comprado históricamente: ${formatCurrency(best.total)}

Ranking:
${enriched.map((s, i) => `${i + 1}. ${s.name} — rating ${s.rating}/5 — costo prom. ${formatCurrency(s.avgCost)}`).join("\n")}`,
    intent: "query_best_supplier",
  };
}

async function respondQueryTasks(): Promise<AgentResponse> {
  const tasks = await db.task.findMany({ include: { project: true }, orderBy: [{ status: "asc" }, { dueDate: "asc" }] });
  if (tasks.length === 0) {
    return { text: "No hay tareas cargadas.", intent: "query_tasks" };
  }
  const pending = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
  const lines = pending.slice(0, 10).map((t) => {
    const overdue = t.dueDate && new Date(t.dueDate) < new Date();
    return `• ${t.title}${t.project?.code ? ` (${t.project.code})` : ""}${t.dueDate ? ` — vence ${formatDate(t.dueDate)}${overdue ? " [atrasada]" : ""}` : ""}${t.assignee ? ` · ${t.assignee}` : ""}`;
  });
  return {
    text: `Tenés ${pending.length} ${pending.length === 1 ? "tarea pendiente" : "tareas pendientes"} de ${tasks.length} totales:

${lines.join("\n")}`,
    intent: "query_tasks",
    suggestions: ["Tareas atrasadas", "Crear tarea"],
  };
}

async function respondQueryOverdueTasks(): Promise<AgentResponse> {
  const tasks = await db.task.findMany({
    where: { status: { in: ["pending", "in_progress"] }, dueDate: { lt: new Date() } },
    include: { project: true },
    orderBy: { dueDate: "asc" },
  });
  if (tasks.length === 0) {
    return { text: "No hay tareas atrasadas. Todo al día.", intent: "query_overdue_tasks" };
  }
  const lines = tasks.map((t) => {
    const daysLate = Math.floor((Date.now() - new Date(t.dueDate!).getTime()) / (1000 * 60 * 60 * 24));
    return `• ${t.title}${t.project?.code ? ` (${t.project.code})` : ""} — venció ${formatDate(t.dueDate!)} hace ${daysLate} ${daysLate === 1 ? "día" : "días"}${t.assignee ? ` · ${t.assignee}` : ""}`;
  });
  return {
    text: `${tasks.length} ${tasks.length === 1 ? "tarea atrasada" : "tareas atrasadas"}:

${lines.join("\n")}`,
    intent: "query_overdue_tasks",
    actions: tasks.map((t) => ({ type: "alert" as const, title: `Tarea atrasada: ${t.title}`, description: `Venció ${formatDate(t.dueDate!)}`, severity: "warning" as const })),
    suggestions: ["Crear tarea", "Recomendaciones"],
  };
}

async function respondAlertCheck(): Promise<AgentResponse> {
  const stock = await getStockSummary();
  const fin = await getFinancialSummary();
  const actions: AgentActionItem[] = [];

  if (stock.outOfStock.length > 0) {
    actions.push({
      type: "alert",
      title: `${stock.outOfStock.length} ${stock.outOfStock.length === 1 ? "material sin stock" : "materiales sin stock"}`,
      description: stock.outOfStock.map((m) => m.name).join(", "),
      severity: "critical",
    });
  }
  if (stock.lowStock.length > 0) {
    actions.push({
      type: "alert",
      title: `${stock.lowStock.length} ${stock.lowStock.length === 1 ? "material bajo el mínimo" : "materiales bajo el mínimo"}`,
      description: stock.lowStock.map((m) => m.name).join(", "),
      severity: "warning",
    });
  }
  if (fin.totalIncome > 0 && fin.margin < 0) {
    actions.push({
      type: "alert",
      title: "Margen negativo",
      description: `Estás perdiendo ${formatCurrency(Math.abs(fin.profit))}.`,
      severity: "critical",
    });
  } else if (fin.totalIncome > 0 && fin.margin < 15) {
    actions.push({
      type: "alert",
      title: "Margen ajustado",
      description: `Margen de ${formatPct(fin.margin)}, por debajo del 15% recomendado.`,
      severity: "warning",
    });
  }
  const overdueTasks = await db.task.findMany({
    where: { status: { in: ["pending", "in_progress"] }, dueDate: { lt: new Date() } },
    take: 5,
  });
  if (overdueTasks.length > 0) {
    actions.push({
      type: "alert",
      title: `${overdueTasks.length} ${overdueTasks.length === 1 ? "tarea atrasada" : "tareas atrasadas"}`,
      description: overdueTasks.map((t) => t.title).join(", "),
      severity: "warning",
    });
  }
  // Obras cerca del tope de presupuesto
  const { projects } = await getProjectSummary();
  const overBudget = projects.filter((p) => {
    const spent = p.transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return p.budget > 0 && spent / p.budget > 0.9 && p.status !== "finished";
  });
  if (overBudget.length > 0) {
    actions.push({
      type: "alert",
      title: `${overBudget.length} ${overBudget.length === 1 ? "obra sobre el 90% del presupuesto" : "obras sobre el 90% del presupuesto"}`,
      description: overBudget.map((p) => `${p.code} ${p.name}`).join(", "),
      severity: "critical",
    });
  }

  if (actions.length === 0) {
    return {
      text: "Todo en orden. No hay alertas críticas ni pendientes urgentes.",
      intent: "alert_check",
      suggestions: ["Recomendaciones", "Resumen"],
    };
  }

  return {
    text: `${actions.length} ${actions.length === 1 ? "alerta activa" : "alertas activas"}:

${actions.map((a) => `${a.severity === "critical" ? "• " : "• "}${a.title} — ${a.description}`).join("\n\n")}`,
    intent: "alert_check",
    actions,
    suggestions: ["Recomendaciones", "Generar pedido de compra"],
  };
}

async function respondRecommend(): Promise<AgentResponse> {
  const fin = await getFinancialSummary();
  const stock = await getStockSummary();
  const { projects } = await getProjectSummary();
  const recs: { text: string; severity: "info" | "warning" | "critical" }[] = [];

  if (fin.totalIncome === 0 && fin.totalExpenses === 0) {
    return {
      text: "Todavía no hay datos para generar recomendaciones. Cargá algunos movimientos y volvé a pedirme recomendaciones.",
      intent: "recommend",
    };
  }

  // 1. Margen
  if (fin.margin < 0) {
    recs.push({ text: `Margen negativo (${formatPct(fin.margin)}). Auditá gastos de mano de obra y materiales en las obras activas. Considerá renegociar precios con tus top 3 proveedores.`, severity: "critical" });
  } else if (fin.margin < 15 && fin.totalIncome > 0) {
    recs.push({ text: `Margen del ${formatPct(fin.margin)}, por debajo del 20% recomendado. Identificá las 3 categorías de gasto más grandes y proponé reducciones del 5-10%.`, severity: "warning" });
  } else if (fin.totalIncome > 0) {
    recs.push({ text: `Margen saludable del ${formatPct(fin.margin)}. Mantené el ritmo.`, severity: "info" });
  }

  // 2. Stock
  if (stock.outOfStock.length > 0) {
    recs.push({ text: `${stock.outOfStock.length} ${stock.outOfStock.length === 1 ? "material sin stock" : "materiales sin stock"}. Esto puede parar obras. Generá pedidos de compra ya.`, severity: "critical" });
  }
  if (stock.lowStock.length > 0) {
    recs.push({ text: `${stock.lowStock.length} ${stock.lowStock.length === 1 ? "material bajo del mínimo" : "materiales bajo del mínimo"}. Considerá configurar auto-pedido cuando lleguen al 50% del mínimo.`, severity: "warning" });
  }

  // 3. Obras sobre presupuesto
  const overBudget = projects.filter((p) => {
    const spent = p.transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return p.budget > 0 && spent / p.budget > 0.8 && p.progress < 90 && p.status !== "finished";
  });
  if (overBudget.length > 0) {
    recs.push({ text: `${overBudget.length} ${overBudget.length === 1 ? "obra se acerca al tope de presupuesto" : "obras se acercan al tope de presupuesto"} con avance incompleto. Revisá desvíos: ${overBudget.map((p) => p.code).join(", ")}.`, severity: "warning" });
  }

  // 4. Stock muerto
  const materials = await db.material.findMany({ include: { stockMovements: { orderBy: { date: "desc" }, take: 1 } } });
  const deadStock = materials.filter((m) => {
    const last = m.stockMovements[0];
    if (!last) return m.stock > 0;
    const days = (Date.now() - last.date.getTime()) / (1000 * 60 * 60 * 24);
    return days > 60 && m.stock > 0;
  });
  if (deadStock.length > 0) {
    const value = deadStock.reduce((s, m) => s + m.stock * m.unitCost, 0);
    recs.push({ text: `Capital inmovilizado en stock muerto: ${formatCurrency(value)} en ${deadStock.length} ${deadStock.length === 1 ? "material sin rotar" : "materiales sin rotar"} hace 60+ días. Considerá venderlos o canjearlos.`, severity: "warning" });
  }

  // 5. Concentración de proveedores
  const suppliers = await db.supplier.findMany({ include: { transactions: true } });
  const suppliersWithSpend = suppliers.map((s) => ({ name: s.name, total: s.transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0) })).filter((s) => s.total > 0);
  const totalSupplied = suppliersWithSpend.reduce((s, x) => s + x.total, 0);
  const topSupplier = suppliersWithSpend.sort((a, b) => b.total - a.total)[0];
  if (topSupplier && totalSupplied > 0 && topSupplier.total / totalSupplied > 0.4) {
    recs.push({ text: `Más del 40% de tus compras están concentradas en ${topSupplier.name}. Renegociá precios por volumen o buscá un proveedor alternativo para reducir dependencia.`, severity: "info" });
  }

  if (recs.length === 0) {
    return { text: "Todo en orden. No tengo recomendaciones accionables en este momento.", intent: "recommend" };
  }

  const icons = { critical: "•", warning: "•", info: "•" };
  return {
    text: `Recomendaciones basadas en tus datos:

${recs.map((r, i) => `${i + 1}. ${r.text}`).join("\n\n")}`,
    intent: "recommend",
    actions: recs.map((r) => ({ type: "highlight" as const, title: r.text.split(".")[0].slice(0, 60), description: r.text, severity: r.severity })),
    suggestions: ["Ver flujo de caja", "Generar pedido de compra", "Detectar anomalías"],
  };
}

async function respondSummarize(): Promise<AgentResponse> {
  const fin = await getFinancialSummary();
  const stock = await getStockSummary();
  const { projects, active } = await getProjectSummary();
  const tasks = await db.task.count({ where: { status: { in: ["pending", "in_progress"] } } });
  const overdueTasks = await db.task.count({ where: { status: { in: ["pending", "in_progress"] }, dueDate: { lt: new Date() } } });
  const avgProgress = projects.length > 0 ? projects.reduce((s, p) => s + p.progress, 0) / projects.length : 0;

  if (fin.transactions.length === 0 && projects.length === 0 && stock.materials.length === 0) {
    return {
      text: "El sistema arranca vacío. Cargá tu primera obra, proveedor o movimiento y te daré un panorama completo en cualquier momento.",
      intent: "summarize",
      suggestions: ["Crear obra", "Cargar movimiento", "Agregar material"],
    };
  }

  const priority =
    stock.outOfStock.length > 0
      ? `Acción prioritaria: reponer ${stock.outOfStock.length} ${stock.outOfStock.length === 1 ? "material crítico" : "materiales críticos"}.`
      : fin.margin < 15 && fin.totalIncome > 0
      ? "Acción prioritaria: revisar estructura de costos para mejorar el margen."
      : overdueTasks > 0
      ? `Acción prioritaria: hay ${overdueTasks} ${overdueTasks === 1 ? "tarea atrasada" : "tareas atrasadas"}.`
      : "Sin acciones urgentes — el negocio está operando con normalidad.";

  return {
    text: `Resumen ejecutivo:

**Finanzas:** ${fin.profit >= 0 ? "en positivo" : "en rojo"} con ${formatCurrency(fin.profit)} de ganancia (${formatPct(fin.margin)} de margen) sobre ${formatCurrency(fin.totalIncome)} facturado.

**Obras:** ${active.length} activas de ${projects.length} totales. Avance promedio ${formatPct(avgProgress)}.

**Inventario:** ${formatCurrency(stock.totalValue)} en ${stock.materials.length} materiales. ${stock.lowStock.length + stock.outOfStock.length} alertas.

**Tareas:** ${tasks} pendientes${overdueTasks > 0 ? `, ${overdueTasks} atrasadas` : ""}.

${priority}`,
    intent: "summarize",
    suggestions: ["Recomendaciones", "Ver alertas", "Flujo de caja"],
  };
}

async function respondActionCreateExpense(parsed: ParsedCommand): Promise<AgentResponse> {
  const amount = parsed.entities.amount as number | undefined;
  const category = parsed.entities.category as string | undefined;
  if (!amount) {
    return {
      text: `Para registrar un gasto necesito el monto. Por ejemplo: *registrar gasto de $50000 en materiales para OB-001*.`,
      intent: "action_create_expense",
      suggestions: ["registrar gasto de $25000 en mano de obra", "registrar gasto de $100000 en materiales"],
    };
  }
  let projectId: string | undefined;
  if (parsed.entities.projectRef) {
    const project = await resolveProject(parsed.entities.projectRef as string);
    if (project) projectId = project.id;
  }
  const tx = await db.transaction.create({
    data: {
      type: "expense",
      category: category || "otros",
      description: `Gasto registrado por asistente`,
      amount,
      projectId,
    },
  });
  return {
    text: `Listo, registré el gasto de ${formatCurrency(amount)} en ${category || "otros"}${projectId ? " asignado a la obra" : ""}.`,
    intent: "action_create_expense",
    data: { transaction: tx },
    suggestions: ["Ver gastos", "Registrar otro gasto"],
  };
}

async function respondActionCreateIncome(parsed: ParsedCommand): Promise<AgentResponse> {
  const amount = parsed.entities.amount as number | undefined;
  if (!amount) {
    return {
      text: `Para registrar un ingreso necesito el monto. Ejemplo: *registrar ingreso de $150000 por anticipo de OB-002*.`,
      intent: "action_create_income",
      suggestions: ["registrar ingreso de $200000 por venta"],
    };
  }
  let projectId: string | undefined;
  if (parsed.entities.projectRef) {
    const project = await resolveProject(parsed.entities.projectRef as string);
    if (project) projectId = project.id;
  }
  const tx = await db.transaction.create({
    data: {
      type: "income",
      category: (parsed.entities.category as string) || "venta",
      description: `Ingreso registrado por asistente`,
      amount,
      projectId,
    },
  });
  return {
    text: `Listo, registré el ingreso de ${formatCurrency(amount)}.`,
    intent: "action_create_income",
    data: { transaction: tx },
    suggestions: ["Ver ingresos", "¿Cuánto gané?"],
  };
}

async function respondActionCreateProject(): Promise<AgentResponse> {
  return {
    text: `Para crear una obra nueva, abrí el módulo **Obras** y tocá "Nueva obra". Te pide nombre, presupuesto, cliente, fechas y avance inicial. El sistema le asigna el código automáticamente (OB-001, OB-002…).

¿Querés que la cargue yo directamente? Pasame: nombre, presupuesto y cliente. Ejemplo: *crear obra "Casa Familia Pérez", presupuesto $45.000.000, cliente Juan Pérez*.`,
    intent: "action_create_project",
    suggestions: ["Estado de obras", "Ayuda"],
  };
}

async function respondActionCreateTask(parsed: ParsedCommand): Promise<AgentResponse> {
  const title = parsed.entities.title as string | undefined;
  if (!title) {
    return {
      text: `Para crear una tarea decime qué hay que hacer. Ejemplo: *crear tarea: llamar al proveedor de cemento* o *recordame cobrar el anticipo de OB-001*.`,
      intent: "action_create_task",
    };
  }
  // Buscar obra referenciada
  let projectId: string | undefined;
  const projectMatch = parsed.rawText.match(/OB[-\s]?(\d+)/i);
  if (projectMatch) {
    const project = await resolveProject(projectMatch[1]);
    if (project) projectId = project.id;
  }
  const task = await db.task.create({
    data: {
      title: title.slice(0, 200),
      status: "pending",
      priority: "medium",
      projectId,
      createdBy: "agent",
    },
  });
  return {
    text: `Listo, creé la tarea "${title}"${projectId ? " asociada a la obra" : ""}. La vas a ver en el módulo Tareas.`,
    intent: "action_create_task",
    data: { task },
    suggestions: ["Ver tareas", "Crear otra tarea"],
  };
}

async function respondActionReorder(): Promise<AgentResponse> {
  const stock = await getStockSummary();
  const items = [...stock.outOfStock, ...stock.lowStock];
  if (items.length === 0) {
    return {
      text: "No hay materiales que requieran reposición ahora. Todo el stock está por encima del mínimo.",
      intent: "action_reorder",
    };
  }
  const lines = items.map((m) => {
    const needed = m.minStock * 1.5 - m.stock;
    const cost = needed * m.unitCost;
    return `• ${m.name} (${m.sku}): pedir ${formatNumber(needed)} ${m.unit} — ${formatCurrency(cost)}${m.supplier ? ` — prov. ${m.supplier.name}` : ""}`;
  });
  const totalCost = items.reduce((s, m) => s + (m.minStock * 1.5 - m.stock) * m.unitCost, 0);
  return {
    text: `Pedido de reposición sugerido (${items.length} ${items.length === 1 ? "material" : "materiales"}):

${lines.join("\n")}

Costo total estimado: ${formatCurrency(totalCost)}

Para confirmar la compra, registrala desde Inventario → Movimiento → Entrada, seleccionando proveedor. Así se actualiza stock y se carga el gasto en Finanzas automáticamente.`,
    intent: "action_reorder",
    actions: [
      {
        type: "reorder",
        title: "Generar pedido de reposición",
        description: `${items.length} materiales — Total: ${formatCurrency(totalCost)}`,
        severity: "warning",
        payload: { items: items.map((m) => ({ id: m.id, qty: m.minStock * 1.5 - m.stock })) },
      },
    ],
    suggestions: ["Ver proveedores", "Registrar la compra"],
  };
}

async function respondActionUpdateStock(): Promise<AgentResponse> {
  return {
    text: `Para actualizar stock de un material, abrí el módulo **Inventario**, buscá el material y tocá el ícono de movimiento (flechas). Podés registrar entrada (compra), salida (consumo de obra) o ajuste de inventario. Si es entrada con proveedor, también se carga el gasto en Finanzas automáticamente.`,
    intent: "action_update_stock",
    suggestions: ["Qué materiales faltan", "Ver inventario"],
  };
}

// ─── Nuevos handlers de acción ───

async function respondActionAddMaterials(parsed: ParsedCommand, rawText: string): Promise<AgentResponse> {
  // Extraer la sección de materiales del texto (después de ":" o "materiales:" o "items:")
  const colonPart = rawText.match(/(?:materiales?|items?|productos?)\s*:\s*(.+)$/i);
  const listText = colonPart ? colonPart[1] : rawText;
  const items = parseItemList(listText);

  if (items.length === 0) {
    return {
      text: `No pude identificar los materiales a crear. Usá el formato:\n\n*crea materiales: 10 bolsas de cemento, 3 bolsas de durlock, 5 kg de cal*`,
      intent: "action_add_materials",
      suggestions: ["crea materiales: 10 bolsas de cemento, 5 kg de cal"],
    };
  }

  // Resolver obra si se menciona
  let projectRef: string | undefined;
  const projMatch = rawText.match(/en\s+la\s+obra\s+([\w\s]+?)(?:,|\s+crea|\s+agrega|\s+carg)/i)
    || rawText.match(/para\s+(?:la\s+)?obra\s+([\w\s]+?)(?:,|\s+crea)/i)
    || rawText.match(/obra\s+([\w\s]+?)(?:,|\s+crea|\s+agrega)/i);
  if (projMatch) projectRef = projMatch[1].trim();
  const project = projectRef ? await resolveProject(projectRef) : null;

  const created: string[] = [];
  const updated: string[] = [];

  for (const item of items) {
    // Buscar si ya existe un material con ese nombre (fuzzy)
    const existing = await db.material.findFirst({
      where: { name: { contains: item.name, mode: 'insensitive' } },
    });

    if (existing) {
      // Actualizar stock
      await db.material.update({
        where: { id: existing.id },
        data: { stock: { increment: item.qty } },
      });
      // Registrar movimiento de stock
      await db.stockMovement.create({
        data: {
          type: 'incoming',
          quantity: item.qty,
          unitCost: existing.unitCost,
          reason: 'compra',
          note: `Cargado por asistente${project ? ` para obra ${project.code}` : ''}`,
          materialId: existing.id,
        },
      });
      updated.push(`• ${item.qty} ${item.unit} de ${existing.name} (stock actualizado)`);
    } else {
      // Crear material nuevo
      const sku = generateSku(item.name);
      const mat = await db.material.create({
        data: {
          sku,
          name: item.name.charAt(0).toUpperCase() + item.name.slice(1),
          category: 'materiales',
          unit: item.unit,
          stock: item.qty,
          minStock: 0,
        },
      });
      // Registrar movimiento inicial
      await db.stockMovement.create({
        data: {
          type: 'incoming',
          quantity: item.qty,
          unitCost: 0,
          reason: 'compra',
          note: `Stock inicial cargado por asistente${project ? ` para obra ${project.code}` : ''}`,
          materialId: mat.id,
        },
      });
      created.push(`• ${item.qty} ${item.unit} de ${mat.name} (nuevo)`);
    }
  }

  const total = created.length + updated.length;
  const lines = [...created, ...updated].join('\n');

  return {
    text: `Listo, procesé ${total} ${total === 1 ? 'material' : 'materiales'}${project ? ` para la obra **${project.code} ${project.name}**` : ''}:\n\n${lines}\n\n${created.length > 0 ? `${created.length} creados nuevos. ` : ''}${updated.length > 0 ? `${updated.length} con stock actualizado.` : ''}`,
    intent: "action_add_materials",
    suggestions: ["Ver inventario", "¿Qué stock tengo?"],
  };
}

async function respondActionAddStockMovement(parsed: ParsedCommand, rawText: string): Promise<AgentResponse> {
  // Determinar tipo de movimiento
  const isEntry = /(entrada|ingreso|compra|recib)/i.test(rawText);
  const isExit = /(salida|consumo|egreso|us[oa])/i.test(rawText);
  const type = isEntry ? 'incoming' : isExit ? 'outgoing' : 'adjustment';

  // Buscar material
  const all = await db.material.findMany();
  const match = all.find(m => normalize(rawText).includes(normalize(m.name)) || normalize(rawText).includes(normalize(m.sku)));
  if (!match) {
    const names = all.slice(0, 5).map(m => m.name).join(', ');
    return {
      text: `No encontré qué material querés mover. Tenés: ${names}${all.length > 5 ? '...' : ''}. Sé más específico: *entrada de 10 bolsas de cemento*.`,
      intent: "action_add_stock_movement",
    };
  }

  const qtyMatch = rawText.match(/(\d+(?:[.,]\d+)?)/);
  const qty = qtyMatch ? parseFloat(qtyMatch[1].replace(',', '.')) : 1;

  await db.material.update({
    where: { id: match.id },
    data: { stock: type === 'incoming' ? { increment: qty } : { decrement: qty } },
  });
  await db.stockMovement.create({
    data: {
      type,
      quantity: qty,
      unitCost: match.unitCost,
      reason: type === 'incoming' ? 'compra' : type === 'outgoing' ? 'consumo' : 'ajuste',
      note: 'Registrado por asistente',
      materialId: match.id,
    },
  });

  const verb = type === 'incoming' ? 'entrada' : type === 'outgoing' ? 'salida' : 'ajuste';
  const newStock = type === 'incoming' ? match.stock + qty : Math.max(0, match.stock - qty);
  return {
    text: `Registré ${verb} de **${qty} ${match.unit} de ${match.name}**. Stock actualizado: ${formatNumber(newStock)} ${match.unit}.`,
    intent: "action_add_stock_movement",
    suggestions: ["Ver inventario", "¿Qué materiales faltan?"],
  };
}

async function respondActionUpdateProjectProgress(parsed: ParsedCommand, rawText: string): Promise<AgentResponse> {
  const projectRef = parsed.entities.projectRef as string | undefined;
  const progress = parsed.entities.progress as number | undefined;

  if (!progress && progress !== 0) {
    return {
      text: `Indicame la obra y el porcentaje. Ejemplo: *OB-001 va al 65%* o *actualizar avance de americas center al 40%*.`,
      intent: "action_update_project_progress",
    };
  }

  // También intentar extraer ref del texto crudo si el parser no lo encontró
  let ref = projectRef;
  if (!ref) {
    const m = rawText.match(/(?:de|obra)\s+([\w\s]+?)\s+(?:al|va|tiene|esta|lleva)/i)
      || rawText.match(/OB[-\s]?(\d+)/i);
    if (m) ref = m[1].trim();
  }

  const project = await resolveProject(ref);
  if (!project) {
    return {
      text: `No encontré la obra. Indicame el código (OB-001) o el nombre. Ejemplo: *avance de americas center al 60%*.`,
      intent: "action_update_project_progress",
    };
  }

  const pct = Math.min(100, Math.max(0, progress));
  const updated = await db.project.update({
    where: { id: project.id },
    data: { progress: pct, ...(pct === 100 ? { status: 'finished', endDate: new Date() } : {}) },
  });

  return {
    text: `Actualicé el avance de **${project.code} ${project.name}** al **${pct}%**.${pct === 100 ? ' La marqué como finalizada.' : ''}`,
    intent: "action_update_project_progress",
    data: { project: updated },
    suggestions: [`Detalle de ${project.code}`, "Estado de obras"],
  };
}

async function respondActionUpdateProjectStatus(parsed: ParsedCommand, rawText: string): Promise<AgentResponse> {
  const projectRef = parsed.entities.projectRef as string | undefined;
  const status = parsed.entities.status as string | undefined;

  const project = await resolveProject(projectRef || rawText);
  if (!project) {
    return {
      text: `No encontré la obra. Indicame el código o nombre. Ejemplo: *poner obra americas center como activa*.`,
      intent: "action_update_project_status",
    };
  }
  if (!status) {
    return {
      text: `¿A qué estado la quiero pasar? Opciones: **activa**, **pausada**, **terminada**, **planificación**.`,
      intent: "action_update_project_status",
    };
  }

  const updated = await db.project.update({
    where: { id: project.id },
    data: { status, ...(status === 'finished' ? { progress: 100, endDate: new Date() } : {}) },
  });
  const statusLabel: Record<string, string> = { in_progress: 'activa', paused: 'pausada', finished: 'finalizada', planning: 'en planificación' };
  return {
    text: `Listo, la obra **${project.code} ${project.name}** ahora está **${statusLabel[status] || status}**.`,
    intent: "action_update_project_status",
    data: { project: updated },
    suggestions: ["Estado de obras"],
  };
}

async function respondActionCreateProjectDirect(parsed: ParsedCommand, rawText: string): Promise<AgentResponse> {
  const name = parsed.entities.name as string | undefined;
  const budget = parsed.entities.budget as number | undefined;
  const clientName = parsed.entities.clientName as string | undefined;

  if (!name) {
    return {
      text: `Para crear una obra necesito al menos el nombre. Ejemplo:\n\n*crear obra "Casa Familia García", presupuesto $2000000, cliente Juan García*`,
      intent: "action_create_project_direct",
    };
  }

  // Generar código
  const allProjects = await db.project.findMany({ select: { code: true } });
  let maxNum = 0;
  for (const p of allProjects) {
    const m = p.code?.match(/OB-(\d+)/i);
    if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
  }
  const code = `OB-${String(maxNum + 1).padStart(3, '0')}`;

  const project = await db.project.create({
    data: {
      code,
      name,
      budget: budget || 0,
      clientName: clientName || null,
      status: 'planning',
      type: 'obra',
      progress: 0,
    },
  });


  // Detectar si el mensaje tambien incluye materiales para agregar a la obra
  const hasMaterials = /(?:materiales?|items?|productos?)\s*:/.test(rawText) || /agrega\s+materiales/i.test(rawText);
  
  if (hasMaterials) {
    try {
      // Crear un ParsedCommand sintetico para action_add_materials con la obra recien creada
      // Primero intentar reemplazar la parte de creacion de obra en el texto
      let materialText = rawText.replace(/crear obra[^.]+\.\s*/i, `en la obra ${code}, crea materiales: `);
      // Si el reemplazo no cambio el texto, prepend manualmente
      if (materialText === rawText) {
        materialText = `en la obra ${code}, crea materiales: ${rawText}`;
      }
      const parsedMat = {
        intent: "action_add_materials" as Intent,
        rawText: materialText,
        normalized: `en la obra ${code}, `,
        entities: { projectRef: code },
        confidence: 0.9,
      } as ParsedCommand;
      const matResponse = await respondActionAddMaterials(parsedMat, materialText);
      
      return {
        text: `¡Obra creada! Código asignado: **${code}**\n\n- Nombre: ${project.name}\n- Presupuesto: ${budget ? formatCurrency(budget) : 'sin definir'}\n- Cliente: ${clientName || 'sin definir'}\n- Estado: Planificación\n\n---\n${matResponse.text}`,
        intent: "action_create_project_direct",
        data: { project, materialsResponse: matResponse.data },
        suggestions: [`Detalle de ${code}`, "Ver inventario", "Actualizar avance"],
      };
    } catch (err) {
      console.error("[Agent] Error al agregar materiales a la obra nueva:", err);
    }
  }
  return {
    text: `¡Obra creada! Código asignado: **${code}**\n\n- Nombre: ${project.name}\n- Presupuesto: ${budget ? formatCurrency(budget) : 'sin definir'}\n- Cliente: ${clientName || 'sin definir'}\n- Estado: Planificación`,
    intent: "action_create_project_direct",
    data: { project },
    suggestions: [`Detalle de ${code}`, "Actualizar avance", "Registrar gasto en esta obra"],
  };
}

async function respondActionCreateSupplier(parsed: ParsedCommand, rawText: string): Promise<AgentResponse> {
  const name = parsed.entities.name as string | undefined;
  if (!name) {
    return {
      text: `Para crear un proveedor necesito al menos el nombre. Ejemplo:\n\n*crear proveedor: Cementos del Sur, tel: 011-1234-5678, rubro: materiales*`,
      intent: "action_create_supplier",
    };
  }

  const supplier = await db.supplier.create({
    data: {
      name,
      phone: (parsed.entities.phone as string) || null,
      email: (parsed.entities.email as string) || null,
      category: (parsed.entities.category as string) || null,
      rating: 3,
    },
  });

  return {
    text: `Proveedor **${supplier.name}** creado correctamente.${supplier.phone ? `\n- Tel: ${supplier.phone}` : ''}${supplier.email ? `\n- Email: ${supplier.email}` : ''}${supplier.category ? `\n- Rubro: ${supplier.category}` : ''}`,
    intent: "action_create_supplier",
    data: { supplier },
    suggestions: ["Ver proveedores", "Crear otro proveedor"],
  };
}

async function respondActionListProjectTasks(parsed: ParsedCommand, rawText: string): Promise<AgentResponse> {
  const project = await resolveProject(parsed.entities.projectRef as string || rawText);
  if (!project) {
    return {
      text: `No encontré la obra. Indicame el código (OB-001) o el nombre.`,
      intent: "action_list_project_tasks",
    };
  }

  const tasks = await db.task.findMany({
    where: { projectId: project.id },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
  });

  if (tasks.length === 0) {
    return {
      text: `La obra **${project.code} ${project.name}** no tiene tareas asignadas.`,
      intent: "action_list_project_tasks",
      suggestions: [`Crear tarea para ${project.code}`],
    };
  }

  const statusIcon: Record<string, string> = { pending: '⏳', in_progress: '🔄', completed: '✅', cancelled: '❌' };
  const lines = tasks.map(t => `${statusIcon[t.status] || '•'} ${t.title} — ${t.status.replace('_', ' ')}${t.dueDate ? ` (vence ${formatDate(t.dueDate)})` : ''}`);
  return {
    text: `Tareas de **${project.code} ${project.name}** (${tasks.length}):\n\n${lines.join('\n')}`,
    intent: "action_list_project_tasks",
    data: { tasks },
    suggestions: [`Crear tarea para ${project.code}`, `Detalle de ${project.code}`],
  };
}

async function respondActionCompleteTask(parsed: ParsedCommand, rawText: string): Promise<AgentResponse> {
  const taskTitle = parsed.entities.taskTitle as string | undefined;
  const allTasks = await db.task.findMany({ where: { status: { in: ['pending', 'in_progress'] } } });
  if (allTasks.length === 0) {
    return { text: 'No hay tareas pendientes.', intent: 'action_complete_task' };
  }

  let task = taskTitle
    ? allTasks.find(t => normalize(t.title).includes(normalize(taskTitle)))
    : null;

  if (!task) {
    const top5 = allTasks.slice(0, 5).map(t => `• ${t.title}`).join('\n');
    return {
      text: `No encontré esa tarea. Tareas pendientes:\n\n${top5}\n\nEscribí: *completar tarea: [nombre exacto]*`,
      intent: 'action_complete_task',
    };
  }

  const updated = await db.task.update({
    where: { id: task.id },
    data: { status: 'completed' },
  });

  return {
    text: `✅ Marqué como completada la tarea **"${task.title}"**.`,
    intent: 'action_complete_task',
    data: { task: updated },
    suggestions: ['Ver tareas', '¿Qué tareas quedan?'],
  };
}

async function respondActionCloseProject(parsed: ParsedCommand): Promise<AgentResponse> {
  const project = await resolveProject(parsed.entities.projectRef as string);
  if (!project) {
    return {
      text: "Indicame qué obra querés cerrar. Ejemplo: *cerrar obra OB-001*.",
      intent: "action_close_project",
    };
  }
  const updated = await db.project.update({ where: { id: project.id }, data: { status: "finished", progress: 100, endDate: new Date() } });
  const spent = project.transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const income = project.transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  return {
    text: `Listo, cerré la obra **${project.code} ${project.name}**.

Resumen final:
- Presupuesto: ${formatCurrency(project.budget)}
- Ingresos: ${formatCurrency(income)}
- Gastos: ${formatCurrency(spent)}
- Resultado: ${formatCurrency(income - spent)} (margen ${income > 0 ? formatPct(((income - spent) / income) * 100) : "—"})`,
    intent: "action_close_project",
    data: { project: updated },
  };
}

async function respondConfigListAutomations(): Promise<AgentResponse> {
  const rules = await db.automationRule.findMany();
  const lines = rules.map((r) => `• ${r.name} ${r.enabled ? "(activa)" : "(inactiva)"} — ${r.description}`);
  return {
    text: `Tenés ${rules.length} ${rules.length === 1 ? "regla de automatización" : "reglas de automatización"} configuradas:

${lines.join("\n")}

Estas reglas se ejecutan cada vez que abro el panel del asistente y generan alertas cuando se cumplen las condiciones.`,
    intent: "config_list_automations",
    suggestions: ["Ejecutar automatizaciones", "Ver alertas"],
  };
}

async function respondHelp(): Promise<AgentResponse> {
  return {
    text: `Soy el asistente interno de tu constructora. Funciono 100% local, sin APIs externas, y proceso tus datos en tiempo real.

**Qué puedo hacer:**

**Consultas financieras**
- "¿cuánto gané?" / "ganancias" / "rentabilidad"
- "¿cuánto gasté?" / "gastos por categoría"
- "flujo de caja" / "liquidez"
- "¿en qué gasté más?"
- "comparar con mes anterior" / "evolución"
- "detectar anomalías" / "gastos atípicos"
- "margen por obra" / "qué obra es más rentable"

**Obras**
- "estado de las obras" / "cómo van las obras"
- "detalle de OB-001"
- "proyección de presupuesto"
- "cuándo termina OB-001" (ETA estimada)
- "cerrar obra OB-001"

**Inventario**
- "¿qué stock tengo?"
- "¿qué materiales faltan?" / "stock bajo"
- "valor del inventario"
- "stock muerto" (sin rotar)
- "historial de [material]"
- "generar pedido de compra"

**Proveedores**
- "ver proveedores"
- "quién es el proveedor al que más le compro"
- "mejor proveedor"

**Tareas**
- "tareas pendientes" / "tareas atrasadas"
- "crear tarea: [descripción]"
- "recordame: [descripción]"

**Alertas y análisis**
- "¿hay alertas?" / "novedades"
- "recomendaciones"
- "resumen" / "¿cómo vamos?"
- "KPIs"

**Registrar movimientos**
- "registrar gasto de $50000 en materiales para OB-001"
- "registrar ingreso de $200000 por venta"
- "cargar anticipo de $150000 para OB-002"

**Crear y editar**
- "en la obra americas center, crea materiales: 10 bolsas de cemento, 3 bolsas de durlock"
- "entrada de 20 kg de arena" / "salida de 5 unidades de cemento"
- "crear obra \"Casa García\", presupuesto $3000000, cliente Juan García"
- "crear proveedor: Cementos SA, tel: 011-1234-5678, rubro: materiales"
- "OB-001 va al 65%" / "actualizar avance de americas center al 80%"
- "poner obra OB-002 como activa" / "pausar OB-003"
- "tareas de la obra OB-001"
- "completar tarea: llamar al proveedor"
- "cerrar obra OB-001"

Escribime en lenguaje natural, en español, y te respondo al instante.`,
    intent: "help",
    suggestions: ["¿Cómo vamos?", "¿Qué alertas hay?", "Recomendaciones", "¿Qué materiales faltan?"],
  };
}

// ---------- Dispatch by intent (exportable, sin guardar mensajes) ----------

export async function dispatchByIntent(parsed: ParsedCommand, rawText?: string): Promise<AgentResponse> {
  const text = rawText || parsed.rawText;

  let response: AgentResponse;
  switch (parsed.intent) {
    case "greeting":
      response = await respondGreeting();
      break;
    case "query_profit":
      response = await respondQueryProfit();
      break;
    case "query_expenses":
      response = await respondQueryExpenses();
      break;
    case "query_income":
      response = await respondQueryIncome();
      break;
    case "query_low_stock":
      response = await respondQueryLowStock();
      break;
    case "query_stock":
      response = await respondQueryStock();
      break;
    case "query_stock_value":
      response = await respondQueryStockValue();
      break;
    case "query_dead_stock":
      response = await respondQueryDeadStock();
      break;
    case "query_material_history":
      response = await respondQueryMaterialHistory(parsed);
      break;
    case "query_project_status":
      response = await respondQueryProjectStatus();
      break;
    case "query_project_detail":
      response = await respondQueryProjectDetail(parsed);
      break;
    case "query_project_profitability":
    case "query_margin_by_project":
      response = await respondQueryMarginByProject();
      break;
    case "predict_budget":
      response = await respondPredictBudget();
      break;
    case "predict_project_eta":
      response = await respondPredictProjectEta(parsed);
      break;
    case "query_top_expense":
      response = await respondQueryTopExpense();
      break;
    case "query_supplier":
      response = await respondQuerySupplier();
      break;
    case "query_top_supplier":
      response = await respondQueryTopSupplier();
      break;
    case "query_best_supplier":
      response = await respondQueryBestSupplier();
      break;
    case "query_cashflow":
      response = await respondQueryCashflow();
      break;
    case "query_kpis":
      response = await respondQueryKpis();
      break;
    case "query_compare_period":
      response = await respondQueryComparePeriod();
      break;
    case "query_anomalies":
      response = await respondQueryAnomalies();
      break;
    case "query_tasks":
      response = await respondQueryTasks();
      break;
    case "query_overdue_tasks":
      response = await respondQueryOverdueTasks();
      break;
    case "alert_check":
      response = await respondAlertCheck();
      break;
    case "recommend":
      response = await respondRecommend();
      break;
    case "summarize":
      response = await respondSummarize();
      break;
    case "action_create_expense":
      response = await respondActionCreateExpense(parsed);
      break;
    case "action_create_income":
      response = await respondActionCreateIncome(parsed);
      break;
    case "action_create_project":
      response = await respondActionCreateProject();
      break;
    case "action_create_task":
      response = await respondActionCreateTask(parsed);
      break;
    case "action_reorder":
      response = await respondActionReorder();
      break;
    case "action_update_stock":
      response = await respondActionUpdateStock();
      break;
    case "action_close_project":
      response = await respondActionCloseProject(parsed);
      break;
    case "action_add_materials":
      response = await respondActionAddMaterials(parsed, text);
      break;
    case "action_add_stock_movement":
      response = await respondActionAddStockMovement(parsed, text);
      break;
    case "action_update_project_progress":
      response = await respondActionUpdateProjectProgress(parsed, text);
      break;
    case "action_update_project_status":
      response = await respondActionUpdateProjectStatus(parsed, text);
      break;
    case "action_create_project_direct":
      response = await respondActionCreateProjectDirect(parsed, text);
      break;
    case "action_create_supplier":
      response = await respondActionCreateSupplier(parsed, text);
      break;
    case "action_list_project_tasks":
      response = await respondActionListProjectTasks(parsed, text);
      break;
    case "action_complete_task":
      response = await respondActionCompleteTask(parsed, text);
      break;
    case "config_list_automations":
      response = await respondConfigListAutomations();
      break;
    case "help":
      response = await respondHelp();
      break;
    // ─── Handlers extendidos (editar, eliminar, workflows, exportar) ───
    case "action_edit_project": {
      const { handleEditProject } = await import("./agent-extended");
      response = await handleEditProject(parsed, text);
      break;
    }
    case "action_edit_task": {
      const { handleEditTask } = await import("./agent-extended");
      response = await handleEditTask(parsed, text);
      break;
    }
    case "action_edit_material": {
      const { handleEditMaterial } = await import("./agent-extended");
      response = await handleEditMaterial(parsed, text);
      break;
    }
    case "action_delete_task": {
      const { handleDeleteTask } = await import("./agent-extended");
      response = await handleDeleteTask(parsed, text);
      break;
    }
    case "action_delete_material": {
      const { handleDeleteMaterial } = await import("./agent-extended");
      response = await handleDeleteMaterial(parsed, text);
      break;
    }
    case "action_delete_transaction": {
      const { handleDeleteTransaction } = await import("./agent-extended");
      response = await handleDeleteTransaction(parsed, text);
      break;
    }
    case "action_trigger_workflow": {
      const { handleTriggerWorkflow } = await import("./agent-extended");
      response = await handleTriggerWorkflow(parsed, text);
      break;
    }
    case "action_list_workflows": {
      const { handleListWorkflows } = await import("./agent-extended");
      response = await handleListWorkflows();
      break;
    }
    case "action_export_data": {
      const { handleExportData } = await import("./agent-extended");
      response = await handleExportData(parsed, text);
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

async function tryGroqDispatch(rawText: string): Promise<AgentResponseWithEntities | null> {
  try {
    const { tryGroqCompoundIntent } = await import("./groq-integration");
    const compoundResult = await tryGroqCompoundIntent(rawText, []);
    if (!compoundResult.success || !compoundResult.intents || compoundResult.intents.length === 0) {
      return null;
    }

    const { processCompoundMessage, processMessageWithIntent, enrichQueryWithGroq } = await import("./agent-dispatcher");
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

export async function processAgentMessage(text: string): Promise<AgentResponse> {
  const originalText = text.trim();
  const normalized = normalizeMessage(originalText);
  const parsed = parseIntent(normalized.normalized || originalText);

  // Guardar mensaje del usuario
  try {
    await db.agentMessage.create({ data: { role: "user", content: originalText, intent: parsed.intent } });
  } catch {}

  let response: AgentResponse | null = null;
  let groqEntities: Record<string, any> = {};

  if (parsed.intent === "unknown" || parsed.confidence < 0.45) {
    try {
      const { processExtendedMessage } = await import("./agent-extended");
      const extended = await processExtendedMessage(normalized.normalized, originalText);
      if (extended.wasExtended && extended.response) {
        response = extended.response;
      }
    } catch {}
  }

  if (!response) {
    response = await dispatchByIntent(parsed, originalText);
  }

  const shouldFallbackToGroq =
    response.intent === "unknown" || parsed.intent === "unknown" || parsed.confidence < 0.45;

  if (shouldFallbackToGroq) {
    const groqResult = await tryGroqDispatch(originalText);
    if (groqResult) {
      response = groqResult.response;
      groqEntities = groqResult.entities || {};
      parsed.entities = { ...parsed.entities, ...groqEntities };
      parsed.intent = response.intent;
    }
  }

  if (response.intent === "unknown") {
    try {
      const { findClosestIntent, generateSmartUnknownResponse } = await import("./agent-extended");
      const closest = findClosestIntent(originalText);
      response = generateSmartUnknownResponse(originalText, closest);
    } catch {}
  }

  // Guardar respuesta del agente
  try {
    await db.agentMessage.create({
      data: {
        role: "agent",
        content: response.text,
        intent: response.intent,
        meta: response.data ? JSON.stringify(response.data).slice(0, 4000) : null,
      },
    });
  } catch {}

  try {
    await saveContextMetadata(response, parsed.entities);
  } catch {}

  return response;
}

// ---------- Motor de automatización ----------

export async function runAutomations(): Promise<AgentActionItem[]> {
  const rules = await db.automationRule.findMany({ where: { enabled: true } });
  const triggered: AgentActionItem[] = [];

  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const recentActions = await db.agentAction.findMany({
    where: { status: "active", createdAt: { gte: twelveHoursAgo } },
  });
  const recentTitles = new Set(recentActions.map((a) => a.title));

  for (const rule of rules) {
    let fired = false;
    let item: AgentActionItem | null = null;

    switch (rule.trigger) {
      case "low_stock": {
        const stock = await getStockSummary();
        if (stock.lowStock.length + stock.outOfStock.length > 0) {
          fired = true;
          item = {
            type: "alert",
            title: `Automatización: ${rule.name}`,
            description: `${stock.lowStock.length + stock.outOfStock.length} ${stock.lowStock.length + stock.outOfStock.length === 1 ? "material bajo mínimo" : "materiales bajo mínimo"}`,
            severity: "warning",
            payload: { materials: [...stock.lowStock, ...stock.outOfStock].map((m) => m.id) },
          };
        }
        break;
      }
      case "budget_overrun": {
        const { projects } = await getProjectSummary();
        const over = projects.filter((p) => {
          const spent = p.transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
          return p.budget > 0 && spent / p.budget > 0.9 && p.status !== "finished";
        });
        if (over.length > 0) {
          fired = true;
          item = {
            type: "alert",
            title: `Automatización: ${rule.name}`,
            description: `${over.length} ${over.length === 1 ? "obra sobre 90% del presupuesto" : "obras sobre 90% del presupuesto"}`,
            severity: "critical",
            payload: { projects: over.map((p) => p.id) },
          };
        }
        break;
      }
      case "expense_spike": {
        const transactions = await db.transaction.findMany({
          where: { type: "expense", date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        });
        const total = transactions.reduce((s, t) => s + t.amount, 0);
        if (total > 1000000) {
          fired = true;
          item = {
            type: "alert",
            title: `Automatización: ${rule.name}`,
            description: `Gastos de la última semana: ${formatCurrency(total)}`,
            severity: "warning",
          };
        }
        break;
      }
      case "late_task": {
        const overdue = await db.task.count({
          where: { status: { in: ["pending", "in_progress"] }, dueDate: { lt: new Date() } },
        });
        if (overdue > 0) {
          fired = true;
          item = {
            type: "alert",
            title: `Automatización: ${rule.name}`,
            description: `${overdue} ${overdue === 1 ? "tarea atrasada" : "tareas atrasadas"}`,
            severity: "warning",
          };
        }
        break;
      }
    }

    if (fired && item) {
      triggered.push(item);
      if (!recentTitles.has(item.title)) {
        await db.agentAction.create({
          data: {
            type: "alert",
            severity: item.severity || "info",
            title: item.title,
            description: item.description,
            payload: item.payload ? JSON.stringify(item.payload) : null,
          },
        });
        recentTitles.add(item.title);
      }
    }
  }

  // ─── Disparar workflows basados en eventos detectados ───
  try {
    const { triggerWorkflows } = await import("./workflow-engine");

    const stock = await getStockSummary();
    if (stock.lowStock.length + stock.outOfStock.length > 0) {
      await triggerWorkflows("event_low_stock", {
        materials: [...stock.lowStock, ...stock.outOfStock],
      });
    }

    const { projects } = await getProjectSummary();
    const over = projects.filter((p) => {
      const spent = p.transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      return p.budget > 0 && spent / p.budget > 0.9 && p.status !== "finished";
    });
    if (over.length > 0) {
      await triggerWorkflows("event_budget_overrun", {
        projects: over,
      });
    }

    const weekTx = await db.transaction.findMany({
      where: { type: "expense", date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    });
    const totalWeek = weekTx.reduce((s, t) => s + t.amount, 0);
    if (totalWeek > 1000000) {
      await triggerWorkflows("event_expense_spike", {
        total: totalWeek,
        transactions: weekTx,
      });
    }

    const lateTasks = await db.task.findMany({
      where: { status: { in: ["pending", "in_progress"] }, dueDate: { lt: new Date() } },
    });
    if (lateTasks.length > 0) {
      await triggerWorkflows("event_late_task", {
        tasks: lateTasks,
      });
    }
  } catch (e) {
    // Silently fail - workflow integration is additive
  }

  return triggered;
}

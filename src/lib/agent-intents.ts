// ============================================================
// PATRONES DE INTENT — Data de NLU separada del motor
// ============================================================

export type Intent =
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
  | "query_stock"
  | "query_low_stock"
  | "query_stock_value"
  | "query_material_history"
  | "query_dead_stock"
  | "query_project_status"
  | "query_project_detail"
  | "query_project_profitability"
  | "predict_budget"
  | "predict_project_eta"
  | "query_supplier"
  | "query_best_supplier"
  | "query_tasks"
  | "query_overdue_tasks"
  | "alert_check"
  | "recommend"
  | "summarize"
  | "help"
  | "greeting"
  | "action_create_expense"
  | "action_create_income"
  | "action_create_project"
  | "action_create_task"
  | "action_reorder"
  | "action_update_stock"
  | "action_close_project"
  | "config_list_automations"
  | "action_add_materials"
  | "action_add_stock_movement"
  | "action_update_project_progress"
  | "action_update_project_status"
  | "action_create_project_direct"
  | "action_create_supplier"
  | "action_add_expense_to_project"
  | "action_list_project_tasks"
  | "action_complete_task"
  | "action_edit_project"
  | "action_edit_task"
  | "action_edit_material"
  | "action_delete_task"
  | "action_delete_material"
  | "action_delete_transaction"
  | "action_trigger_workflow"
  | "action_list_workflows"
  | "action_export_data"
  | "action_edit_supplier"
  | "action_delete_supplier"
  | "action_get_project"
  | "action_get_material"
  | "action_get_supplier"
  | "action_get_task"
  | "action_bulk_complete_tasks"
  | "action_bulk_delete_tasks"
  | "action_create_schedule"
  | "action_list_schedules"
  | "action_delete_schedule"
  // Obsidian vault
  | "obsidian_read_note"
  | "obsidian_write_note"
  | "obsidian_search_notes"
  | "obsidian_list_vault"
  | "obsidian_append_note"
  | "obsidian_list_tags"
  | "obsidian_execute_command"
  | "capability_remember_preference" | "remember_preference"
  | "capability_recall_preference" | "recall_preference"
  | "capability_forget_preference" | "forget_preference"
  | "capability_list_preferences" | "list_preferences"
  | "capability_schedule_event" | "schedule_event"
  | "capability_list_events" | "list_events"
  | "capability_complete_event" | "complete_event"
  | "capability_cancel_event" | "cancel_event"
  | "capability_send_notification" | "send_notification"
  | "capability_list_notifications" | "list_notifications"
  | "capability_resolve_notification" | "resolve_notification"
  | "capability_dismiss_all_notifications" | "dismiss_all_notifications"
  | "capability_search_projects" | "search_projects"
  | "capability_search_clients" | "search_clients"
  | "capability_search_budgets" | "search_budgets"
  | "capability_list_budget_ranges" | "list_budget_ranges"
  | "capability_generate_document" | "generate_document"
  | "unknown";

interface IntentPattern {
  intent: Intent;
  patterns: RegExp[];
  entities?: (text: string, normalized: string) => Record<string, string | number | undefined>;
  priority?: number;
}

export const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: "greeting",
    patterns: [/^(hola|buenas|buenos\s*dias|buenas\s*tardes|buenas\s*nches|hey)\b/i],
    priority: 5,
  },
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
      /(crear|alta|nueva|nuevo)\s+(obra|proyecto)(?!\s+(?:material|item|producto|cemento|arena|clavo|pintura|madera))/i,
      /empezar\s+(una\s+)?(obra|proyecto)(?!\s+(?:material|item|producto))/i,
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
  {
    intent: "action_add_materials",
    patterns: [
      /(?<!\w(?:obra|proyecto)[\s,]*)((?:crear|agregar|cargar|añadir|crea|agrega|carga|añade|dar\s+de\s+alta)\s+(?:materiales|items|productos|cemento|arena|ladrillos|madera|hierro|cable|pintura))/i,
      /(?:en\s+(?:la\s+)?obra\s+([A-Za-z0-9-]+)|OB[-\s]?(\d+))[\s,]*(?:crea|agrega|carga|añade|agreg|cargas?|agrega?)\s+(?:materiales?|items?|productos?)/i,
      /(?:para\s+(?:la\s+)?obra|en\s+proyecto)\s+([A-Za-z0-9\sÀ-ÿ]+?)[\s,:]+(?:crea|agrega|carga|añade)\s+(?:materiales?|items?)/i,
      /(?:cargar|agregar|crear|añadir)?\s*(\d+)\s+(?:bolsa|bolsas|kg|kilos|m3|metro|metros|unidad|unidades|pieza|piezas|rollos?|tubo|tubos|bar|barra|barras)\s+(?:de\s+)?(cemento|arena|grava|ladrillo|madera|hierro|hormigon|cable|pintura|herramientas?|acero|aluminio)/i,
    ],
    entities: (text: string) => {
      let projectRef: string | undefined;
      const proyMatchDirec = text.match(/(?:en\s+(?:la\s+)?obra\s+|para\s+(?:la\s+)?obra\s+|OB[-\s]?)([A-Za-z0-9\sÀ-ÿ-]+?)(?:,|crea|agrega|carga|$)/i);
      const obMatch = text.match(/OB[-\s]?(\d+)/i);
      projectRef = proyMatchDirec ? proyMatchDirec[1].trim() : obMatch ? `OB-${obMatch[1]}` : undefined;
      return { projectRef };
    },
    priority: 14,
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
      /crear\s+obra\s+["']?[\w\sÀ-ÿ]+["']?\s*,?\s*(?:presupuesto|presupuesto\s+de|monto)/i,
      /nueva\s+obra\s*:\s*["']?[\w\sÀ-ÿ]+["']?/i,
      /alta\s+de\s+obra\s*:\s*/i,
      /crear\s+obra\s+(['"¿]?)[\w\sÀ-ÿáéíóú,.-]+\1\s*(?:para|con|cliente|presupuesto|$)/i,
      /crear\s+proyecto\s+[\w\sÀ-ÿ]+(?:\s+presupuesto)?/i,
    ],
    entities: (text: string) => {
      let nameMatch =
        text.match(/(?:crear|nueva|alta\s+de)\s+(?:obra|proyecto)\s*:?\s*["']?([\w\sÀ-ÿ]+?)["']?\s*(?:\.|,|presupuesto|cliente|para|con|$)/i) ||
        text.match(/(?:crear|nueva|alta)\s+(?:obra|proyecto)\s+(?:llamada|denominada|titulada)?\s*["']?([\w\sÀ-ÿ]+?)["']?/i) ||
        text.match(/^(?:.*?)(?:crear|nueva|alta)\s+(?:obra|proyecto)\s+([^,.;:]+?)(?:\s+presupuesto|\s+cliente|\s+para|\s+con|,|$)/i);
      const budgetMatch = text.match(/(?:presupuesto|monto)\s*:?\s*\$?\s*([\d.,]+)/i);
      const clientMatch = text.match(/(?:cliente|para)\s*:?\s*([\w\sÀ-ÿ]+?)(?:,|presupuesto|$)/i);
      return {
        name: nameMatch ? nameMatch[1].trim() : undefined,
        budget: budgetMatch ? parseFloat(budgetMatch[1].replace(/\./g, '').replace(',', '.')) : undefined,
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
    intent: "action_delete_task",
    patterns: [
      /(eliminar|borrar|remover|sacar)\s+(la\s+)?tarea/i,
      /tarea\s+["']?[\w\s]+["']?\s+(elimin|borrad)/i,
    ],
    entities: (text: string) => {
      const titleMatch = text.match(/(?:tarea\s+)?["']([\w\s]+)["']/i) || text.match(/(?:eliminar|borrar)\s+(?:la\s+)?tarea\s+(.+?)(?:,|$)/i);
      return { taskTitle: titleMatch ? titleMatch[1].trim() : undefined };
    },
    priority: 11,
  },
  {
    intent: "action_delete_material",
    patterns: [
      /(eliminar|borrar|remover|sacar)\s+(el\s+|la\s+|un\s+|una\s+)?(material|insumo|producto)/i,
      /dar\s+(de\s+)?baja\s+(el\s+|la\s+)?(material|insumo|producto)/i,
    ],
    entities: (text: string) => {
      const nameMatch = text.match(/(?:eliminar|borrar|remover|sacar|dar\s+de\s+baja)\s+(?:el\s+|la\s+|un\s+|una\s+)?(?:material|insumo|producto)\s+(.+?)(?:,|$)/i);
      return { materialName: nameMatch ? nameMatch[1].trim() : undefined };
    },
    priority: 11,
  },
  {
    intent: "action_delete_transaction",
    patterns: [
      /(eliminar|borrar|remover|sacar)\s+(el\s+|la\s+|un\s+|una\s+)?(gasto|ingreso|movimiento|transaccion)/i,
      /anular\s+(el\s+|la\s+|un\s+|una\s+)?(gasto|ingreso|movimiento)/i,
    ],
    entities: (text: string) => {
      const descMatch = text.match(/(?:eliminar|borrar|remover|sacar|anular)\s+(?:el\s+|la\s+|un\s+|una\s+)?(?:gasto|ingreso|movimiento|transaccion)\s+(.+?)(?:,|$)/i);
      return { transactionRef: descMatch ? descMatch[1].trim() : undefined };
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

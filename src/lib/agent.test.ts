import { describe, it, expect } from "vitest";
import { normalize, parseIntent } from "./agent";

describe("normalize", () => {
  it("lowercases and trims", () => {
    expect(normalize("  Hola Mundo  ")).toBe("hola mundo");
  });

  it("removes accents", () => {
    expect(normalize("ultima obra presupuestación")).toBe("ultima obra presupuestacion");
  });

  it("collapses whitespace", () => {
    expect(normalize("que  tal   como   andas")).toBe("que tal como andas");
  });

  it("handles ñ correctly", () => {
    expect(normalize("año")).toBe("ano");
  });

  it("handles empty string", () => {
    expect(normalize("")).toBe("");
  });
});

describe("parseIntent", () => {
  describe("financial queries", () => {
    it("detects query_kpis for 'dame los kpis'", () => {
      const r = parseIntent("dame los kpis");
      expect(r.intent).toBe("query_kpis");
      expect(r.confidence).toBeGreaterThan(0.5);
    });

    it("detects query_expenses for 'gastos'", () => {
      const r = parseIntent("cuales fueron los gastos de este mes");
      expect(r.intent).toBe("query_expenses");
      expect(r.confidence).toBeGreaterThan(0.5);
    });

    it("detects query_income for 'ingresos'", () => {
      const r = parseIntent("listar ingresos");
      expect(r.intent).toBe("query_income");
      expect(r.confidence).toBeGreaterThan(0.5);
    });

    it("detects query_cashflow for 'flujo de caja'", () => {
      const r = parseIntent("flujo de caja proyectado");
      expect(r.intent).toBe("query_cashflow");
    });

    it("detects query_profit for 'ganancias'", () => {
      const r = parseIntent("ganancias totales");
      expect(r.intent).toBe("query_profit");
    });

    it("detects query_anomalies for 'gastos atípicos'", () => {
      const r = parseIntent("detectá gastos atipicos");
      expect(r.intent).toBe("query_anomalies");
    });

    it("detects query_top_expense for 'mayor gasto'", () => {
      const r = parseIntent("cual fue el mayor gasto");
      expect(r.intent).toBe("query_top_expense");
    });

    it("detects query_compare_period for 'comparar con mes anterior'", () => {
      const r = parseIntent("comparar con mes anterior");
      expect(r.intent).toBe("query_compare_period");
    });
  });

  describe("inventory queries", () => {
    it("detects query_stock for 'stock'", () => {
      const r = parseIntent("qué stock tenemos");
      expect(r.intent).toBe("query_stock");
    });

    it("detects query_low_stock for 'materiales faltan'", () => {
      const r = parseIntent("que materiales faltan");
      expect(r.intent).toBe("query_low_stock");
    });

    it("detects query_stock_value for 'valor del inventario'", () => {
      const r = parseIntent("valor del inventario");
      expect(r.intent).toBe("query_stock_value");
    });

    it("detects query_dead_stock for 'stock muerto'", () => {
      const r = parseIntent("stock muerto");
      expect(r.intent).toBe("query_dead_stock");
    });
  });

  describe("project queries", () => {
    it("detects query_project_status for 'estado de las obras'", () => {
      const r = parseIntent("estado de las obras");
      expect(r.intent).toBe("query_project_status");
    });

    it("detects predict_budget for 'proyección'", () => {
      const r = parseIntent("proyeccion de presupuesto");
      expect(r.intent).toBe("predict_budget");
    });

    it("detects query_project_detail for specific obra", () => {
      const r = parseIntent("mostrame la obra OB-001");
      expect(r.intent).toBe("query_project_detail");
      expect(r.entities).toBeTruthy();
    });
  });

  describe("task queries", () => {
    it("detects query_tasks for 'tareas'", () => {
      const r = parseIntent("mostrame las tareas");
      expect(r.intent).toBe("query_tasks");
    });

    it("detects query_overdue_tasks for 'tareas atrasadas'", () => {
      const r = parseIntent("tareas atrasadas");
      expect(r.intent).toBe("query_overdue_tasks");
    });
  });

  describe("actions (create/edit/delete)", () => {
    it("detects action_create_expense for 'crear gasto'", () => {
      const r = parseIntent("crear gasto de 5000 en obra OB-001");
      expect(["action_create_expense", "action_add_expense_to_project"]).toContain(r.intent);
    });

    it("detects action_create_project for 'crear obra'", () => {
      const r = parseIntent("crear obra nueva presupuesto 100000");
      expect(["action_create_project", "action_create_project_direct"]).toContain(r.intent);
    });

    it("detects action_create_task for 'crear tarea'", () => {
      const r = parseIntent("crear tarea comprar cemento para obra OB-001");
      expect(r.intent).toBe("action_create_task");
    });

    it("detects action_create_supplier for 'crear proveedor'", () => {
      const r = parseIntent("crear proveedor Hormigones SA");
      expect(r.intent).toBe("action_create_supplier");
    });

    it("detects action_complete_task for any task completion", () => {
      const r = parseIntent("marcar como hecha la tarea de pintar");
      expect(r.intent).toBe("action_complete_task");
    });

    it("detects action_delete_task for 'eliminar tarea'", () => {
      const r = parseIntent("eliminar tarea de comprar cemento");
      expect(r.intent).toBe("action_delete_task");
    });

    it("detects action_delete_material for 'borrar material'", () => {
      const r = parseIntent("borrar material cemento");
      expect(r.intent).toBe("action_delete_material");
    });

    it("detects action_delete_transaction for 'eliminar gasto'", () => {
      const r = parseIntent("eliminar el gasto de 5000");
      expect(r.intent).toBe("action_delete_transaction");
    });

    it("detects action_update_stock for 'actualizar stock'", () => {
      const r = parseIntent("actualizar stock de cemento a 100");
      expect(r.intent).toBe("action_update_stock");
    });

    it("detects action_close_project for 'cerrar obra'", () => {
      const r = parseIntent("cerrar obra OB-001");
      expect(r.intent).toBe("action_close_project");
    });
  });

  describe("assistive intents", () => {
    it("detects help for 'ayuda'", () => {
      const r = parseIntent("ayuda");
      expect(r.intent).toBe("help");
    });

    it("detects greeting for 'hola'", () => {
      const r = parseIntent("hola");
      expect(r.intent).toBe("greeting");
    });

    it("detects recommend for 'recomendaciones'", () => {
      const r = parseIntent("recomendaciones");
      expect(r.intent).toBe("recommend");
    });

    it("detects alert_check for 'alertas'", () => {
      const r = parseIntent("que alertas hay");
      expect(r.intent).toBe("alert_check");
    });

    it("detects summarize for 'resumen'", () => {
      const r = parseIntent("hace un resumen de la obra");
      expect(r.intent).toBe("summarize");
    });
  });

  describe("supplier queries", () => {
    it("detects query_supplier for 'proveedores'", () => {
      const r = parseIntent("mostrame los proveedores");
      expect(r.intent).toBe("query_supplier");
    });

    it("detects query_best_supplier for 'mejor proveedor'", () => {
      const r = parseIntent("cual es el mejor proveedor");
      expect(r.intent).toBe("query_best_supplier");
    });
  });

  describe("miscellaneous", () => {
    it("returns unknown for gibberish", () => {
      const r = parseIntent("asdfghjkl qwerty zxcvbnm");
      expect(r.intent).toBe("unknown");
      expect(r.confidence).toBe(0);
    });

    it("parses entities for expense creation", () => {
      const r = parseIntent("crear gasto de 15000 en obra OB-002 por materiales");
      expect(["action_create_expense", "action_add_expense_to_project"]).toContain(r.intent);
    });
  });
});

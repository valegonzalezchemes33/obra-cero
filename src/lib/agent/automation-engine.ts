import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { getStockSummary, getProjectSummary } from "@/lib/agent/queries";
import type { AgentActionItem } from "@/lib/agent";

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
    const { triggerWorkflows } = await import("../workflow-engine");

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

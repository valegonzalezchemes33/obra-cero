import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCached } from "@/lib/cache";
import { apiLogger } from "@/lib/logger";
import { getTenant } from "@/lib/tenant";

export async function GET() {
  try {
    const tenant = await getTenant();
    const orgId = tenant.organizationId;
    const data = await getCached(`dashboard:full:${orgId}`, async () => {
      const now = new Date();
      const orgWhere = { organizationId: orgId };

      const [incomeAgg, expenseAgg] = await Promise.all([
        db.transaction.aggregate({ where: { ...orgWhere, type: "income" }, _sum: { amount: true } }),
        db.transaction.aggregate({ where: { ...orgWhere, type: "expense" }, _sum: { amount: true } }),
      ]);
      const totalIncome = incomeAgg._sum.amount ?? 0;
      const totalExpenses = expenseAgg._sum.amount ?? 0;
      const profit = totalIncome - totalExpenses;
      const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

      const [expenseByCategory, incomeByCategory, stockAgg, counts] = await Promise.all([
        db.transaction.groupBy({ by: ["category"], where: { ...orgWhere, type: "expense" }, _sum: { amount: true } }),
        db.transaction.groupBy({ by: ["category"], where: { ...orgWhere, type: "income" }, _sum: { amount: true } }),
        db.material.aggregate({ where: orgWhere, _sum: { stock: true, unitCost: true } }),
        Promise.all([
          db.material.count({ where: orgWhere }),
          db.supplier.count({ where: orgWhere }),
          db.project.count({ where: orgWhere }),
          db.project.count({ where: { ...orgWhere, status: "in_progress" } }),
          db.task.count({ where: { ...orgWhere, status: { in: ["pending", "in_progress"] } } }),
          db.task.count({ where: { ...orgWhere, dueDate: { lt: now }, status: { in: ["pending", "in_progress"] } } }),
        ]),
      ]);
      const [totalMaterials, totalSuppliers, totalProjects, activeProjects, pendingTasks, overdueTasks] = counts;

      const expenseByCategoryMap: Record<string, number> = {};
      for (const g of expenseByCategory) expenseByCategoryMap[g.category] = g._sum.amount ?? 0;
      const incomeByCategoryMap: Record<string, number> = {};
      for (const g of incomeByCategory) incomeByCategoryMap[g.category] = g._sum.amount ?? 0;

      const stockValue = stockAgg._sum.stock && stockAgg._sum.unitCost
        ? stockAgg._sum.stock * stockAgg._sum.unitCost : 0;

      const [budgetAgg, spentAgg] = await Promise.all([
        db.project.aggregate({ where: orgWhere, _sum: { budget: true, progress: true } }),
        db.transaction.aggregate({ where: { ...orgWhere, type: "expense", projectId: { not: null } }, _sum: { amount: true } }),
      ]);
      const totalBudget = budgetAgg._sum.budget ?? 0;
      const totalSpentOnProjects = spentAgg._sum.amount ?? 0;
      const avgProgress = totalProjects > 0 ? (budgetAgg._sum.progress ?? 0) / totalProjects : 0;

      const [materials, projectRows, tasks, suppliers] = await Promise.all([
        db.material.findMany({ where: orgWhere, select: { id: true, name: true, sku: true, stock: true, minStock: true, unit: true, unitCost: true, category: true }, orderBy: { name: "asc" } }),
        db.project.findMany({ where: orgWhere, select: { id: true, code: true, name: true, budget: true, progress: true, status: true, type: true, address: true, clientName: true, startDate: true, endDate: true }, orderBy: { code: "asc" } }),
        db.task.findMany({ where: orgWhere, select: { id: true, title: true, status: true, priority: true, dueDate: true, projectId: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
        db.supplier.findMany({ where: orgWhere, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      ]);

      const lowStock = materials.filter((m) => m.stock <= m.minStock && m.minStock > 0);
      const outOfStock = materials.filter((m) => m.stock <= 0);

      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const cashflowTx = await db.transaction.findMany({
        where: { ...orgWhere, date: { gte: sixMonthsAgo } },
        select: { type: true, amount: true, date: true },
        orderBy: { date: "asc" },
      });
      const cashflowByMonth: Record<string, { income: number; expense: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        cashflowByMonth[key] = { income: 0, expense: 0 };
      }
      for (const t of cashflowTx) {
        const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
        if (cashflowByMonth[key]) cashflowByMonth[key][t.type === "income" ? "income" : "expense"] += t.amount;
      }
      const cashflow = Object.entries(cashflowByMonth).map(([key, val]) => {
        const [y, m] = key.split("-");
        const d = new Date(parseInt(y), parseInt(m) - 1);
        return { month: d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" }), ...val };
      });

      const projectExpensesData = await db.transaction.groupBy({
        by: ["projectId"],
        where: { ...orgWhere, type: "expense", projectId: { not: null } },
        _sum: { amount: true },
      });
      const projectIncomeData = await db.transaction.groupBy({
        by: ["projectId"],
        where: { ...orgWhere, type: "income", projectId: { not: null } },
        _sum: { amount: true },
      });
      const projectExpenseMap = new Map(projectExpensesData.map((p) => [p.projectId, p._sum.amount ?? 0]));
      const projectIncomeMap = new Map(projectIncomeData.map((p) => [p.projectId, p._sum.amount ?? 0]));
      const projectExpenses = projectRows
        .map((p) => ({
          id: p.id, code: p.code, name: p.name,
          budget: p.budget,
          spent: projectExpenseMap.get(p.id) ?? 0,
          income: projectIncomeMap.get(p.id) ?? 0,
          progress: p.progress, status: p.status,
        }))
        .sort((a, b) => b.spent - a.spent);

      const recentTx = await db.transaction.findMany({
        where: { ...orgWhere, type: "expense" },
        select: { id: true, description: true, amount: true, category: true, date: true, projectId: true },
        orderBy: { date: "desc" },
        take: 5,
      });
      const projectCodeMap = new Map(projectRows.map((p) => [p.id, p.code]));
      const recentExpenses = recentTx.map((t) => ({
        id: t.id, description: t.description, amount: t.amount, category: t.category, date: t.date,
        project: projectCodeMap.get(t.projectId ?? "") ?? null,
      }));

      const projectCodeMapFull = new Map(projectRows.map((p) => [p.id, p.code]));
      const taskList = tasks.map((t) => ({
        ...t,
        projectCode: t.projectId ? projectCodeMapFull.get(t.projectId) ?? null : null,
      }));

      return {
        kpis: {
          totalIncome, totalExpenses, profit, margin, stockValue,
          lowStockCount: lowStock.length, outOfStockCount: outOfStock.length,
          activeProjects, totalProjects, totalBudget, totalSpentOnProjects, avgProgress,
          pendingTasks, overdueTasks, totalSuppliers, totalMaterials,
        },
        cashflow, expenseByCategory: expenseByCategoryMap, incomeByCategory: incomeByCategoryMap,
        lowStock, outOfStock, projectExpenses, recentExpenses,
        projects: projectRows.map((p) => ({
          ...p,
          spent: projectExpenseMap.get(p.id) ?? 0,
          income: projectIncomeMap.get(p.id) ?? 0,
        })),
        tasks: taskList,
      };
    }, 15000);

    return NextResponse.json(data);
  } catch (error: any) {
    apiLogger.error({ module: "API", path: "/api/dashboard" }, error.message)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const [transactions, materials, projects, tasks, suppliers] = await Promise.all([
    db.transaction.findMany({ include: { project: true } }),
    db.material.findMany({ include: { supplier: true } }),
    db.project.findMany({ include: { transactions: true, tasks: true } }),
    db.task.findMany(),
    db.supplier.findMany(),
  ]);

  const income = transactions.filter((t) => t.type === "income");
  const expenses = transactions.filter((t) => t.type === "expense");
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
  const profit = totalIncome - totalExpenses;
  const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

  // Por categoría
  const expenseByCategory: Record<string, number> = {};
  for (const t of expenses) {
    expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
  }
  const incomeByCategory: Record<string, number> = {};
  for (const t of income) {
    incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
  }

  // Flujo de caja por mes (últimos 6)
  const now = new Date();
  const cashflow: { month: string; income: number; expense: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
    const monthTx = transactions.filter((t) => {
      const tk = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
      return tk === key;
    });
    cashflow.push({
      month: label,
      income: monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
      expense: monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    });
  }

  // Stock
  const stockValue = materials.reduce((s, m) => s + m.stock * m.unitCost, 0);
  const lowStock = materials.filter((m) => m.stock <= m.minStock && m.minStock > 0);
  const outOfStock = materials.filter((m) => m.stock <= 0);

  // Proyectos
  const activeProjects = projects.filter((p) => p.status === "in_progress");
  const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
  const totalSpentOnProjects = projects.reduce(
    (s, p) => s + p.transactions.filter((t) => t.type === "expense").reduce((ss, t) => ss + t.amount, 0),
    0
  );
  const avgProgress =
    projects.length > 0 ? projects.reduce((s, p) => s + p.progress, 0) / projects.length : 0;

  // Gastos por proyecto
  const projectExpenses = projects
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      budget: p.budget,
      spent: p.transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
      income: p.transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
      progress: p.progress,
      status: p.status,
    }))
    .sort((a, b) => b.spent - a.spent);

  // Top 5 gastos recientes
  const recentExpenses = expenses
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      category: t.category,
      date: t.date,
      project: t.project?.code,
    }));

  // Tareas
  const pendingTasks = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate < now && (t.status === "pending" || t.status === "in_progress")
  );

  return NextResponse.json({
    kpis: {
      totalIncome,
      totalExpenses,
      profit,
      margin,
      stockValue,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      activeProjects: activeProjects.length,
      totalProjects: projects.length,
      totalBudget,
      totalSpentOnProjects,
      avgProgress,
      pendingTasks: pendingTasks.length,
      overdueTasks: overdueTasks.length,
      totalSuppliers: suppliers.length,
      totalMaterials: materials.length,
    },
    cashflow,
    expenseByCategory,
    incomeByCategory,
    lowStock,
    outOfStock,
    projectExpenses,
    recentExpenses,
    projects: projects.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      status: p.status,
      type: p.type,
      address: p.address,
      clientName: p.clientName,
      budget: p.budget,
      progress: p.progress,
      startDate: p.startDate,
      endDate: p.endDate,
      spent: p.transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
      income: p.transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    })),
    tasks: tasks.map((t) => ({
      ...t,
      projectCode: t.projectId ? projects.find((p) => p.id === t.projectId)?.code : null,
    })),
  });
}

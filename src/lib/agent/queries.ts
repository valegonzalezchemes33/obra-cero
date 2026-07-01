import { db } from "@/lib/db";

export async function getFinancialSummary() {
  const transactions = await db.transaction.findMany({
    include: { project: true },
    orderBy: { date: "desc" },
    take: 5000,
  });
  const income = transactions.filter((t) => t.type === "income");
  const expenses = transactions.filter((t) => t.type === "expense");
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
  const profit = totalIncome - totalExpenses;
  const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;
  return { transactions, income, expenses, totalIncome, totalExpenses, profit, margin };
}

export async function getStockSummary() {
  const materials = await db.material.findMany({
    include: { supplier: true },
  });
  const totalValue = materials.reduce((s, m) => s + m.stock * m.unitCost, 0);
  const lowStock = materials.filter((m) => m.stock <= m.minStock && m.minStock > 0);
  const outOfStock = materials.filter((m) => m.stock <= 0);
  return { materials, totalValue, lowStock, outOfStock };
}

export async function getDeadStockSummary() {
  const materials = await db.material.findMany({
    where: { stock: { gt: 0 } },
    select: {
      id: true, name: true, sku: true, stock: true, unitCost: true, unit: true,
      stockMovements: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
    },
  });
  const now = Date.now();
  const deadStock = materials
    .map((m) => {
      const last = m.stockMovements[0];
      const daysSince = last ? Math.floor((now - last.date.getTime()) / (1000 * 60 * 60 * 24)) : 999;
      return { ...m, daysSince, lastDate: last?.date };
    })
    .filter((m) => m.daysSince > 60)
    .sort((a, b) => b.daysSince - a.daysSince);
  const total = deadStock.reduce((s, m) => s + m.stock * m.unitCost, 0);
  return { deadStock, total };
}

export async function getProjectSummary() {
  const projects = await db.project.findMany({
    include: { transactions: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const active = projects.filter((p) => p.status === "in_progress");
  return { projects, active };
}

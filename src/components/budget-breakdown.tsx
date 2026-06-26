"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPct, chartColor } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DollarSign, TrendingUp, TrendingDown, BarChart3, Target, AlertTriangle } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { ChartTooltip, chartAxisProps, chartGridProps } from "@/components/chart-utils";

interface ProjectData {
  id: string;
  code: string;
  name: string;
  budget: number;
  spent: number;
  income: number;
  progress: number;
  status: string;
}

interface BudgetBreakdownProps {
  projectId: string;
  projectName: string;
  projectCode: string;
  budget: number;
  spent: number;
  income: number;
}

export function BudgetBreakdown({
  projectId,
  projectName,
  projectCode,
  budget,
  spent,
  income,
}: BudgetBreakdownProps) {
  // Obtener transacciones de este proyecto para desglose por categoría
  const { data: transactions } = useQuery({
    queryKey: ["transactions-project", projectId],
    queryFn: async () => {
      const r = await fetch(`/api/transactions?projectId=${projectId}&limit=100`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  // Agrupar por categoría
  const expensesByCategory: Record<string, number> = {};
  const incomeByCategory: Record<string, number> = {};

  (transactions || []).forEach((t: any) => {
    if (t.type === "expense") {
      expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
    } else {
      incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
    }
  });

  const expenseData = Object.entries(expensesByCategory)
    .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
    .sort((a, b) => b.value - a.value);

  const incomeData = Object.entries(incomeByCategory)
    .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
    .sort((a, b) => b.value - a.value);

  const budgetPct = budget > 0 ? (spent / budget) * 100 : 0;
  const remaining = Math.max(0, budget - spent);
  const margin = income > 0 ? ((income - spent) / income) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Resumen rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-muted/50 space-y-1">
          <span className="micro-label text-muted-foreground/70">Presupuesto</span>
          <div className="text-[15px] font-display tabular">{formatCurrency(budget)}</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 space-y-1">
          <span className="micro-label text-muted-foreground/70">Ejecutado</span>
          <div className="text-[15px] font-display tabular text-destructive">{formatCurrency(spent)}</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 space-y-1">
          <span className="micro-label text-muted-foreground/70">Disponible</span>
          <div className={`text-[15px] font-display tabular ${remaining < 100000 ? "text-warning" : "text-success"}`}>
            {formatCurrency(remaining)}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 space-y-1">
          <span className="micro-label text-muted-foreground/70">Margen</span>
          <div className={`text-[15px] font-display tabular ${margin >= 0 ? "text-success" : "text-destructive"}`}>
            {formatPct(margin)}
          </div>
        </div>
      </div>

      {/* Barra de ejecución presupuestaria */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            Ejecución presupuestaria
          </span>
          <span className={`font-medium tabular ${budgetPct > 90 ? "text-destructive" : budgetPct > 70 ? "text-warning" : ""}`}>
            {formatPct(budgetPct)}
          </span>
        </div>
        <Progress value={Math.min(100, budgetPct)} className="h-2" />
        <div className="flex justify-between text-[11px] text-muted-foreground tabular">
          <span>{formatCurrency(spent)} gastados</span>
          <span>{formatCurrency(remaining)} disponibles</span>
        </div>
      </div>

      {/* Alerta si está cerca del límite */}
      {budgetPct > 80 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-warning-soft/50 border border-warning/15 text-[12px]">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <span>
            {budgetPct >= 100
              ? "⚠️ Esta obra superó el presupuesto. Revisar partidas para ajustar."
              : `⚠️ Esta obra ya ejecutó el ${budgetPct.toFixed(0)}% del presupuesto. Controlar gastos restantes.`}
          </span>
        </div>
      )}

      {/* Gráfico de gastos por categoría */}
      {expenseData.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[12px] font-medium flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
            Gastos por categoría
          </h4>
          <div className="space-y-1.5">
            {expenseData.map((item, i) => {
              const pct = spent > 0 ? (item.value / spent) * 100 : 0;
              return (
                <div key={item.name} className="group">
                  <div className="flex items-center justify-between text-[12px] mb-0.5">
                    <span className="text-muted-foreground capitalize">{item.name}</span>
                    <span className="tabular font-medium">{formatCurrency(item.value)}</span>
                  </div>
                  <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: chartColor(i) }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground text-right tabular">
                    {formatPct(pct)} del gasto total
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ingresos por categoría */}
      {incomeData.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[12px] font-medium flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-success" />
            Ingresos por categoría
          </h4>
          {incomeData.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-[12px] py-1">
              <span className="text-muted-foreground capitalize">{item.name}</span>
              <span className="tabular font-medium text-success">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Estado vacío */}
      {expenseData.length === 0 && incomeData.length === 0 && (
        <div className="py-6 text-center text-[13px] text-muted-foreground">
          No hay movimientos registrados para esta obra. Los gastos e ingresos aparecerán acá a medida que los cargues.
        </div>
      )}
    </div>
  );
}

// ─── Modal de desglose completo ───

interface BudgetModalProps {
  project: ProjectData;
  children?: React.ReactNode;
}

export function BudgetBreakdownModal({ project, children }: BudgetModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <BarChart3 className="h-3 w-3 mr-1" />
            Ver presupuesto
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            {project.code} · Presupuesto
          </DialogTitle>
          <CardDescription>
            {project.name} — Ejecución presupuestaria por partida
          </CardDescription>
        </DialogHeader>
        <BudgetBreakdown
          projectId={project.id}
          projectName={project.name}
          projectCode={project.code}
          budget={project.budget}
          spent={project.spent}
          income={project.income}
        />
      </DialogContent>
    </Dialog>
  );
}

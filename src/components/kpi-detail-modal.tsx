"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPct, formatDate } from "@/lib/format";
import { chartColor } from "@/lib/format";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ChartTooltip, chartAxisProps, chartGridProps } from "@/components/chart-utils";
import {
  TrendingUp,
  TrendingDown,
  Package,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
} from "lucide-react";
import type { ViewKey } from "@/components/sidebar-nav";

export type Quadrant = "income" | "expenses" | "inventory" | "budget";

interface KpiDetailModalProps {
  open: boolean;
  quadrant: Quadrant | null;
  data: any;
  onOpenChange: (open: boolean) => void;
  onNavigate: (v: ViewKey) => void;
}

const QUADRANT_CONFIG: Record<Quadrant, { title: string; accent: string; icon: typeof TrendingUp; navigateTo: ViewKey; }> = {
  income: { title: "Detalle de Ingresos", accent: "text-success", icon: TrendingUp, navigateTo: "finances" },
  expenses: { title: "Detalle de Gastos", accent: "text-destructive", icon: TrendingDown, navigateTo: "finances" },
  inventory: { title: "Detalle de Inventario", accent: "text-primary", icon: Package, navigateTo: "inventory" },
  budget: { title: "Detalle de Presupuesto", accent: "text-primary", icon: Building2, navigateTo: "projects" },
};

export function KpiDetailModal({ open, quadrant, data, onOpenChange, onNavigate }: KpiDetailModalProps) {
  if (!quadrant || !data) return null;

  const config = QUADRANT_CONFIG[quadrant];
  const k = data.kpis;
  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.accent}`} />
            <DialogTitle>{config.title}</DialogTitle>
          </div>
        </DialogHeader>
        <ScrollArea className="pr-2">
          <div className="space-y-5">
            {quadrant === "income" && <IncomeContent data={data} k={k} />}
            {quadrant === "expenses" && <ExpensesContent data={data} k={k} />}
            {quadrant === "inventory" && <InventoryContent data={data} k={k} />}
            {quadrant === "budget" && <BudgetContent data={data} k={k} />}
            <div className="pt-2 pb-1">
              <Button variant="outline" size="sm" className="w-full" onClick={() => { onOpenChange(false); onNavigate(config.navigateTo); }}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Ver sección completa
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function IncomeContent({ data, k }: { data: any; k: any }) {
  const cashflow = data.cashflow || [];
  const incomeByCategory = Object.entries(data.incomeByCategory || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => (b.value as number) - (a.value as number));

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Total ingresos" value={formatCurrency(k.totalIncome)} accent="success" />
        <SummaryCard label="Margen" value={formatPct(k.margin)} accent={k.profit >= 0 ? "success" : "destructive"} />
        <SummaryCard label="Resultado" value={formatCurrency(k.profit)} accent={k.profit >= 0 ? "success" : "destructive"} />
      </div>

      {incomeByCategory.length > 0 && (
        <div>
          <h4 className="text-[13px] font-medium mb-2">Ingresos por categoría</h4>
          <div className="space-y-1.5">
            {incomeByCategory.slice(0, 8).map((c: any, i: number) => (
              <div key={c.name} className="flex items-center gap-2 text-[12px]">
                <span className="size-2 rounded-sm shrink-0" style={{ background: chartColor(i) }} />
                <span className="flex-1 truncate text-muted-foreground">{c.name}</span>
                <span className="tabular font-medium">{formatCurrency(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cashflow.length > 0 && (
        <div>
          <h4 className="text-[13px] font-medium mb-2">Evolución mensual</h4>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={cashflow} barGap={2} barCategoryGap="20%">
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="month" {...chartAxisProps} />
              <YAxis {...chartAxisProps} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
              <Bar dataKey="income" name="Ingresos" fill={chartColor(1)} radius={[3, 3, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

function ExpensesContent({ data, k }: { data: any; k: any }) {
  const cashflow = data.cashflow || [];
  const expenseByCategory = Object.entries(data.expenseByCategory || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => (b.value as number) - (a.value as number));

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Total gastos" value={formatCurrency(k.totalExpenses)} accent="destructive" />
        <SummaryCard label="Obras activas" value={`${k.activeProjects}/${k.totalProjects}`} accent="primary" />
        <SummaryCard label="Stock en valor" value={formatCurrency(k.stockValue)} accent="primary" />
      </div>

      {expenseByCategory.length > 0 && (
        <div>
          <h4 className="text-[13px] font-medium mb-2">Gastos por categoría</h4>
          <div className="space-y-1.5">
            {expenseByCategory.slice(0, 8).map((c: any, i: number) => (
              <div key={c.name} className="flex items-center gap-2 text-[12px]">
                <span className="size-2 rounded-sm shrink-0" style={{ background: chartColor(i) }} />
                <span className="flex-1 truncate text-muted-foreground">{c.name}</span>
                <span className="tabular font-medium">{formatCurrency(c.value)}</span>
                <span className="text-[11px] text-muted-foreground tabular">
                  {formatPct(k.totalExpenses > 0 ? ((c.value as number) / k.totalExpenses) * 100 : 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.recentExpenses?.length > 0 && (
        <div>
          <h4 className="text-[13px] font-medium mb-2">Últimos gastos</h4>
          <div className="space-y-1">
            {data.recentExpenses.slice(0, 5).map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50 text-[12px]">
                <div className="flex-1 min-w-0">
                  <span className="font-medium truncate block">{tx.description || "Sin descripción"}</span>
                  <span className="text-[11px] text-muted-foreground">{formatDate(tx.date)} · {tx.category}</span>
                </div>
                <span className="tabular font-medium text-destructive ml-3">{formatCurrency(tx.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cashflow.length > 0 && (
        <div>
          <h4 className="text-[13px] font-medium mb-2">Evolución mensual</h4>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={cashflow} barGap={2} barCategoryGap="20%">
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="month" {...chartAxisProps} />
              <YAxis {...chartAxisProps} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
              <Bar dataKey="expense" name="Gastos" fill={chartColor(5)} radius={[3, 3, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

function InventoryContent({ data, k }: { data: any; k: any }) {
  const outOfStock = data.outOfStock || [];
  const lowStock = data.lowStock || [];

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Valor en stock" value={formatCurrency(k.stockValue)} accent="primary" />
        <SummaryCard label="Materiales" value={String(k.totalMaterials)} accent="primary" />
        <SummaryCard label="Sin stock" value={String(k.outOfStockCount)} accent={k.outOfStockCount > 0 ? "destructive" : "success"} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3 space-y-1.5">
            <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Stock bajo</div>
            <div className="text-[24px] font-display tabular">{k.lowStockCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 space-y-1.5">
            <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Sin stock</div>
            <div className="text-[24px] font-display tabular">{k.outOfStockCount}</div>
          </CardContent>
        </Card>
      </div>

      {outOfStock.length > 0 && (
        <div>
          <h4 className="text-[13px] font-medium mb-2 text-destructive flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-destructive" />
            Sin stock
          </h4>
          <div className="space-y-1">
            {outOfStock.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between px-2 py-1.5 rounded-md border border-destructive/10 bg-destructive/5 text-[12px]">
                <div className="min-w-0">
                  <div className="font-medium truncate">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{m.sku}</div>
                </div>
                <Badge variant="destructive">0 {m.unit}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {lowStock.length > 0 && (
        <div>
          <h4 className="text-[13px] font-medium mb-2 text-warning flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-warning" />
            Por debajo del mínimo
          </h4>
          <div className="space-y-1">
            {lowStock.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between px-2 py-1.5 rounded-md border border-warning/10 bg-warning-soft/30 text-[12px]">
                <div className="min-w-0">
                  <div className="font-medium truncate">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{m.sku}</div>
                </div>
                <span className="tabular text-warning font-medium">{m.stock} / {m.minStock} {m.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function BudgetContent({ data, k }: { data: any; k: any }) {
  const projectExpenses = data.projectExpenses || [];

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Presupuesto total" value={formatCurrency(k.totalBudget)} accent="primary" />
        <SummaryCard label="Ejecutado" value={formatCurrency(k.totalSpentOnProjects)} accent={k.totalSpentOnProjects > k.totalBudget ? "destructive" : "success"} />
        <SummaryCard label="Obras activas" value={`${k.activeProjects}/${k.totalProjects}`} accent="primary" />
      </div>

      <Card>
        <CardContent className="p-3 space-y-1">
          <div className="flex justify-between text-[12px]">
            <span className="text-muted-foreground">Ejecución general</span>
            <span className="tabular font-medium">
              {k.totalBudget > 0 ? formatPct((k.totalSpentOnProjects / k.totalBudget) * 100) : "0%"}
            </span>
          </div>
          <Progress
            value={k.totalBudget > 0 ? Math.min(100, (k.totalSpentOnProjects / k.totalBudget) * 100) : 0}
            className="h-2"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground tabular">
            <span>{formatCurrency(k.totalSpentOnProjects)} ejecutado</span>
            <span>{formatCurrency(Math.max(0, k.totalBudget - k.totalSpentOnProjects))} restante</span>
          </div>
        </CardContent>
      </Card>

      {projectExpenses.length > 0 && (
        <div>
          <h4 className="text-[13px] font-medium mb-2">Presupuesto por obra</h4>
          <div className="space-y-3">
            {projectExpenses.map((p: any) => {
              const pct = p.budget > 0 ? (p.spent / p.budget) * 100 : 0;
              const overBudget = pct > 100;
              return (
                <div key={p.id} className="space-y-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium truncate">{p.code} · {p.name}</span>
                    <div className="flex items-center gap-2">
                      {overBudget && <Badge variant="destructive" className="text-[10px] px-1 py-0">Excedido</Badge>}
                      <span className="tabular text-muted-foreground">{formatPct(pct)}</span>
                    </div>
                  </div>
                  <Progress
                    value={Math.min(100, pct)}
                    className={`h-1.5 ${overBudget ? "[&>div]:bg-destructive" : ""}`}
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground tabular">
                    <span>{formatCurrency(p.spent)}</span>
                    <span>de {formatCurrency(p.budget)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent: "success" | "destructive" | "primary" }) {
  const accentMap: Record<string, string> = {
    success: "text-success",
    destructive: "text-destructive",
    primary: "text-foreground",
  };
  return (
    <Card>
      <CardContent className="p-3 space-y-1">
        <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</div>
        <div className={`text-[18px] font-display tabular leading-tight ${accentMap[accent]}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

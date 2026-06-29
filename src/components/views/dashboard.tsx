"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { KpiCard, SkeletonKpi } from "@/components/kpi-card";
import { KpiDetailModal, type Quadrant } from "@/components/kpi-detail-modal";
import { ChartTooltip, chartAxisProps, chartGridProps } from "@/components/chart-utils";
import { chartColor } from "@/lib/format";
import { formatCurrency, formatPct, formatDate, STATUS_DOT, STATUS_LABELS } from "@/lib/format";
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
import { ArrowUpRight, ArrowDownRight, Sparkles, Building2, AlertTriangle, Clock, CheckCircle2, ChevronRight, TrendingUp, Lightbulb, Zap, BarChart3 } from "lucide-react";
import { ViewKey } from "@/components/sidebar-nav";
import type { ReactNode } from "react";
import { useState } from "react";

interface DashboardProps {
  onNavigate: (v: ViewKey) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [detailQuadrant, setDetailQuadrant] = useState<Quadrant | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard");
      if (!r.ok) throw new Error("Error al cargar el panel");
      return r.json();
    },
  });

  // Datos de insights del asistente (separado para no bloquear el panel)
  const { data: agentData } = useQuery({
    queryKey: ["dashboard-insights"],
    queryFn: async () => {
      try {
        const r = await fetch("/api/dashboard/insights");
        if (!r.ok) return null;
        return r.json();
      } catch {
        return null;
      }
    },
    refetchInterval: 120000, // cada 2 minutos
  });

  if (isLoading || !data || !data.kpis) {
    return (
      <div className="space-y-6">
        <div className="h-40 bg-card rounded-lg border shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonKpi key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-72 bg-card rounded-lg border shimmer" />
          <div className="h-72 bg-card rounded-lg border shimmer" />
        </div>
      </div>
    );
  }

  const k = data.kpis;
  const isEmpty = k.totalMaterials === 0 && k.totalProjects === 0;

  if (isEmpty) {
    return <EmptyState onNavigate={onNavigate} />;
  }

  const cashflow = data.cashflow;
  const expenseByCategory = Object.entries(data.expenseByCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => (b.value as number) - (a.value as number))
    .slice(0, 5);
  const otherTotal = Object.entries(data.expenseByCategory)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(5)
    .reduce((s, [, v]) => s + (v as number), 0);
  if (otherTotal > 0) expenseByCategory.push({ name: "Otros", value: otherTotal });

  const projectExpenses = data.projectExpenses.slice(0, 5);
  const lowStockCount = k.lowStockCount + k.outOfStockCount;

  // Sparkline data — last 6 months of net result
  const sparkNet = cashflow.map((c: any) => c.income - c.expense);
  const sparkIncome = cashflow.map((c: any) => c.income);
  const sparkExpense = cashflow.map((c: any) => c.expense);

  // Delta vs last month
  const lastTwo = cashflow.slice(-2);
  const incomeDelta = lastTwo.length === 2 && lastTwo[0].income > 0
    ? ((lastTwo[1].income - lastTwo[0].income) / lastTwo[0].income) * 100
    : 0;
  const expenseDelta = lastTwo.length === 2 && lastTwo[0].expense > 0
    ? ((lastTwo[1].expense - lastTwo[0].expense) / lastTwo[0].expense) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Hero — Resultado acumulado */}
      <Card className="overflow-hidden">
        <div className="relative px-6 py-5">
          {/* Subtle texture gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent pointer-events-none" />
          <div className="relative flex items-center gap-2 mb-3">
            <span className="micro-label text-muted-foreground/80">Resultado acumulado</span>
            <Badge variant={k.profit >= 0 ? "success" : "destructive"} className="ml-auto tabular">
              <span className={`size-1.5 rounded-full ${k.profit >= 0 ? "bg-success" : "bg-destructive"}`} />
              Margen {formatPct(k.margin)}
            </Badge>
          </div>
          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <div className="text-[40px] font-display-lg tracking-tight tabular leading-none">
                {formatCurrency(k.profit)}
              </div>
              <div className="flex items-center gap-4 mt-3 text-[13px]">
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex size-5 items-center justify-center rounded bg-success-soft text-success">
                    <ArrowUpRight className="h-3 w-3" />
                  </span>
                  <span className="tabular font-medium">{formatCurrency(k.totalIncome)}</span>
                  <span className="text-muted-foreground text-[12px]">ingresos</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex size-5 items-center justify-center rounded bg-destructive/10 text-destructive">
                    <ArrowDownRight className="h-3 w-3" />
                  </span>
                  <span className="tabular font-medium">{formatCurrency(k.totalExpenses)}</span>
                  <span className="text-muted-foreground text-[12px]">gastos</span>
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-px bg-border rounded-md overflow-hidden border border-border">
              <HeroStat label="Obras activas" value={`${k.activeProjects}/${k.totalProjects}`} />
              <HeroStat label="Valor en stock" value={formatCurrency(k.stockValue)} />
              <HeroStat label="Tareas pend." value={String(k.pendingTasks)} />
            </div>
          </div>
        </div>
      </Card>

      {/* KPIs Stripe-style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Ingresos"
          value={formatCurrency(k.totalIncome)}
          delta={incomeDelta !== 0 ? { value: incomeDelta, label: "vs mes anterior" } : undefined}
          sparkline={sparkIncome}
          accent="success"
          onClick={() => setDetailQuadrant("income")}
        />
        <KpiCard
          label="Gastos"
          value={formatCurrency(k.totalExpenses)}
          delta={expenseDelta !== 0 ? { value: -expenseDelta, label: "vs mes anterior" } : undefined}
          sparkline={sparkExpense}
          accent="destructive"
          onClick={() => setDetailQuadrant("expenses")}
        />
        <KpiCard
          label="Inventario"
          value={formatCurrency(k.stockValue)}
          accent="primary"
          onClick={() => setDetailQuadrant("inventory")}
        />
        <KpiCard
          label="Presupuesto obras"
          value={formatCurrency(k.totalBudget)}
          accent="primary"
          onClick={() => setDetailQuadrant("budget")}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Flujo de caja</CardTitle>
            <CardDescription>Ingresos y gastos · últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={cashflow} barGap={2} barCategoryGap="28%">
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="month" {...chartAxisProps} />
                <YAxis {...chartAxisProps} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
                <Bar dataKey="income" name="Ingresos" fill={chartColor(1)} radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="expense" name="Gastos" fill={chartColor(5)} radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Gastos por categoría</CardTitle>
            <CardDescription>Distribución del total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={42}
                    paddingAngle={1.5}
                    stroke="none"
                  >
                    {expenseByCategory.map((_, i) => (
                      <Cell key={i} fill={chartColor(i)} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {expenseByCategory.map((c: any, i: number) => (
                  <div key={c.name} className="flex items-center gap-2 text-[12px]">
                    <span className="size-2 rounded-sm shrink-0" style={{ background: chartColor(i) }} />
                    <span className="flex-1 truncate text-muted-foreground">{c.name}</span>
                    <span className="tabular font-medium">{typeof c.value === "number" ? formatCurrency(c.value) : "$0"}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Three column row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Stock alerts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                Reponer inventario
              </CardTitle>
              {lowStockCount > 0 && (
                <Button variant="ghost" size="xs" onClick={() => onNavigate("inventory")}>
                  Ver todo <ChevronRight className="h-3 w-3" />
                </Button>
              )}
            </div>
            <CardDescription>Materiales bajo punto de pedido</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-72 overflow-y-auto">
            {data.outOfStock.length === 0 && data.lowStock.length === 0 && (
              <p className="text-[13px] text-muted-foreground py-4 text-center">Todo el stock está por encima del mínimo.</p>
            )}
            {data.outOfStock.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between px-2 py-2 rounded-md border border-destructive/15 bg-destructive/5">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{m.sku}</div>
                </div>
                <Badge variant="destructive" className="tabular">Sin stock</Badge>
              </div>
            ))}
            {data.lowStock.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between px-2 py-2 rounded-md border border-warning/15 bg-warning-soft/50">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground tabular">{m.stock} {m.unit} · mínimo {m.minStock}</div>
                </div>
                <Badge variant="warning" className="tabular">Bajo</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top projects */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                Obras con mayor gasto
              </CardTitle>
              <Button variant="ghost" size="xs" onClick={() => onNavigate("projects")}>
                Ver todas <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
            <CardDescription>Presupuesto ejecutado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5 max-h-72 overflow-y-auto">
            {projectExpenses.length === 0 ? (
              <p className="text-[13px] text-muted-foreground py-4 text-center">Sin obras para mostrar.</p>
            ) : (
              projectExpenses.map((p: any) => {
                const pct = p.budget > 0 ? (p.spent / p.budget) * 100 : 0;
                return (
                  <div key={p.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-medium truncate">{p.code} · {p.name}</span>
                      <span className="text-[11px] text-muted-foreground tabular">{formatPct(pct)}</span>
                    </div>
                    <Progress value={Math.min(100, pct)} className="h-1" />
                    <div className="flex justify-between text-[11px] text-muted-foreground tabular">
                      <span>{formatCurrency(p.spent)}</span>
                      <span>de {formatCurrency(p.budget)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Pendientes del equipo
              </CardTitle>
              <Button variant="ghost" size="xs" onClick={() => onNavigate("tasks")}>
                Ver todas <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
            <CardDescription>
              {k.overdueTasks > 0 && <span className="text-destructive">{k.overdueTasks} atrasadas · </span>}
              {k.pendingTasks} en total
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 max-h-72 overflow-y-auto">
            {data.tasks
              .filter((t: any) => t.status === "pending" || t.status === "in_progress")
              .slice(0, 6)
              .map((t: any) => {
                const overdue = t.dueDate && new Date(t.dueDate) < new Date();
                return (
                  <div key={t.id} className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50">
                    <div className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${overdue ? "bg-destructive" : t.priority === "high" ? "bg-warning" : "bg-muted-foreground/50"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">{t.title}</div>
                      <div className="text-[11px] text-muted-foreground tabular">
                        {t.projectCode && <span className="font-mono">{t.projectCode} · </span>}
                        {t.dueDate ? formatDate(t.dueDate) : "Sin fecha"}
                        {overdue && <span className="text-destructive font-medium"> · atrasada</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            {data.tasks.filter((t: any) => t.status === "pending" || t.status === "in_progress").length === 0 && (
              <div className="flex items-center gap-2 p-3 text-[13px] text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                No hay tareas pendientes
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Insights del Asistente ─── */}
      {agentData && (agentData.recommendations || agentData.alerts) && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-[15px] font-display tracking-tight">Insights del asistente</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recomendaciones */}
            {agentData.recommendations?.actions?.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <Lightbulb className="h-3.5 w-3.5 text-warning" />
                      Recomendaciones
                    </CardTitle>
                    <Button variant="ghost" size="xs" onClick={() => onNavigate("agent")}>
                      Ver todas <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                  <CardDescription>Basadas en tus datos actuales</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 max-h-72 overflow-y-auto">
                  {agentData.recommendations.actions.slice(0, 5).map((rec: any, i: number) => (
                    <div
                      key={i}
                      className={`p-3 rounded-md border text-[12px] leading-relaxed ${
                        rec.severity === "critical"
                          ? "bg-destructive/5 border-destructive/15"
                          : rec.severity === "warning"
                          ? "bg-warning-soft/50 border-warning/15"
                          : "bg-info-soft/50 border-info/15"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                          rec.severity === "critical" ? "bg-destructive"
                          : rec.severity === "warning" ? "bg-warning"
                          : "bg-info"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[12px]">{rec.title}</div>
                          <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{rec.description}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Alertas activas */}
            {agentData.alerts?.actions?.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-[13px]">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      Alertas activas
                    </CardTitle>
                    <Button variant="ghost" size="xs" onClick={() => onNavigate("agent")}>
                      Ver todo <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                  <CardDescription>{agentData.alerts.actions.length} detectadas por el asistente</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 max-h-72 overflow-y-auto">
                  {agentData.alerts.actions.slice(0, 5).map((alert: any, i: number) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2.5 p-3 rounded-md border ${
                        alert.severity === "critical"
                          ? "bg-destructive/5 border-destructive/15"
                          : alert.severity === "warning"
                          ? "bg-warning-soft/50 border-warning/15"
                          : "bg-info-soft/50 border-info/15"
                      }`}
                    >
                      <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                        alert.severity === "critical" ? "bg-destructive animate-pulse"
                        : alert.severity === "warning" ? "bg-warning"
                        : "bg-info"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium">{alert.title}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{alert.description}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* ─── Acciones rápidas del asistente ─── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-warning" />
          <h2 className="text-[15px] font-display tracking-tight">Consultas rápidas</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <QuickQueryCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Ganancias"
            description="¿Cuánto gané?"
            accent="success"
            onClick={() => onNavigate("agent")}
          />
          <QuickQueryCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Alertas"
            description="¿Qué alertas hay?"
            accent="warning"
            onClick={() => onNavigate("agent")}
          />
          <QuickQueryCard
            icon={<Lightbulb className="h-4 w-4" />}
            label="Recomendaciones"
            description="¿Qué me recomendás?"
            accent="primary"
            onClick={() => onNavigate("agent")}
          />
          <QuickQueryCard
            icon={<Building2 className="h-4 w-4" />}
            label="Stock bajo"
            description="¿Qué materiales faltan?"
            accent="destructive"
            onClick={() => onNavigate("agent")}
          />
          <QuickQueryCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="Comparar"
            description="Comparar con mes anterior"
            accent="info"
            onClick={() => onNavigate("agent")}
          />
          <QuickQueryCard
            icon={<Sparkles className="h-4 w-4" />}
            label="Resumen"
            description="¿Cómo vamos?"
            accent="primary"
            onClick={() => onNavigate("agent")}
          />
        </div>
      </section>

      {/* CTA sutil */}
      <Card className="border-dashed">
        <CardContent className="py-4 px-5 flex flex-col md:flex-row items-start md:items-center gap-3 justify-between">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <h3 className="text-[13px] font-medium">Pedile un panorama al asistente</h3>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Probá: "¿cómo vamos?", "¿qué necesito reponer?", "proyección de presupuesto".
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => onNavigate("agent")} className="shrink-0">
            Abrir asistente
          </Button>
        </CardContent>
      </Card>

      <KpiDetailModal
        open={detailQuadrant !== null}
        quadrant={detailQuadrant}
        data={data}
        onOpenChange={(open) => { if (!open) setDetailQuadrant(null); }}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-2.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-[0.06em] font-semibold leading-none">{label}</div>
      <div className="text-[15px] font-display tabular mt-1 leading-none">{value}</div>
    </div>
  );
}

function QuickQueryCard({
  icon,
  label,
  description,
  accent = "primary",
  onClick,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  accent?: "primary" | "success" | "warning" | "destructive" | "info";
  onClick?: () => void;
}) {
  const accentMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary border-primary/15 hover:bg-primary/15",
    success: "bg-success-soft text-success border-success/15 hover:bg-success-soft/80",
    warning: "bg-warning-soft text-warning border-warning/20 hover:bg-warning-soft/80",
    destructive: "bg-destructive/10 text-destructive border-destructive/15 hover:bg-destructive/15",
    info: "bg-info-soft text-info border-info/15 hover:bg-info-soft/80",
  };

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border text-center transition-all duration-150 hover:-translate-y-px hover:shadow-xs group ${accentMap[accent] || accentMap.primary}`}
    >
      <div className="h-6 w-6 flex items-center justify-center group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <span className="text-[11px] font-medium leading-tight">{label}</span>
      <span className="text-[9px] text-muted-foreground/70 leading-tight">{description}</span>
    </button>
  );
}

function EmptyState({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  return (
    <div className="max-w-2xl mx-auto pt-4">
      <div className="text-center mb-8">
        <div className="inline-flex h-11 w-11 rounded-lg bg-muted items-center justify-center mb-4">
          <Building2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-[22px] font-display tracking-tight">Bienvenido a Obra Cero</h1>
        <p className="text-[14px] text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
          Tu sistema arranca vacío. Cargá tu primera obra, proveedor o movimiento
          y el panel empezará a mostrar métricas en tiempo real.
        </p>
      </div>

      <div className="space-y-2">
        <Card className="hover:border-border hover:shadow-xs transition-all cursor-pointer group" onClick={() => onNavigate("projects")}>
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="h-9 w-9 rounded-md bg-warning-soft flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium">Crear tu primera obra</div>
              <p className="text-[12px] text-muted-foreground mt-0.5">Cargá el presupuesto, cliente y plazos del próximo proyecto.</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
          </CardContent>
        </Card>

        <Card className="hover:border-border hover:shadow-xs transition-all cursor-pointer group" onClick={() => onNavigate("inventory")}>
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="h-9 w-9 rounded-md bg-success-soft flex items-center justify-center shrink-0">
              <svg className="h-4 w-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium">Cargar inventario</div>
              <p className="text-[12px] text-muted-foreground mt-0.5">Damos de alta materiales con stock mínimo y costo unitario.</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
          </CardContent>
        </Card>

        <Card className="hover:border-border hover:shadow-xs transition-all cursor-pointer group" onClick={() => onNavigate("finances")}>
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="h-9 w-9 rounded-md bg-destructive/10 flex items-center justify-center shrink-0">
              <svg className="h-4 w-4 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium">Registrar un movimiento</div>
              <p className="text-[12px] text-muted-foreground mt-0.5">Sumá un ingreso o gasto, asociado a una obra o proveedor.</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-3 border-dashed">
        <CardContent className="py-4 px-5 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-medium">¿Querés conocer el asistente?</div>
            <p className="text-[12px] text-muted-foreground">Puede explicarte qué hace y ayudarte a configurar el sistema.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => onNavigate("agent")} className="shrink-0">
            Conocerlo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

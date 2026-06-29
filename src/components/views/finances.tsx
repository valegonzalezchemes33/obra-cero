"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Wallet, TrendingUp, TrendingDown, Trash2, Filter } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ChartTooltip, chartAxisProps, chartGridProps } from "@/components/chart-utils";
import { chartColor } from "@/lib/format";

const CATEGORIES = ["venta", "anticipo", "materiales", "mano_obra", "servicios", "impuestos", "equipos", "alquiler", "transporte", "otros"];

export function FinancesView() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [txType, setTxType] = useState<"income" | "expense">("expense");

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const r = await fetch("/api/transactions?limit=200");
      if (!r.ok) throw new Error("Error al cargar movimientos");
      return r.json();
    },
    staleTime: 60_000,
  });
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const r = await fetch("/api/projects");
      if (!r.ok) throw new Error("Error al cargar obras");
      return r.json();
    },
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const r = await fetch("/api/suppliers");
      if (!r.ok) throw new Error("Error al cargar proveedores");
      return r.json();
    },
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const { data: dash } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard");
      if (!r.ok) throw new Error("Error al cargar dashboard");
      return r.json();
    },
    staleTime: 5 * 60_000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Movimiento registrado");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
    },
    onError: () => {
      toast.error("Error al registrar el movimiento");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await fetch(`/api/transactions/${id}`, { method: "DELETE" }); },
    onSuccess: () => {
      toast.success("Movimiento eliminado");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => {
      toast.error("Error al eliminar el movimiento");
    },
  });

  const filtered = (transactions || []).filter((t: any) => typeFilter === "all" || t.type === typeFilter);
  const totalIncome = (transactions || []).filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + t.amount, 0);
  const totalExpense = (transactions || []).filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0);
  const isEmpty = (transactions?.length || 0) === 0;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      type: txType,
      category: fd.get("category"),
      description: fd.get("description"),
      amount: fd.get("amount"),
      projectId: fd.get("projectId") || null,
      supplierId: fd.get("supplierId") || null,
      method: fd.get("method"),
      date: fd.get("date"),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[13px] text-muted-foreground">
          {isEmpty ? "Aún no cargaste movimientos." : `${transactions.length} ${transactions.length === 1 ? "movimiento" : "movimientos"} registrados`}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" /> Nuevo movimiento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar movimiento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={txType === "income" ? "default" : "outline"} size="sm"
                  className={txType === "income" ? "bg-success hover:bg-success/90" : ""}
                  onClick={() => setTxType("income")}>
                  <TrendingUp className="h-3.5 w-3.5 mr-1" /> Ingreso
                </Button>
                <Button type="button" variant={txType === "expense" ? "default" : "outline"} size="sm"
                  className={txType === "expense" ? "bg-destructive hover:bg-destructive/90" : ""}
                  onClick={() => setTxType("expense")}>
                  <TrendingDown className="h-3.5 w-3.5 mr-1" /> Gasto
                </Button>
              </div>
              <div>
                <Label>Monto (ARS) *</Label>
                <Input name="amount" type="number" step="0.01" required />
              </div>
              <div>
                <Label>Categoría</Label>
                <Select name="category" defaultValue={txType === "income" ? "venta" : "materiales"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descripción *</Label>
                <Textarea name="description" rows={2} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Obra</Label>
                  <Select name="projectId">
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin obra</SelectItem>
                      {(projects || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} · {p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Proveedor</Label>
                  <Select name="supplierId">
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin proveedor</SelectItem>
                      {(suppliers || []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Método</Label>
                  <Select name="method" defaultValue="transferencia">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fecha</Label>
                  <Input name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending}>Registrar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isEmpty ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="inline-flex h-11 w-11 rounded-lg bg-muted items-center justify-center mb-4">
              <Wallet className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-[15px] font-medium">Empezá a llevar tu caja</h3>
            <p className="text-[13px] text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
              Registrá el primer ingreso (un anticipo de cliente, una venta) o el primer gasto
              (compra de materiales, sueldos). El asistente también puede cargarlos por vos.
            </p>
            <Button size="sm" className="mt-4" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Cargar movimiento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 text-success mb-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="micro-label">Ingresos</span>
                </div>
                <div className="text-xl font-display tabular">{formatCurrency(totalIncome)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 text-destructive mb-1">
                  <TrendingDown className="h-3.5 w-3.5" />
                  <span className="micro-label">Gastos</span>
                </div>
                <div className="text-xl font-display tabular">{formatCurrency(totalExpense)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Wallet className="h-3.5 w-3.5" />
                  <span className="micro-label">Resultado</span>
                </div>
                <div className={`text-xl font-display tabular ${totalIncome - totalExpense >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(totalIncome - totalExpense)}
                </div>
              </CardContent>
            </Card>
          </div>

          {dash && dash.cashflow.some((c: any) => c.income > 0 || c.expense > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Flujo de caja · últimos 6 meses</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dash.cashflow} barGap={2} barCategoryGap="28%">
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
          )}

          <div className="flex gap-1.5 items-center">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Button variant={typeFilter === "all" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setTypeFilter("all")}>Todos</Button>
            <Button variant={typeFilter === "income" ? "default" : "outline"} size="sm" className={`h-7 text-xs ${typeFilter === "income" ? "bg-success" : ""}`} onClick={() => setTypeFilter("income")}>Ingresos</Button>
            <Button variant={typeFilter === "expense" ? "default" : "outline"} size="sm" className={`h-7 text-xs ${typeFilter === "expense" ? "bg-destructive" : ""}`} onClick={() => setTypeFilter("expense")}>Gastos</Button>
            <span className="text-[11px] text-muted-foreground ml-auto tabular">{filtered.length} registros</span>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Obra</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t: any) => (
                      <TableRow key={t.id} className="group">
                        <TableCell className="text-[12px] text-muted-foreground whitespace-nowrap tabular">{formatDate(t.date)}</TableCell>
                        <TableCell className="font-medium text-[13px]">{t.description}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[10px]">{t.category.replace("_", " ")}</Badge></TableCell>
                        <TableCell className="text-[12px] font-mono text-muted-foreground">{t.project?.code || "—"}</TableCell>
                        <TableCell className={`text-right font-medium tabular text-[13px] whitespace-nowrap ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                          {t.type === "income" ? "+" : "−"}{formatCurrency(t.amount)}
                        </TableCell>
                        <TableCell>
                          <Button size="icon-sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMutation.mutate(t.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

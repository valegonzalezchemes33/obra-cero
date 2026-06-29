"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Package, AlertTriangle, TrendingDown, Search, Pencil, Trash2, ArrowRightLeft } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { toast } from "sonner";

const CATEGORIES = ["cemento", "hierro", "mamposteria", "aglomerante", "electrico", "plomeria", "madera", "terminaciones", "general"];
const UNITS = ["unidad", "kg", "m", "m2", "m3", "bolsa", "litro", "rollo", "lata"];

export function InventoryView() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editMaterial, setEditMaterial] = useState<any>(null);
  const [movementMaterial, setMovementMaterial] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const { data: materials, isLoading } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const r = await fetch("/api/materials");
      if (!r.ok) throw new Error("Error al cargar materiales");
      return r.json();
    },
    staleTime: 2 * 60_000,
  });
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const r = await fetch("/api/suppliers");
      if (!r.ok) throw new Error("Error al cargar proveedores");
      return r.json();
    },
    enabled: open || !!movementMaterial,
    staleTime: 5 * 60_000,
  });
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const r = await fetch("/api/projects");
      if (!r.ok) throw new Error("Error al cargar obras");
      return r.json();
    },
    enabled: !!movementMaterial,
    staleTime: 5 * 60_000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/materials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Material creado");
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setEditMaterial(null);
    },
    onError: () => {
      toast.error("Error al crear el material");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const r = await fetch(`/api/materials/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Cambios guardados");
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setEditMaterial(null);
    },
    onError: () => {
      toast.error("Error al guardar los cambios");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await fetch(`/api/materials/${id}`, { method: "DELETE" }); },
    onSuccess: () => {
      toast.success("Material eliminado");
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => {
      toast.error("Error al eliminar el material");
    },
  });

  const movementMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const r = await fetch(`/api/materials/${id}/movements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Movimiento registrado");
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setMovementMaterial(null);
    },
    onError: () => {
      toast.error("Error al registrar el movimiento");
    },
  });

  const filtered = (materials || []).filter((m: any) => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) || m.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCat = catFilter === "all" || m.category === catFilter;
    return matchesSearch && matchesCat;
  });

  const totalValue = (materials || []).reduce((s: number, m: any) => s + m.stock * m.unitCost, 0);
  const lowStockCount = (materials || []).filter((m: any) => m.stock <= m.minStock && m.minStock > 0).length;
  const outOfStockCount = (materials || []).filter((m: any) => m.stock <= 0).length;
  const isEmpty = (materials?.length || 0) === 0;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: any = {
      sku: fd.get("sku"),
      name: fd.get("name"),
      category: fd.get("category"),
      unit: fd.get("unit"),
      unitCost: fd.get("unitCost"),
      stock: fd.get("stock"),
      minStock: fd.get("minStock"),
      maxStock: fd.get("maxStock") || null,
      location: fd.get("location"),
      supplierId: fd.get("supplierId") || null,
    };
    if (editMaterial) updateMutation.mutate({ id: editMaterial.id, data });
    else createMutation.mutate(data);
  };

  const handleMovement = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    movementMutation.mutate({
      id: movementMaterial.id,
      data: {
        type: fd.get("type"),
        quantity: fd.get("quantity"),
        unitCost: fd.get("unitCost") || movementMaterial.unitCost,
        reason: fd.get("reason"),
        note: fd.get("note"),
        projectId: fd.get("projectId") || null,
        supplierId: fd.get("supplierId") || null,
      },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[13px] text-muted-foreground">
          {isEmpty ? "El depósito está vacío." : `${materials.length} ${materials.length === 1 ? "material cargado" : "materiales cargados"} · ${formatCurrency(totalValue)} en stock`}
        </p>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditMaterial(null); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" /> Nuevo material</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editMaterial ? "Editar material" : "Nuevo material"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>SKU *</Label><Input name="sku" defaultValue={editMaterial?.sku} required /></div>
                <div><Label>Nombre *</Label><Input name="name" defaultValue={editMaterial?.name} required /></div>
                <div>
                  <Label>Categoría</Label>
                  <Select name="category" defaultValue={editMaterial?.category || "general"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Unidad</Label>
                  <Select name="unit" defaultValue={editMaterial?.unit || "unidad"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Costo unit. (ARS)</Label><Input name="unitCost" type="number" step="0.01" defaultValue={editMaterial?.unitCost} /></div>
                <div>
                  <Label>Stock actual</Label>
                  <Input name="stock" type="number" step="0.01" defaultValue={editMaterial?.stock ?? 0} disabled={!!editMaterial} />
                  {editMaterial && <p className="text-[11px] text-muted-foreground mt-1">Para cambiar stock, usá Movimientos</p>}
                </div>
                <div><Label>Stock mínimo</Label><Input name="minStock" type="number" step="0.01" defaultValue={editMaterial?.minStock ?? 0} /></div>
                <div><Label>Stock máximo (opc.)</Label><Input name="maxStock" type="number" step="0.01" defaultValue={editMaterial?.maxStock} /></div>
                <div className="col-span-2"><Label>Ubicación</Label><Input name="location" defaultValue={editMaterial?.location} placeholder="Ej: Depósito A · Estante 3" /></div>
                <div className="col-span-2">
                  <Label>Proveedor</Label>
                  <Select name="supplierId" defaultValue={editMaterial?.supplierId || ""}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin proveedor</SelectItem>
                      {(suppliers || []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editMaterial ? "Guardar" : "Crear"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isEmpty ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="inline-flex h-11 w-11 rounded-lg bg-muted items-center justify-center mb-4">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-[15px] font-medium">Cargá tu primer material</h3>
            <p className="text-[13px] text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
              Definí SKU, stock actual, mínimo y costo. El sistema calcula el valor total del
              depósito y avisa cuando hay que reponer.
            </p>
            <Button size="sm" className="mt-4" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Agregar material
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Package className="h-3.5 w-3.5" />
                  <span className="micro-label">Valor en stock</span>
                </div>
                <div className="text-xl font-display tabular">{formatCurrency(totalValue)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 text-warning mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="micro-label">Bajo el mínimo</span>
                </div>
                <div className="text-xl font-display tabular">{lowStockCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 text-destructive mb-1">
                  <TrendingDown className="h-3.5 w-3.5" />
                  <span className="micro-label">Sin stock</span>
                </div>
                <div className="text-xl font-display tabular">{outOfStockCount}</div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar por nombre o SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-[13px]" />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-44 h-8 text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Mín.</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((m: any) => {
                      const isOut = m.stock <= 0;
                      const isLow = m.stock <= m.minStock && m.minStock > 0;
                      const value = m.stock * m.unitCost;
                      return (
                        <TableRow key={m.id} className="group">
                          <TableCell className="font-mono text-[11px] text-muted-foreground">{m.sku}</TableCell>
                          <TableCell>
                            <div className="font-medium text-[13px]">{m.name}</div>
                            {m.location && <div className="text-[11px] text-muted-foreground">{m.location}</div>}
                          </TableCell>
                          <TableCell><Badge variant="secondary" className="text-[10px]">{m.category}</Badge></TableCell>
                          <TableCell className="text-right">
                            <span className={`font-medium tabular text-[13px] ${isOut ? "text-destructive" : isLow ? "text-warning" : ""}`}>
                              {formatNumber(m.stock, 2)}
                            </span>
                            <span className="text-[11px] text-muted-foreground ml-1">{m.unit}</span>
                            {isOut && <Badge variant="destructive" className="ml-2 text-[9px]">sin</Badge>}
                            {!isOut && isLow && <Badge variant="warning" className="ml-2 text-[9px]">bajo</Badge>}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground text-[11px] tabular">{formatNumber(m.minStock, 2)}</TableCell>
                          <TableCell className="text-right text-[11px] tabular">{formatCurrency(m.unitCost)}</TableCell>
                          <TableCell className="text-right font-medium tabular text-[13px] whitespace-nowrap">{formatCurrency(value)}</TableCell>
                          <TableCell>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="icon-sm" variant="ghost" title="Movimiento" onClick={() => setMovementMaterial(m)}>
                                <ArrowRightLeft className="h-3 w-3" />
                              </Button>
                              <Button size="icon-sm" variant="ghost" title="Editar" onClick={() => { setEditMaterial(m); setOpen(true); }}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button size="icon-sm" variant="ghost" className="text-destructive" title="Eliminar"
                                onClick={() => { if (confirm(`¿Eliminar ${m.name}?`)) deleteMutation.mutate(m.id); }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!movementMaterial} onOpenChange={(o) => !o && setMovementMaterial(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Movimiento de stock — {movementMaterial?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMovement} className="space-y-3">
            <div>
              <Label>Tipo de movimiento</Label>
              <Select name="type" defaultValue="incoming" required>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="incoming">Entrada (compra)</SelectItem>
                  <SelectItem value="outgoing">Salida (consumo)</SelectItem>
                  <SelectItem value="adjustment">Ajuste de inventario</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cantidad *</Label><Input name="quantity" type="number" step="0.01" required /></div>
              <div><Label>Costo unit. (ARS)</Label><Input name="unitCost" type="number" step="0.01" defaultValue={movementMaterial?.unitCost} /></div>
              <div>
                <Label>Motivo</Label>
                <Select name="reason" defaultValue="compra">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compra">Compra</SelectItem>
                    <SelectItem value="consumo_obra">Consumo obra</SelectItem>
                    <SelectItem value="ajuste">Ajuste</SelectItem>
                    <SelectItem value="devolucion">Devolución</SelectItem>
                    <SelectItem value="perdida">Pérdida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Obra (si aplica)</Label>
                <Select name="projectId">
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Ninguna</SelectItem>
                    {(projects || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Proveedor (si es entrada)</Label>
                <Select name="supplierId">
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Ninguno</SelectItem>
                    {(suppliers || []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Nota</Label><Input name="note" /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setMovementMaterial(null)}>Cancelar</Button>
              <Button type="submit" disabled={movementMutation.isPending}>Registrar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

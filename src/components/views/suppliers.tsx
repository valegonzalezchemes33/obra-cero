"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Truck, Plus, Phone, Mail, User, Star, Building, Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

export function SuppliersView() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const r = await fetch("/api/suppliers");
      if (!r.ok) throw new Error("Error al cargar proveedores");
      return r.json();
    },
    staleTime: 5 * 60_000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Proveedor creado");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setEditing(null);
    },
    onError: () => toast.error("Error al crear el proveedor"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const r = await fetch(`/api/suppliers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Cambios guardados");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setEditing(null);
    },
    onError: () => toast.error("Error al guardar los cambios"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await fetch(`/api/suppliers/${id}`, { method: "DELETE" }); },
    onSuccess: () => {
      toast.success("Proveedor eliminado");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Error al eliminar el proveedor"),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: any = {
      name: fd.get("name"),
      contact: fd.get("contact"),
      phone: fd.get("phone"),
      email: fd.get("email"),
      taxId: fd.get("taxId"),
      category: fd.get("category"),
      rating: fd.get("rating"),
      notes: fd.get("notes"),
    };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const isEmpty = (suppliers?.length || 0) === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[13px] text-muted-foreground">
          {isEmpty ? "Todavía no cargaste proveedores." : `${suppliers.length} ${suppliers.length === 1 ? "proveedor" : "proveedores"} en tu red de compra`}
        </p>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" /> Nuevo proveedor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Nombre / Razón social *</Label><Input name="name" defaultValue={editing?.name} required /></div>
                <div><Label>Contacto</Label><Input name="contact" defaultValue={editing?.contact || ""} /></div>
                <div>
                  <Label>Categoría</Label>
                  <Select name="category" defaultValue={editing?.category || "materiales"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="materiales">Materiales</SelectItem>
                      <SelectItem value="mano_obra">Mano de obra</SelectItem>
                      <SelectItem value="servicios">Servicios</SelectItem>
                      <SelectItem value="equipos">Equipos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Teléfono</Label><Input name="phone" defaultValue={editing?.phone || ""} /></div>
                <div><Label>Email</Label><Input name="email" type="email" defaultValue={editing?.email || ""} /></div>
                <div><Label>CUIL/CUIT</Label><Input name="taxId" defaultValue={editing?.taxId || ""} /></div>
                <div><Label>Rating (1-5)</Label><Input name="rating" type="number" min="1" max="5" step="0.1" defaultValue={editing?.rating || 3} /></div>
                <div className="col-span-2"><Label>Notas</Label><Textarea name="notes" rows={2} defaultValue={editing?.notes || ""} /></div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editing ? "Guardar cambios" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isEmpty ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="inline-flex h-11 w-11 rounded-lg bg-muted items-center justify-center mb-4">
              <Truck className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-[15px] font-medium">Armá tu red de proveedores</h3>
            <p className="text-[13px] text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
              Cargá ferreterías, corralones, electricidad, mano de obra y servicios.
              Después vas a poder asociarlos a compras y materiales.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map((s: any) => {
            const totalSpent = s.transactions?.filter((t: any) => t.type === "expense").reduce((sum: number, t: any) => sum + t.amount, 0) || 0;
            return (
              <Card key={s.id} className="hover:border-border hover:shadow-xs hover:-translate-y-px transition-all">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-medium truncate">{s.name}</h3>
                      {s.taxId && <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{s.taxId}</div>}
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{s.category?.replace("_", " ")}</Badge>
                  </div>

                  <div className="space-y-1 text-[13px]">
                    {s.contact && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-3 w-3 shrink-0" /> {s.contact}
                      </div>
                    )}
                    {s.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground tabular">
                        <Phone className="h-3 w-3 shrink-0" /> {s.phone}
                      </div>
                    )}
                    {s.email && (
                      <div className="flex items-center gap-2 text-muted-foreground truncate">
                        <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{s.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-border/60">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < Math.floor(s.rating) ? "text-warning fill-warning" : "text-border"}`} />
                      ))}
                      <span className="text-[11px] text-muted-foreground ml-1 tabular">{s.rating}</span>
                    </div>
                    <div className="text-right">
                      <div className="micro-label text-muted-foreground/80">Comprado</div>
                      <div className="text-[13px] font-medium tabular">{formatCurrency(totalSpent)}</div>
                    </div>
                  </div>

                  {s.notes && (
                    <div className="text-[11px] text-muted-foreground bg-muted/50 p-2 rounded">{s.notes}</div>
                  )}

                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Building className="h-3 w-3" /> {s.materials?.length || 0} {s.materials?.length === 1 ? "material asociado" : "materiales asociados"}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => { setEditing(s); setOpen(true); }}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:bg-destructive/5" onClick={() => {
                      if (confirm(`¿Eliminar a ${s.name}? Esta acción no se puede deshacer.`)) deleteMutation.mutate(s.id);
                    }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

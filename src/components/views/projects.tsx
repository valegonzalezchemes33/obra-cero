"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, MapPin, User, Calendar, DollarSign, Pencil, Trash2 } from "lucide-react";
import { formatCurrency, formatDate, formatPct, STATUS_LABELS, STATUS_BADGE, STATUS_DOT } from "@/lib/format";
import { toast } from "sonner";

export function ProjectsView() {
  const queryClient = useQueryClient();
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await fetch("/api/projects")).json(),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [filter, setFilter] = useState<string>("all");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Obra creada");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setEditing(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const r = await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Cambios guardados");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await fetch(`/api/projects/${id}`, { method: "DELETE" }); },
    onSuccess: () => {
      toast.success("Obra eliminada");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const filtered = (projects || []).filter((p: any) => filter === "all" || p.status === filter);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: any = {
      name: fd.get("name"),
      description: fd.get("description"),
      address: fd.get("address"),
      type: fd.get("type"),
      status: fd.get("status"),
      budget: fd.get("budget"),
      clientName: fd.get("clientName"),
      clientPhone: fd.get("clientPhone"),
      clientEmail: fd.get("clientEmail"),
      startDate: fd.get("startDate"),
      endDate: fd.get("endDate"),
      progress: fd.get("progress"),
    };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[13px] text-muted-foreground">
          {(projects?.length || 0) === 0
            ? "Todavía no cargaste ninguna obra."
            : `${projects.length} ${projects.length === 1 ? "obra cargada" : "obras cargadas"}`}
        </p>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" /> Nueva obra</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar obra" : "Nueva obra"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Nombre *</Label>
                  <Input name="name" defaultValue={editing?.name} required />
                </div>
                <div className="col-span-2">
                  <Label>Descripción</Label>
                  <Textarea name="description" defaultValue={editing?.description} rows={2} />
                </div>
                <div className="col-span-2">
                  <Label>Dirección</Label>
                  <Input name="address" defaultValue={editing?.address} />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select name="type" defaultValue={editing?.type || "obra"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="obra">Obra nueva</SelectItem>
                      <SelectItem value="remodelacion">Remodelación</SelectItem>
                      <SelectItem value="loteo">Loteo</SelectItem>
                      <SelectItem value="ampliacion">Ampliación</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estado</Label>
                  <Select name="status" defaultValue={editing?.status || "planning"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">En planificación</SelectItem>
                      <SelectItem value="in_progress">En progreso</SelectItem>
                      <SelectItem value="paused">Pausada</SelectItem>
                      <SelectItem value="finished">Finalizada</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Presupuesto (ARS)</Label>
                  <Input name="budget" type="number" defaultValue={editing?.budget} />
                </div>
                <div>
                  <Label>Avance (%)</Label>
                  <Input name="progress" type="number" min="0" max="100" defaultValue={editing?.progress ?? 0} />
                </div>
                <div>
                  <Label>Cliente</Label>
                  <Input name="clientName" defaultValue={editing?.clientName} />
                </div>
                <div>
                  <Label>Teléfono cliente</Label>
                  <Input name="clientPhone" defaultValue={editing?.clientPhone} />
                </div>
                <div className="col-span-2">
                  <Label>Email cliente</Label>
                  <Input name="clientEmail" type="email" defaultValue={editing?.clientEmail} />
                </div>
                <div>
                  <Label>Inicio</Label>
                  <Input name="startDate" type="date" defaultValue={editing?.startDate?.split("T")[0]} />
                </div>
                <div>
                  <Label>Fin estimado</Label>
                  <Input name="endDate" type="date" defaultValue={editing?.endDate?.split("T")[0]} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editing ? "Guardar cambios" : "Crear obra"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {(projects?.length || 0) > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {["all", "planning", "in_progress", "paused", "finished", "cancelled"].map((s) => (
            <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setFilter(s)}>
              {s === "all" ? "Todas" : STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-64 bg-card rounded-lg border shimmer" />)}
        </div>
      ) : (projects?.length || 0) === 0 ? (
        <EmptyProjects onCreate={() => setOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p: any) => {
            const spent = p.transactions?.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0) || 0;
            const income = p.transactions?.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + t.amount, 0) || 0;
            const pct = p.budget > 0 ? (spent / p.budget) * 100 : 0;
            return (
              <Card key={p.id} className="hover:border-border hover:shadow-xs hover:-translate-y-px transition-all">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-mono text-[11px] text-muted-foreground">{p.code}</span>
                        <Badge variant="outline" className={STATUS_BADGE[p.status]}>
                          <span className={`size-1.5 rounded-full ${STATUS_DOT[p.status]}`} />
                          {STATUS_LABELS[p.status]}
                        </Badge>
                      </div>
                      <h3 className="text-[14px] font-medium leading-tight">{p.name}</h3>
                      {p.address && (
                        <div className="flex items-center gap-1 text-[12px] text-muted-foreground mt-1.5">
                          <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{p.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {p.description && (
                    <p className="text-[12px] text-muted-foreground line-clamp-2">{p.description}</p>
                  )}

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Avance</span>
                      <span className="font-medium tabular">{formatPct(p.progress)}</span>
                    </div>
                    <Progress value={p.progress} className="h-1" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Presupuesto ejecutado</span>
                      <span className={`font-medium tabular ${pct > 90 ? "text-destructive" : pct > 70 ? "text-warning" : ""}`}>
                        {formatPct(pct)}
                      </span>
                    </div>
                    <Progress value={Math.min(100, pct)} className="h-1" />
                    <div className="flex justify-between text-[11px] text-muted-foreground tabular">
                      <span>{formatCurrency(spent)}</span>
                      <span>de {formatCurrency(p.budget)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-2.5 border-t border-border/60">
                    {p.clientName && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <User className="h-3 w-3" /> <span className="truncate">{p.clientName}</span>
                      </div>
                    )}
                    {p.startDate && (
                      <div className="flex items-center gap-1 text-muted-foreground tabular">
                        <Calendar className="h-3 w-3" /> {formatDate(p.startDate)}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-success font-medium tabular">
                      <DollarSign className="h-3 w-3" /> +{formatCurrency(income)}
                    </div>
                    <div className="flex items-center gap-1 text-destructive font-medium tabular">
                      <DollarSign className="h-3 w-3" /> −{formatCurrency(spent)}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => { setEditing(p); setOpen(true); }}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:bg-destructive/5" onClick={() => {
                      if (confirm(`¿Eliminar la obra ${p.code}? Esta acción no se puede deshacer.`)) deleteMutation.mutate(p.id);
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

      {!isLoading && filtered.length === 0 && (projects?.length || 0) > 0 && (
        <Card><CardContent className="py-10 text-center text-[13px] text-muted-foreground">No hay obras con ese filtro.</CardContent></Card>
      )}
    </div>
  );
}

function EmptyProjects({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <div className="inline-flex h-11 w-11 rounded-lg bg-muted items-center justify-center mb-4">
          <Building2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="text-[15px] font-medium">Tu primera obra arranca acá</h3>
        <p className="text-[13px] text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
          Cargá el nombre, presupuesto, cliente y plazos. El sistema le asigna automáticamente
          un código (OB-001) y empieza a calcular margen y desvíos.
        </p>
        <Button size="sm" className="mt-4" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Crear obra
        </Button>
      </CardContent>
    </Card>
  );
}

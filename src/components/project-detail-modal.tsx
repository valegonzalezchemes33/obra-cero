"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatPct, STATUS_LABELS, STATUS_BADGE, STATUS_DOT } from "@/lib/format";
import {
  Building2, MapPin, User, Calendar, DollarSign, TrendingUp, TrendingDown,
  ListChecks, Pencil, Save, X, FileText, ExternalLink, Plus, Trash2,
  AlertTriangle, CheckCircle2, Clock
} from "lucide-react";
import { toast } from "sonner";

interface ProjectDetailModalProps {
  open: boolean;
  projectId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDetailModal({ open, projectId, onOpenChange }: ProjectDetailModalProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const r = await fetch(`/api/projects/${projectId}`);
      if (!r.ok) throw new Error("Error al cargar obra");
      return r.json();
    },
    enabled: !!projectId,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const r = await fetch("/api/projects");
      if (!r.ok) throw new Error("Error al cargar obras");
      return r.json();
    },
  });

  const fullProject = projects?.find((p: any) => p.id === projectId) || project;

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Cambios guardados");
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(false);
    },
    onError: () => toast.error("Error al guardar"),
  });

  if (!projectId) return null;

  const p = fullProject;
  const spent = p?.transactions?.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0) || 0;
  const income = p?.transactions?.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + t.amount, 0) || 0;
  const pct = p?.budget > 0 ? (spent / p.budget) * 100 : 0;
  const taskCounts = {
    pending: p?.tasks?.filter((t: any) => t.status === "pending").length || 0,
    in_progress: p?.tasks?.filter((t: any) => t.status === "in_progress").length || 0,
    done: p?.tasks?.filter((t: any) => t.status === "done").length || 0,
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({
      name: fd.get("name"),
      description: fd.get("description"),
      address: fd.get("address"),
      type: fd.get("type"),
      status: fd.get("status"),
      budget: fd.get("budget"),
      clientName: fd.get("clientName"),
      clientPhone: fd.get("clientPhone"),
      clientEmail: fd.get("clientEmail"),
      startDate: fd.get("startDate") || null,
      endDate: fd.get("endDate") || null,
      progress: fd.get("progress"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <DialogTitle>{p?.name || "Cargando..."}</DialogTitle>
            {p?.code && <span className="font-mono text-[11px] text-muted-foreground">{p.code}</span>}
          </div>
        </DialogHeader>

        {isLoading || !p ? (
          <div className="h-64 bg-card rounded-lg border shimmer" />
        ) : (
          <ScrollArea className="pr-2">
            <div className="space-y-5">
              {/* Estado y acciones */}
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={STATUS_BADGE[p.status]}>
                  <span className={`size-1.5 rounded-full ${STATUS_DOT[p.status]}`} />
                  {STATUS_LABELS[p.status]}
                </Badge>
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                        <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                      </Button>
                      <Button size="sm" type="submit" form="project-form" disabled={updateMutation.isPending}>
                        <Save className="h-3.5 w-3.5 mr-1" /> Guardar
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                  )}
                </div>
              </div>

              {/* Formulario de edición */}
              <form id="project-form" onSubmit={handleSubmit}>
                <div className={`grid grid-cols-2 gap-3 ${editing ? "" : "pointer-events-none opacity-70"}`}>
                  <div className="col-span-2">
                    <Label>Nombre</Label>
                    <Input name="name" defaultValue={p.name} readOnly={!editing} required />
                  </div>
                  <div className="col-span-2">
                    <Label>Descripción / Notas</Label>
                    <Textarea name="description" defaultValue={p.description || ""} readOnly={!editing} rows={3} />
                  </div>
                  <div className="col-span-2">
                    <Label>Dirección</Label>
                    <Input name="address" defaultValue={p.address || ""} readOnly={!editing} />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select name="type" defaultValue={p.type} disabled={!editing}>
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
                    <Select name="status" defaultValue={p.status} disabled={!editing}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planning">Planificación</SelectItem>
                        <SelectItem value="in_progress">En progreso</SelectItem>
                        <SelectItem value="paused">Pausada</SelectItem>
                        <SelectItem value="finished">Finalizada</SelectItem>
                        <SelectItem value="cancelled">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Presupuesto (ARS)</Label>
                    <Input name="budget" type="number" defaultValue={p.budget} readOnly={!editing} />
                  </div>
                  <div>
                    <Label>Avance (%)</Label>
                    <Input name="progress" type="number" min="0" max="100" defaultValue={p.progress} readOnly={!editing} />
                  </div>
                  <div>
                    <Label>Cliente</Label>
                    <Input name="clientName" defaultValue={p.clientName || ""} readOnly={!editing} />
                  </div>
                  <div>
                    <Label>Teléfono</Label>
                    <Input name="clientPhone" defaultValue={p.clientPhone || ""} readOnly={!editing} />
                  </div>
                  <div className="col-span-2">
                    <Label>Email cliente</Label>
                    <Input name="clientEmail" type="email" defaultValue={p.clientEmail || ""} readOnly={!editing} />
                  </div>
                  <div>
                    <Label>Inicio</Label>
                    <Input name="startDate" type="date" defaultValue={p.startDate?.split("T")[0] || ""} readOnly={!editing} />
                  </div>
                  <div>
                    <Label>Fin estimado</Label>
                    <Input name="endDate" type="date" defaultValue={p.endDate?.split("T")[0] || ""} readOnly={!editing} />
                  </div>
                </div>
              </form>

              {/* Resumen financiero */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide mb-3">Resumen financiero</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-0.5">
                      <div className="text-[11px] text-muted-foreground">Presupuesto</div>
                      <div className="text-[16px] font-display tabular">{formatCurrency(p.budget)}</div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-[11px] text-muted-foreground">Ejecutado</div>
                      <div className="text-[16px] font-display tabular text-destructive">{formatCurrency(spent)}</div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-[11px] text-muted-foreground">Ingresos</div>
                      <div className="text-[16px] font-display tabular text-success">{formatCurrency(income)}</div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-[11px] text-muted-foreground">Saldo</div>
                      <div className={`text-[16px] font-display tabular ${income - spent >= 0 ? "text-success" : "text-destructive"}`}>
                        {formatCurrency(income - spent)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Ejecución presupuesto</span>
                      <span className={`font-medium tabular ${pct > 100 ? "text-destructive" : pct > 80 ? "text-warning" : ""}`}>{formatPct(pct)}</span>
                    </div>
                    <Progress value={Math.min(100, pct)} className={`h-1.5 ${pct > 100 ? "[&>div]:bg-destructive" : pct > 80 ? "[&>div]:bg-warning" : ""}`} />
                    <div className="flex justify-between text-[11px] text-muted-foreground tabular">
                      <span>{formatCurrency(spent)} gastado</span>
                      <span>{formatCurrency(Math.max(0, p.budget - spent))} disponible</span>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Avance físico</span>
                      <span className="font-medium tabular">{formatPct(p.progress)}</span>
                    </div>
                    <Progress value={p.progress} className="h-1.5" />
                  </div>
                </CardContent>
              </Card>

              {/* Transacciones */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" /> Movimientos ({p.transactions?.length || 0})
                  </h4>
                </div>
                {p.transactions?.length > 0 ? (
                  <div className="space-y-1">
                    {p.transactions.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50 text-[12px]">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {tx.type === "income" ? (
                            <TrendingUp className="h-3 w-3 text-success shrink-0" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-destructive shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium truncate">{tx.description}</div>
                            <div className="text-[11px] text-muted-foreground">{formatDate(tx.date)} · {tx.category}</div>
                          </div>
                        </div>
                        <span className={`tabular font-medium ml-3 shrink-0 ${tx.type === "income" ? "text-success" : "text-destructive"}`}>
                          {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground py-2">Sin movimientos registrados para esta obra.</p>
                )}
              </div>

              {/* Tareas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <ListChecks className="h-3.5 w-3.5" /> Tareas ({p.tasks?.length || 0})
                  </h4>
                </div>
                {taskCounts.pending > 0 || taskCounts.in_progress > 0 ? (
                  <div className="flex gap-2 mb-2">
                    {taskCounts.pending > 0 && (
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" /> {taskCounts.pending} pendientes
                      </Badge>
                    )}
                    {taskCounts.in_progress > 0 && (
                      <Badge variant="outline" className="bg-warning-soft text-warning border-warning/20">
                        <AlertTriangle className="h-3 w-3 mr-1" /> {taskCounts.in_progress} en progreso
                      </Badge>
                    )}
                    {taskCounts.done > 0 && (
                      <Badge variant="outline" className="bg-success-soft text-success border-success/15">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> {taskCounts.done} hechas
                      </Badge>
                    )}
                  </div>
                ) : null}
                {p.tasks?.length > 0 ? (
                  <div className="space-y-1">
                    {p.tasks.map((t: any) => {
                      const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done";
                      return (
                        <div key={t.id} className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50 text-[12px]">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className={`mt-0.5 h-1.5 w-1.5 rounded-full shrink-0 ${t.status === "done" ? "bg-success" : overdue ? "bg-destructive" : t.priority === "high" || t.priority === "critical" ? "bg-warning" : "bg-muted-foreground/50"}`} />
                            <div className="min-w-0">
                              <div className={`font-medium truncate ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {t.dueDate ? formatDate(t.dueDate) : "Sin fecha"}
                                {overdue && <span className="text-destructive font-medium"> · atrasada</span>}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className={`text-[10px] h-5 ${t.status === "done" ? "bg-success-soft text-success" : t.status === "in_progress" ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground"}`}>
                            {STATUS_LABELS[t.status] || t.status}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground py-2">Sin tareas asignadas a esta obra.</p>
                )}
              </div>

              {/* Metadatos */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t pt-3">
                <span>Creado: {formatDate(p.createdAt)}</span>
                <span>Actualizado: {formatDate(p.updatedAt)}</span>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

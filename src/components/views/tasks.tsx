"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { ListChecks, Plus, Clock, AlertCircle, Trash2, Calendar, User, Bot, CheckCircle2 } from "lucide-react";
import { formatDate, PRIORITY_LABELS, PRIORITY_BADGE, PRIORITY_DOT } from "@/lib/format";
import { toast } from "sonner";

export function TasksView() {
  const queryClient = useQueryClient();
  const { data: tasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const r = await fetch("/api/tasks");
      if (!r.ok) throw new Error("Error al cargar tareas");
      return r.json();
    },
  });
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const r = await fetch("/api/projects");
      if (!r.ok) throw new Error("Error al cargar obras");
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Tarea creada");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => {
      toast.error("Error al crear la tarea");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const r = await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => {
      toast.error("Error al actualizar la tarea");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await fetch(`/api/tasks/${id}`, { method: "DELETE" }); },
    onSuccess: () => {
      toast.success("Tarea eliminada");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => {
      toast.error("Error al eliminar la tarea");
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      title: fd.get("title"),
      description: fd.get("description"),
      priority: fd.get("priority"),
      assignee: fd.get("assignee"),
      dueDate: fd.get("dueDate"),
      projectId: fd.get("projectId") || null,
    });
  };

  const pending = (tasks || []).filter((t: any) => t.status === "pending");
  const inProgress = (tasks || []).filter((t: any) => t.status === "in_progress");
  const done = (tasks || []).filter((t: any) => t.status === "done");
  const now = new Date();
  const isEmpty = (tasks?.length || 0) === 0;

  const TaskCard = ({ t }: { t: any }) => {
    const overdue = t.dueDate && new Date(t.dueDate) < now && t.status !== "done";
    return (
      <Card className={`hover:border-border hover:shadow-xs transition-all group ${overdue ? "border-destructive/30 bg-destructive/[0.02]" : ""}`}>
        <CardContent className="p-3.5 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY_DOT[t.priority]}`} />
              <h4 className={`text-[13px] font-medium flex-1 ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</h4>
            </div>
            <Button size="icon-sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
              onClick={() => deleteMutation.mutate(t.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          {t.description && <p className="text-[11px] text-muted-foreground line-clamp-2">{t.description}</p>}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={`text-[10px] ${PRIORITY_BADGE[t.priority]}`}>{PRIORITY_LABELS[t.priority]}</Badge>
            {t.project?.code && <Badge variant="outline" className="text-[10px] font-mono">{t.project.code}</Badge>}
            {t.createdBy === "agent" && (
              <Badge variant="outline" className="text-[10px] bg-warning-soft/40 border-warning/15 text-warning">
                <Bot className="h-2.5 w-2.5 mr-0.5" /> IA
              </Badge>
            )}
            {overdue && <Badge variant="destructive" className="text-[10px]">atrasada</Badge>}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/60">
            <div className="flex items-center gap-1">
              {t.assignee ? <><User className="h-3 w-3" /> {t.assignee}</> : <span>sin asignar</span>}
            </div>
            {t.dueDate && (
              <div className={`flex items-center gap-1 tabular ${overdue ? "text-destructive font-medium" : ""}`}>
                <Calendar className="h-3 w-3" /> {formatDate(t.dueDate)}
              </div>
            )}
          </div>
          {t.status !== "done" && (
            <div className="flex gap-1 pt-1">
              {t.status === "pending" && (
                <Button size="xs" variant="outline" className="flex-1" onClick={() => updateMutation.mutate({ id: t.id, data: { status: "in_progress" } })}>
                  Iniciar
                </Button>
              )}
              {t.status === "in_progress" && (
                <Button size="xs" variant="outline" className="flex-1" onClick={() => updateMutation.mutate({ id: t.id, data: { status: "pending" } })}>
                  Pausar
                </Button>
              )}
              <Button size="xs" variant="outline" className="flex-1 border-success/30 text-success hover:bg-success-soft/50"
                onClick={() => updateMutation.mutate({ id: t.id, data: { status: "done" } })}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Listo
              </Button>
            </div>
          )}
          {t.status === "done" && (
            <Button size="xs" variant="outline" className="w-full" onClick={() => updateMutation.mutate({ id: t.id, data: { status: "in_progress" } })}>
              Reabrir
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[13px] text-muted-foreground">
          {isEmpty ? "No hay tareas cargadas." : `${pending.length} pendientes · ${inProgress.length} en progreso · ${done.length} hechas`}
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" /> Nueva tarea</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva tarea</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div><Label>Título *</Label><Input name="title" required /></div>
              <div><Label>Descripción</Label><Textarea name="description" rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prioridad</Label>
                  <Select name="priority" defaultValue="medium">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baja</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="critical">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Asignado a</Label><Input name="assignee" /></div>
                <div><Label>Vencimiento</Label><Input name="dueDate" type="date" /></div>
                <div>
                  <Label>Obra</Label>
                  <Select name="projectId">
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Ninguna</SelectItem>
                      {(projects || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button type="submit" disabled={createMutation.isPending}>Crear tarea</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isEmpty ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="inline-flex h-11 w-11 rounded-lg bg-muted items-center justify-center mb-4">
              <ListChecks className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-[15px] font-medium">Organizá el trabajo del equipo</h3>
            <p className="text-[13px] text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
              Creá tareas con prioridad, responsable y fecha. El asistente también puede
              generar tareas automáticamente a partir de alertas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KanbanColumn
            icon={<Clock className="h-3.5 w-3.5" />}
            iconColor="text-muted-foreground"
            title="Pendientes"
            count={pending.length}
            tasks={pending}
            renderCard={(t) => <TaskCard key={t.id} t={t} />}
            emptyText="Sin tareas pendientes"
          />
          <KanbanColumn
            icon={<AlertCircle className="h-3.5 w-3.5" />}
            iconColor="text-warning"
            title="En progreso"
            count={inProgress.length}
            tasks={inProgress}
            renderCard={(t) => <TaskCard key={t.id} t={t} />}
            emptyText="Nada en progreso"
          />
          <KanbanColumn
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            iconColor="text-success"
            title="Hechas"
            count={done.length}
            tasks={done}
            renderCard={(t) => <TaskCard key={t.id} t={t} />}
            emptyText="Sin tareas completadas"
          />
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  icon,
  iconColor,
  title,
  count,
  tasks,
  renderCard,
  emptyText,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  count: number;
  tasks: any[];
  renderCard: (t: any) => React.ReactNode;
  emptyText: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className={iconColor}>{icon}</span>
          <h3 className="text-[13px] font-medium">{title}</h3>
          <span className="text-[11px] text-muted-foreground tabular bg-muted px-1.5 py-0.5 rounded">{count}</span>
        </div>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => renderCard(t))}
        {tasks.length === 0 && (
          <div className="rounded-md border border-dashed border-border/60 py-6 text-center text-[12px] text-muted-foreground">
            {emptyText}
          </div>
        )}
      </div>
    </div>
  );
}

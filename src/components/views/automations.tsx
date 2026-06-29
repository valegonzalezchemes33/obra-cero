"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Zap,
  Plus,
  Play,
  Pencil,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  MoreHorizontal,
  FlaskConical,
  FileJson,
} from "lucide-react";
import { WorkflowBuilder } from "@/components/workflow-builder";
import { WORKFLOW_TEMPLATES, STEP_TYPE_META, type WorkflowStepConfig, type TriggerConfig } from "@/lib/workflow-types";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

interface WorkflowData {
  id: string;
  name: string;
  description?: string;
  trigger: string;
  triggerConfig?: string;
  enabled: boolean;
  createdAt: string;
  steps?: any[];
  executions?: any[];
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: "Manual",
  schedule: "Programado",
  event_low_stock: "Stock bajo",
  event_budget_overrun: "Presupuesto excedido",
  event_expense_spike: "Pico de gastos",
  event_late_task: "Tarea atrasada",
  event_new_project: "Nueva obra",
  event_new_transaction: "Nuevo movimiento",
  event_new_material: "Nuevo material",
};

const TRIGGER_ICONS: Record<string, string> = {
  manual: "hand",
  schedule: "clock",
  event_low_stock: "alert-triangle",
  event_budget_overrun: "trending-up",
  event_expense_spike: "trending-up",
  event_late_task: "clock",
  event_new_project: "building-2",
  event_new_transaction: "wallet",
  event_new_material: "package",
};

export function AutomationsView() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowData | null>(null);
  const [activeTab, setActiveTab] = useState("workflows");
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [executionOpen, setExecutionOpen] = useState(false);

  // Form state
  const [wfName, setWfName] = useState("");
  const [wfDescription, setWfDescription] = useState("");
  const [wfTrigger, setWfTrigger] = useState("manual");
  const [wfEnabled, setWfEnabled] = useState(true);
  const [wfSteps, setWfSteps] = useState<WorkflowStepConfig[]>([]);
  const [wfCron, setWfCron] = useState("0 9 * * 1"); // Default: Monday 9am

  // Queries
  const { data: workflows, isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      const r = await fetch("/api/workflows");
      if (!r.ok) throw new Error("Error al cargar workflows");
      return r.json();
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const { data: executions } = useQuery({
    queryKey: ["workflow-executions"],
    queryFn: async () => {
      const r = await fetch("/api/workflows/executions?limit=20");
      if (!r.ok) throw new Error("Error al cargar ejecuciones");
      return r.json();
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const { data: schedules } = useQuery({
    queryKey: ["schedules"],
    queryFn: async () => {
      const r = await fetch("/api/scheduler");
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Workflow creado");
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      resetForm();
    },
    onError: () => toast.error("Error al crear workflow"),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/workflows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Workflow actualizado");
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      resetForm();
    },
    onError: () => toast.error("Error al actualizar workflow"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/workflows?id=${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast.success("Workflow eliminado");
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: () => toast.error("Error al eliminar workflow"),
  });

  const executeMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const r = await fetch("/api/workflows/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId }),
      });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    onSuccess: (data) => {
      setExecutionResult(data);
      setExecutionOpen(true);
      queryClient.invalidateQueries({ queryKey: ["workflow-executions"] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      if (data.success) {
        toast.success("Workflow ejecutado correctamente");
      } else {
        toast.error("El workflow falló en algún paso");
      }
    },
    onError: () => toast.error("Error al ejecutar workflow"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const r = await fetch("/api/workflows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  const resetForm = () => {
    setEditorOpen(false);
    setEditingWorkflow(null);
    setWfName("");
    setWfDescription("");
    setWfTrigger("manual");
    setWfEnabled(true);
    setWfSteps([]);
    setWfCron("0 9 * * 1");
  };

  const openNew = () => {
    resetForm();
    setEditorOpen(true);
  };

  const openEdit = (wf: WorkflowData) => {
    setEditingWorkflow(wf);
    setWfName(wf.name);
    setWfDescription(wf.description || "");
    setWfTrigger(wf.trigger);
    setWfEnabled(wf.enabled);
    const triggerConfig = wf.triggerConfig ? JSON.parse(wf.triggerConfig) : {};
    setWfCron(triggerConfig.cron || "0 9 * * 1");
    setWfSteps((wf.steps || []).map((s: any) => {
      try {
        return { type: s.type, label: s.label, config: JSON.parse(s.config) };
      } catch {
        return { type: s.type, label: s.label, config: {} };
      }
    }));
    setEditorOpen(true);
  };

  const openFromTemplate = (template: (typeof WORKFLOW_TEMPLATES)[0]) => {
    resetForm();
    setWfName(template.name);
    setWfDescription(template.description);
    setWfTrigger(template.trigger);
    setWfSteps(template.steps.map((s) => ({ ...s })));
    if (template.trigger === "schedule") {
      setWfCron(template.triggerConfig?.cron || "0 9 * * 1");
    }
    setEditorOpen(true);
  };

  const handleSave = () => {
    if (!wfName.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    const data: any = {
      name: wfName,
      description: wfDescription || null,
      trigger: wfTrigger,
      triggerConfig: wfTrigger === "schedule" ? { cron: wfCron } : null,
      enabled: wfEnabled,
      steps: wfSteps.map((s, i) => ({
        type: s.type,
        label: s.label || null,
        config: typeof s.config === "string" ? s.config : JSON.stringify(s.config),
        order: (i + 1) * 10,
      })),
    };

    if (editingWorkflow) {
      updateMutation.mutate({ id: editingWorkflow.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const triggerLabel = (t: string) => TRIGGER_LABELS[t] || t;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-[15px] font-medium">Automatizaciones</h2>
          </div>
          <p className="text-[12px] text-muted-foreground mt-1">
            {workflows?.length || 0} workflows ·{" "}
            {executions?.filter((e: any) => e.status === "running").length || 0} ejecutándose
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Nuevo workflow
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={openNew}>
                <FileJson className="h-4 w-4 mr-2" />
                <span>Desde cero</span>
              </DropdownMenuItem>
              <div className="border-t border-border my-1" />
              <p className="text-[10px] text-muted-foreground px-2 py-1 font-medium uppercase tracking-wide">Plantillas</p>
              {WORKFLOW_TEMPLATES.map((t, i) => (
                <DropdownMenuItem key={i} onClick={() => openFromTemplate(t)}>
                  <FlaskConical className="h-4 w-4 mr-2 text-primary/70" />
                  <div className="min-w-0">
                    <div className="text-[13px] truncate">{t.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{t.description}</div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="workflows">
            <Zap className="h-3.5 w-3.5 mr-1.5" /> Workflows
          </TabsTrigger>
          <TabsTrigger value="executions">
            <Play className="h-3.5 w-3.5 mr-1.5" /> Ejecuciones
          </TabsTrigger>
          <TabsTrigger value="schedules">
            <Clock className="h-3.5 w-3.5 mr-1.5" /> Programación
          </TabsTrigger>
        </TabsList>

        {/* ─── Workflows Tab ─── */}
        <TabsContent value="workflows" className="space-y-3 mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2].map((i) => <div key={i} className="h-28 bg-card rounded-lg border shimmer" />)}
            </div>
          ) : (workflows?.length || 0) === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <div className="inline-flex h-10 w-10 rounded-lg bg-muted items-center justify-center mb-3">
                  <Zap className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="text-[14px] font-medium">Todavía no hay workflows</h3>
                <p className="text-[12px] text-muted-foreground mt-1 max-w-md mx-auto">
                  Creá tu primer workflow desde cero o usando una plantilla predefinida.
                  Los workflows te permiten automatizar tareas complejas: cuando pase X, hace Y, luego Z.
                </p>
                <div className="flex gap-2 justify-center mt-4">
                  <Button size="sm" onClick={openNew}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Crear manual
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FlaskConical className="h-3.5 w-3.5 mr-1.5" /> Desde plantilla
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {WORKFLOW_TEMPLATES.map((t, i) => (
                        <DropdownMenuItem key={i} onClick={() => openFromTemplate(t)}>
                          {t.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {workflows.map((wf: WorkflowData) => {
                const lastExec = wf.executions?.[0];
                const stepCount = wf.steps?.length || 0;
                return (
                  <Card key={wf.id} className="hover:border-border hover:shadow-xs transition-all group">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-[14px] font-medium truncate">{wf.name}</h3>
                            <Switch
                              checked={wf.enabled}
                              onCheckedChange={(v) => toggleMutation.mutate({ id: wf.id, enabled: v })}
                              className="scale-75"
                            />
                          </div>
                          {wf.description && (
                            <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1">{wf.description}</p>
                          )}
                        </div>
                        <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon-sm" variant="ghost" title="Ejecutar" onClick={() => executeMutation.mutate(wf.id)}>
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon-sm" variant="ghost" title="Editar" onClick={() => openEdit(wf)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon-sm" variant="ghost" className="text-destructive" title="Eliminar"
                            onClick={() => { if (confirm("¿Eliminar este workflow?")) deleteMutation.mutate(wf.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">{triggerLabel(wf.trigger)}</Badge>
                        <Badge variant={wf.enabled ? "success" : "secondary"} className="text-[10px]">
                          {wf.enabled ? "Activo" : "Inactivo"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground tabular">{stepCount} pasos</span>
                      </div>

                      {lastExec && (
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-2 border-t border-border/60">
                          {lastExec.status === "completed" ? (
                            <CheckCircle2 className="h-3 w-3 text-success" />
                          ) : lastExec.status === "failed" ? (
                            <XCircle className="h-3 w-3 text-destructive" />
                          ) : (
                            <Clock className="h-3 w-3 text-warning" />
                          )}
                          <span>
                            {lastExec.status === "completed"
                              ? "Completado"
                              : lastExec.status === "failed"
                              ? "Falló"
                              : "En ejecución"}
                          </span>
                          <span className="tabular">{formatDateTime(lastExec.startedAt)}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── Executions Tab ─── */}
        <TabsContent value="executions" className="space-y-3 mt-4">
          {(executions?.length || 0) === 0 ? (
            <Card><CardContent className="py-8 text-center text-[13px] text-muted-foreground">Sin ejecuciones aún.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {executions.map((ex: any) => (
                <Card key={ex.id} className="hover:border-border transition-all">
                  <CardContent className="p-3 flex items-center gap-3">
                    {ex.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    ) : ex.status === "failed" ? (
                      <XCircle className="h-5 w-5 text-destructive shrink-0" />
                    ) : ex.status === "running" ? (
                      <Clock className="h-5 w-5 text-warning shrink-0 animate-pulse" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">{ex.workflow?.name || "Workflow"}</span>
                        <Badge variant="secondary" className="text-[9px]">{ex.triggeredBy}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 tabular">
                        <span>{formatDateTime(ex.startedAt)}</span>
                        {ex.completedAt && <span>· {Math.round((new Date(ex.completedAt).getTime() - new Date(ex.startedAt).getTime()) / 1000)}s</span>}
                      </div>
                      {ex.log && (
                        <details className="mt-1">
                          <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">Ver log</summary>
                          <pre className="mt-1 p-2 bg-muted rounded text-[10px] font-mono max-h-40 overflow-y-auto">
                            {(() => {
                              try { const logs = JSON.parse(ex.log); return logs.map((l: any, i: number) => `${l.stepType} → ${l.status}${l.error ? ` ❌ ${l.error}` : ""}`).join("\n"); } catch { return ex.log; }
                            })()}
                          </pre>
                        </details>
                      )}
                    </div>
                    <Badge variant={ex.status === "completed" ? "success" : ex.status === "failed" ? "destructive" : "warning"} className="text-[10px]">
                      {ex.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Schedules Tab ─── */}
        <TabsContent value="schedules" className="space-y-3 mt-4">
          {(schedules?.length || 0) === 0 ? (
            <Card><CardContent className="py-8 text-center text-[13px] text-muted-foreground">Sin tareas programadas. Creá un workflow con trigger \"Programado\".</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {schedules.map((s: any) => (
                <Card key={s.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-medium">{s.name}</div>
                      <div className="text-[11px] text-muted-foreground tabular mt-0.5">
                        Cron: <code className="bg-muted px-1 rounded">{s.cron}</code>
                        {s.lastRun && <span> · Último: {formatDateTime(s.lastRun)}</span>}
                        {s.nextRun && <span> · Próximo: {formatDateTime(s.nextRun)}</span>}
                      </div>
                    </div>
                    <Badge variant={s.enabled ? "success" : "secondary"}>{s.enabled ? "Activo" : "Inactivo"}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Workflow Editor Dialog ─── */}
      <Dialog open={editorOpen} onOpenChange={(o) => { if (!o) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingWorkflow ? "Editar workflow" : "Nuevo workflow"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Configuración básica */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px]">Configuración</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Nombre *</Label>
                    <Input value={wfName} onChange={(e) => setWfName(e.target.value)} placeholder="Ej: Alertar stock bajo y crear tarea" />
                  </div>
                  <div className="col-span-2">
                    <Label>Descripción</Label>
                    <Textarea value={wfDescription} onChange={(e) => setWfDescription(e.target.value)} rows={2} placeholder="¿Qué hace este workflow?" />
                  </div>
                  <div>
                    <Label>Disparador</Label>
                    <Select value={wfTrigger} onValueChange={setWfTrigger}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="schedule">Programado (cron)</SelectItem>
                        <SelectItem value="event_low_stock">Stock bajo</SelectItem>
                        <SelectItem value="event_budget_overrun">Presupuesto excedido</SelectItem>
                        <SelectItem value="event_expense_spike">Pico de gastos</SelectItem>
                        <SelectItem value="event_late_task">Tarea atrasada</SelectItem>
                        <SelectItem value="event_new_project">Nueva obra creada</SelectItem>
                        <SelectItem value="event_new_transaction">Nuevo movimiento</SelectItem>
                        <SelectItem value="event_new_material">Nuevo material</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {wfTrigger === "schedule" && (
                    <div>
                      <Label>Expresión Cron</Label>
                      <Input value={wfCron} onChange={(e) => setWfCron(e.target.value)} placeholder="*/5 * * * *" />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Ej: "0 9 * * 1" = lun a las 9am · "*/5 * * * *" = cada 5 min
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={wfEnabled} onCheckedChange={setWfEnabled} />
                  <Label className="text-[13px]">Workflow activo</Label>
                </div>
              </CardContent>
            </Card>

            {/* Builder */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px]">Pasos del workflow</CardTitle>
                <CardDescription>
                  Arrastrá los pasos para reordenarlos. Cada paso ejecuta una acción o evalúa una condición.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WorkflowBuilder steps={wfSteps} onChange={setWfSteps} />
              </CardContent>
            </Card>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={resetForm}>Cancelar</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                {editingWorkflow ? "Guardar cambios" : "Crear workflow"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Execution Result Dialog */}
      <Dialog open={executionOpen} onOpenChange={setExecutionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resultado de ejecución</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {executionResult?.logs?.map((log: any, i: number) => (
              <div key={i} className={`p-3 rounded-md border text-[12px] ${
                log.status === "completed" ? "bg-success-soft/50 border-success/15" :
                log.status === "failed" ? "bg-destructive/5 border-destructive/15" :
                "bg-muted/50 border-border"
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {log.status === "completed" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  ) : log.status === "failed" ? (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-warning" />
                  )}
                  <span className="font-medium">{log.stepLabel || log.stepType}</span>
                  <Badge variant="secondary" className="text-[9px]">{log.stepType}</Badge>
                </div>
                {log.error && <p className="text-destructive text-[11px] mt-1">Error: {log.error}</p>}
                {log.data && (
                  <pre className="text-[10px] text-muted-foreground mt-1 font-mono truncate">
                    {JSON.stringify(log.data).slice(0, 100)}
                  </pre>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setExecutionOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

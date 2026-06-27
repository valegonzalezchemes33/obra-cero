"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GripVertical, Plus, Trash2, Settings2, Play, AlertTriangle, ListChecks, TrendingDown, TrendingUp, Building2, Truck, Percent, RefreshCw, Package, ArrowRightLeft, ShoppingCart, CheckCircle2, Clock, Repeat, GitBranch, StopCircle, Mail, Globe, Workflow } from "lucide-react";
import { STEP_TYPE_META, type StepType, type WorkflowStepConfig } from "@/lib/workflow-types";
import { toast } from "sonner";

// ─── Icon picker ───

const STEP_ICONS: Record<string, any> = {
  "git-branch": GitBranch,
  "list-checks": ListChecks,
  "alert-triangle": AlertTriangle,
  "trending-down": TrendingDown,
  "trending-up": TrendingUp,
  "building-2": Building2,
  truck: Truck,
  percent: Percent,
  "refresh-cw": RefreshCw,
  package: Package,
  "arrow-right-left": ArrowRightLeft,
  "shopping-cart": ShoppingCart,
  "check-circle": CheckCircle2,
  "check-check": CheckCircle2,
  "package-open": Package,
  mail: Mail,
  globe: Globe,
  workflow: Workflow,
  clock: Clock,
  repeat: Repeat,
  "stop-circle": StopCircle,
};

function getStepIcon(iconName: string) {
  const Icon = STEP_ICONS[iconName];
  return Icon || GitBranch;
}

// ─── Sortable Step Card ───

function SortableStepCard({
  step,
  index,
  onEdit,
  onDelete,
  isOverlay,
}: {
  step: WorkflowStepConfig & { id?: string };
  index: number;
  onEdit: (i: number) => void;
  onDelete: (i: number) => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id || `step-${index}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const meta = STEP_TYPE_META[step.type];
  const Icon = STEP_ICONS[meta?.icon || "git-branch"] || GitBranch;

  const borderColor = meta?.color?.replace("text-", "") || "purple-500";
  const borderColorMap: Record<string, string> = {
    "purple-500": "#a855f7", "blue-500": "#3b82f6", "amber-500": "#f59e0b",
    "red-500": "#ef4444", "green-500": "#22c55e", "indigo-500": "#6366f1",
    "orange-500": "#f97316", "cyan-500": "#06b6d4", "pink-500": "#ec4899",
    "slate-500": "#64748b", "violet-500": "#8b5cf6", "yellow-500": "#eab308",
  };

  return (
    <div ref={setNodeRef} style={style} className={`group ${isOverlay ? "z-50" : ""}`}>
      <Card className={`border-l-4 ${isDragging ? "shadow-lg" : ""}`}
        style={{ borderLeftColor: borderColorMap[borderColor] || "#a855f7" }}>
        <CardContent className="p-3 flex items-center gap-3">
          <button className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground/40 hover:text-muted-foreground transition-colors" {...attributes} {...listeners}>
            <GripVertical className="h-4 w-4" />
          </button>
          <div className={`h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0 ${meta?.color || ""}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-medium">{step.label || meta?.label || step.type}</span>
              <Badge variant="secondary" className="text-[9px] h-4">{step.type.replace("action_", "").replace(/_/g, " ")}</Badge>
            </div>
            {step.config && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {JSON.stringify(step.config).slice(0, 80)}
              </p>
            )}
          </div>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button size="icon-sm" variant="ghost" onClick={() => onEdit(index)}>
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon-sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(index)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Step Editor Dialog ───

function StepEditorDialog({
  open,
  onOpenChange,
  step,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  step: WorkflowStepConfig | null;
  onSave: (step: WorkflowStepConfig) => void;
}) {
  const [type, setType] = useState<StepType>(step?.type || "action_create_task");
  const [label, setLabel] = useState(step?.label || "");
  const [configStr, setConfigStr] = useState(step?.config ? JSON.stringify(step.config, null, 2) : "{}");
  const [configError, setConfigError] = useState("");

  useEffect(() => {
    if (step) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setType(step.type);
      setLabel(step.label || "");
      setConfigStr(JSON.stringify(step.config, null, 2));
    } else {
      setType("action_create_task");
      setLabel("");
      setConfigStr("{}");
    }
    setConfigError("");
  }, [step, open]);

  const handleSave = () => {
    try {
      const config = JSON.parse(configStr);
      onSave({ type, label, config });
      onOpenChange(false);
    } catch {
      setConfigError("JSON inválido. Verificá las comas y llaves.");
    }
  };

  // Generar config template según el tipo
  const getConfigTemplate = (t: StepType): string => {
    switch (t) {
      case "condition":
        return JSON.stringify({ field: "variable.field", operator: "gte", value: 0 }, null, 2);
      case "action_create_task":
        return JSON.stringify({ title: "Nueva tarea", description: "", priority: "medium", dueDays: 3 }, null, 2);
      case "action_send_alert":
        return JSON.stringify({ title: "Título alerta", description: "Descripción", severity: "warning" }, null, 2);
      case "action_create_expense":
      case "action_create_income":
        return JSON.stringify({ type: "expense", category: "materiales", description: "Descripción", amount: 0 }, null, 2);
      case "action_create_project":
        return JSON.stringify({ name: "Nombre obra", budget: 0, clientName: "" }, null, 2);
      case "action_create_supplier":
        return JSON.stringify({ name: "Nombre proveedor", phone: "", email: "", category: "materiales" }, null, 2);
      case "action_update_project_progress":
        return JSON.stringify({ projectRef: "OB-001", progress: 50 }, null, 2);
      case "action_update_project_status":
        return JSON.stringify({ projectRef: "OB-001", status: "finished" }, null, 2);
      case "action_add_materials":
        return JSON.stringify({ items: [{ name: "Material", qty: 10, unit: "unidad" }] }, null, 2);
      case "delay":
        return JSON.stringify({ unit: "minutes", value: 5 }, null, 2);
      case "loop":
        return JSON.stringify({ type: "for_each", dataSource: "projects", maxIterations: 5 }, null, 2);
      default:
        return JSON.stringify({}, null, 2);
    }
  };

  const handleTypeChange = (t: StepType) => {
    setType(t);
    setConfigStr(getConfigTemplate(t));
    setConfigError("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step ? "Editar paso" : "Nuevo paso"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo de paso</Label>
            <Select value={type} onValueChange={(v: StepType) => handleTypeChange(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {Object.entries(STEP_TYPE_META).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>
                    <span className={meta.color}>{meta.label}</span>
                    <span className="text-[11px] text-muted-foreground ml-2">· {meta.group}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Etiqueta (opcional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="¿Qué hace este paso?" />
          </div>

          <div>
            <Label>Configuración (JSON)</Label>
            <Textarea
              value={configStr}
              onChange={(e) => { setConfigStr(e.target.value); setConfigError(""); }}
              rows={8}
              className="font-mono text-[12px]"
            />
            {configError && <p className="text-[11px] text-destructive mt-1">{configError}</p>}
          </div>

          <Card className="bg-muted/50">
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground">
                <strong>Variables disponibles:</strong> {"{{variable.name}}"}, {"{{project.code}}"}, {"{{material.stock}}"}, {"{{transaction.amount}}"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Las variables se interpolan automáticamente durante la ejecución del workflow.
              </p>
            </CardContent>
          </Card>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={handleSave}>Guardar paso</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Workflow Builder ───

interface WorkflowBuilderProps {
  steps: WorkflowStepConfig[];
  onChange: (steps: WorkflowStepConfig[]) => void;
}

export function WorkflowBuilder({ steps, onChange }: WorkflowBuilderProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [stepEditorOpen, setStepEditorOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = steps.findIndex((s, i) => (s as any).id === active.id || `step-${i}` === active.id);
      const newIndex = steps.findIndex((s, i) => (s as any).id === over.id || `step-${i}` === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newSteps = arrayMove(steps, oldIndex, newIndex);
        onChange(newSteps.map((s, i) => ({ ...s, order: (i + 1) * 10 })));
      }
    }
  };

  const addStep = () => {
    setEditingIndex(null);
    setStepEditorOpen(true);
  };

  const editStep = (index: number) => {
    setEditingIndex(index);
    setStepEditorOpen(true);
  };

  const deleteStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index);
    onChange(newSteps);
    toast.success("Paso eliminado");
  };

  const saveStep = (step: WorkflowStepConfig) => {
    const newSteps = [...steps];
    if (editingIndex !== null) {
      newSteps[editingIndex] = step;
    } else {
      newSteps.push(step);
    }
    onChange(newSteps);
    toast.success("Paso guardado");
  };

  const stepsWithIds = steps.map((s, i) => ({ ...s, id: s.id || `step-${i}` }));

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stepsWithIds.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {stepsWithIds.length === 0 && (
              <div className="border-2 border-dashed border-border rounded-lg py-12 text-center">
                <div className="inline-flex h-10 w-10 rounded-lg bg-muted items-center justify-center mb-3">
                  <GitBranch className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="text-[14px] font-medium">Workflow vacío</h3>
                <p className="text-[12px] text-muted-foreground mt-1">Agregá pasos para construir tu flujo de automatización.</p>
              </div>
            )}
            {stepsWithIds.map((step, i) => (
              <SortableStepCard key={step.id} step={step} index={i} onEdit={editStep} onDelete={deleteStep} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button variant="outline" size="sm" className="w-full h-9 border-dashed" onClick={addStep}>
        <Plus className="h-3.5 w-3.5 mr-1.5" /> Agregar paso
      </Button>

      <StepEditorDialog
        open={stepEditorOpen}
        onOpenChange={setStepEditorOpen}
        step={editingIndex !== null ? steps[editingIndex] : null}
        onSave={saveStep}
      />
    </div>
  );
}

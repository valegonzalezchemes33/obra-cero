// ============================================================
// ToolBadge — Badge visual de tool usada en la respuesta
// ============================================================
// Se muestra bajo el contenido del mensaje del agente.
// Muestra los nombres de las tools que se ejecutaron.
// ============================================================

import { Badge } from "@/components/ui/badge";
import {
  Wrench, Package, DollarSign, Workflow, Search, Calendar,
  Bell, FileText, Bookmark, CheckCircle2, XCircle, Loader2,
  Shield, ShieldAlert, ShieldCheck,
} from "lucide-react";

const TOOL_CATEGORY_ICONS: Record<string, any> = {
  proyectos: Package,
  tareas: CheckCircle2,
  finanzas: DollarSign,
  inventario: Package,
  proveedores: Package,
  automatización: Workflow,
  consulta: Search,
  utilidades: Wrench,
  calendario: Calendar,
  notificaciones: Bell,
  documentos: FileText,
  memoria: Bookmark,
  general: Wrench,
};

const TOOL_CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  proyectos:     { bg: "bg-blue-500/10",    text: "text-blue-600",    border: "border-blue-500/20",    icon: "text-blue-500" },
  tareas:        { bg: "bg-green-500/10",  text: "text-green-600",   border: "border-green-500/20",  icon: "text-green-500" },
  finanzas:      { bg: "bg-emerald-500/10",text: "text-emerald-600", border: "border-emerald-500/20",icon: "text-emerald-500" },
  inventario:    { bg: "bg-orange-500/10", text: "text-orange-600", border: "border-orange-500/20", icon: "text-orange-500" },
  proveedores:   { bg: "bg-purple-500/10",text: "text-purple-600", border: "border-purple-500/20",icon: "text-purple-500" },
  automatización:{ bg: "bg-pink-500/10",  text: "text-pink-600",   border: "border-pink-500/20",  icon: "text-pink-500" },
  consulta:      { bg: "bg-slate-500/10", text: "text-slate-600",  border: "border-slate-500/20", icon: "text-slate-500" },
  calendario:    { bg: "bg-cyan-500/10",  text: "text-cyan-600",   border: "border-cyan-500/20",  icon: "text-cyan-500" },
  notificaciones:{ bg: "bg-yellow-500/10",text: "text-yellow-600",border: "border-yellow-500/20",icon: "text-yellow-500" },
  documentos:    { bg: "bg-indigo-500/10", text: "text-indigo-600", border: "border-indigo-500/20",icon: "text-indigo-500" },
  memoria:       { bg: "bg-rose-500/10",  text: "text-rose-600",   border: "border-rose-500/20",  icon: "text-rose-500" },
  utilidades:    { bg: "bg-muted",        text: "text-muted-foreground", border: "border-border",  icon: "text-muted-foreground" },
  general:       { bg: "bg-muted",        text: "text-muted-foreground", border: "border-border",  icon: "text-muted-foreground" },
};

function getToolCategory(tool: string): string {
  const map: Record<string, string> = {
    create_project: "proyectos", update_project_progress: "proyectos",
    update_project_status: "proyectos", edit_project: "proyectos",
    close_project: "proyectos",
    create_task: "tareas", complete_task: "tareas",
    edit_task: "tareas", delete_task: "tareas",
    create_expense: "finanzas", create_income: "finanzas",
    delete_transaction: "finanzas",
    add_materials: "inventario", add_stock_movement: "inventario",
    update_stock: "inventario", edit_material: "inventario",
    delete_material: "inventario", reorder: "inventario",
    create_supplier: "proveedores",
    trigger_workflow: "automatización", list_workflows: "automatización",
    list_automations: "automatización",
    list_project_tasks: "consulta", export_data: "utilidades",
    // Capabilities
    remember_preference: "memoria", recall_preference: "memoria",
    forget_preference: "memoria", list_preferences: "memoria",
    schedule_event: "calendario", list_events: "calendario",
    complete_event: "calendario", cancel_event: "calendario",
    send_notification: "notificaciones", list_notifications: "notificaciones",
    resolve_notification: "notificaciones", dismiss_all_notifications: "notificaciones",
    search_projects: "consulta", search_clients: "consulta",
    search_budgets: "consulta", list_budget_ranges: "consulta",
    generate_document: "documentos",
  };
  return map[tool] || "general";
}

function getToolLabel(tool: string): string {
  const labels: Record<string, string> = {
    create_project: "Crear obra", update_project_progress: "Avance obra",
    update_project_status: "Estado obra", edit_project: "Editar obra",
    close_project: "Cerrar obra",
    create_task: "Crear tarea", complete_task: "Completar tarea",
    edit_task: "Editar tarea", delete_task: "Eliminar tarea",
    create_expense: "Registrar gasto", create_income: "Registrar ingreso",
    delete_transaction: "Eliminar transacción",
    add_materials: "Agregar materiales", add_stock_movement: "Movimiento stock",
    update_stock: "Actualizar stock", edit_material: "Editar material",
    delete_material: "Eliminar material", reorder: "Reordenar",
    create_supplier: "Crear proveedor",
    trigger_workflow: "Disparar workflow", list_workflows: "Listar workflows",
    list_automations: "Listar automatizaciones",
    list_project_tasks: "Listar tareas", export_data: "Exportar",
    remember_preference: "Recordar", recall_preference: "Recuperar",
    forget_preference: "Olvidar", list_preferences: "Preferencias",
    schedule_event: "Agendar", list_events: "Eventos",
    complete_event: "Completar evento", cancel_event: "Cancelar evento",
    send_notification: "Notificar", list_notifications: "Notificaciones",
    resolve_notification: "Resolver notificación", dismiss_all_notifications: "Descartar todo",
    search_projects: "Buscar obras", search_clients: "Buscar clientes",
    search_budgets: "Buscar presupuestos", list_budget_ranges: "Rangos presupuesto",
    generate_document: "Generar documento",
  };
  return labels[tool] || tool.replace(/_/g, " ");
}

interface ToolStep {
  tool: string;
  status: "pending" | "running" | "success" | "failed" | "skipped" | "awaiting_confirmation";
  error?: string;
}

interface ToolBadgeProps {
  steps: ToolStep[];
}

export function ToolBadgeList({ steps }: ToolBadgeProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {steps.map((step, i) => {
        const cat = getToolCategory(step.tool);
        const colors = TOOL_CATEGORY_COLORS[cat] || TOOL_CATEGORY_COLORS.general;
        const Icon = TOOL_CATEGORY_ICONS[cat] || Wrench;
        const label = getToolLabel(step.tool);
        const isFailed = step.status === "failed";
        const isSkipped = step.status === "skipped";

        return (
          <Badge
            key={`${step.tool}-${i}`}
            variant="outline"
            className={`${colors.bg} ${colors.text} ${colors.border} text-[10px] gap-1 pl-1.5 pr-2 py-0.5 border cursor-default`}
            title={isFailed ? `Error: ${step.error}` : step.tool}
          >
            {isFailed ? (
              <XCircle className="h-3 w-3 text-destructive" />
            ) : isSkipped ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : step.status === "success" ? (
              <CheckCircle2 className={`h-3 w-3 ${colors.icon}`} />
            ) : (
              <Icon className={`h-3 w-3 ${colors.icon}`} />
            )}
            {label}
          </Badge>
        );
      })}
    </div>
  );
}

// ─── Intent Label ──────────────────────────────────────────────

const INTENT_GROUP_COLORS: Record<string, string> = {
  query: "bg-slate-500/10 text-slate-600",
  action: "bg-blue-500/10 text-blue-600",
  capability: "bg-purple-500/10 text-purple-600",
  config: "bg-amber-500/10 text-amber-600",
  predict: "bg-cyan-500/10 text-cyan-600",
  alert: "bg-red-500/10 text-red-600",
  default: "bg-muted text-muted-foreground",
};

export function IntentLabel({ intent }: { intent: string }) {
  if (!intent) return null;
  const prefix = intent.split("_")[0];
  const colorClass = INTENT_GROUP_COLORS[prefix] || INTENT_GROUP_COLORS.default;

  const displayIntent = intent
    .replace(/^(query|action|capability|config|predict|alert)_/i, "")
    .replace(/_/g, " ");

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${colorClass}`}>
      {displayIntent}
    </span>
  );
}

// ─── Source Indicator (Groq vs Local) ─────────────────────────

export function SourceIndicator({ source }: { source?: string }) {
  if (!source || source === "local") return null;
  if (source === "groq" || source === "compound" || source === "hybrid") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground/60 font-mono">
        <span className="size-1 rounded-full bg-primary animate-pulse" />
        IA · {source}
      </span>
    );
  }
  return null;
}

// ─── Plan Summary Strip ─────────────────────────────────────────

interface PlanSummaryProps {
  plan?: {
    steps?: ToolStep[];
    confidence?: number;
    source?: string;
    intent?: string;
    durationMs?: number;
  };
}

export function PlanSummaryStrip({ plan }: PlanSummaryProps) {
  if (!plan) return null;
  return (
    <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50 mt-1">
      {plan.steps && plan.steps.length > 0 && (
        <ToolBadgeList steps={plan.steps} />
      )}
      {plan.durationMs !== undefined && (
        <span>⏱ {plan.durationMs}ms</span>
      )}
      {plan.confidence !== undefined && plan.confidence > 0 && (
        <span>Confianza: {(plan.confidence * 100).toFixed(0)}%</span>
      )}
      <SourceIndicator source={plan.source} />
    </div>
  );
}
"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar, MobileNav, ViewKey } from "@/components/sidebar-nav";
import { Dashboard } from "@/components/views/dashboard";
import { ProjectsView } from "@/components/views/projects";
import { FinancesView } from "@/components/views/finances";
import { InventoryView } from "@/components/views/inventory";
import { SuppliersView } from "@/components/views/suppliers";
import { TasksView } from "@/components/views/tasks";
import { AgentView } from "@/components/views/agent";
import { AutomationsView } from "@/components/views/automations";
import { CommandPalette } from "@/components/command-palette";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { NotificationPanel } from "@/components/notification-panel";

const TITLES: Record<ViewKey, { title: string; sub: string; cta?: { label: string; target: ViewKey } }> = {
  dashboard: { title: "Panel", sub: "Vista general de tu operación" },
  projects: { title: "Obras", sub: "Proyectos en curso y planificados", cta: { label: "Nueva obra", target: "projects" } },
  finances: { title: "Finanzas", sub: "Ingresos, gastos y flujo de caja", cta: { label: "Nuevo movimiento", target: "finances" } },
  inventory: { title: "Inventario", sub: "Materiales, stock y movimientos", cta: { label: "Nuevo material", target: "inventory" } },
  suppliers: { title: "Proveedores", sub: "Red de compras y contactos", cta: { label: "Nuevo proveedor", target: "suppliers" } },
  tasks: { title: "Tareas", sub: "Pendientes del equipo y del asistente", cta: { label: "Nueva tarea", target: "tasks" } },
  agent: { title: "Asistente", sub: "IA local para consultas y automatizaciones" },
  automations: { title: "Automatizaciones", sub: "Workflows inteligentes con pasos multi-acción" },
};

export default function Home() {
  const [view, setView] = useState<ViewKey>("dashboard");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [pendingAgentQuery, setPendingAgentQuery] = useState<string | null>(null);

  const { data: actions } = useQuery({
    queryKey: ["agent-actions-count"],
    queryFn: async () => {
      const r = await fetch("/api/agent");
      if (!r.ok) return { actions: [] };
      return r.json();
    },
    refetchInterval: 60000,
  });
  const alertsCount = actions?.actions?.length || 0;

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleAskAgent = useCallback((query: string) => {
    setView("agent");
    setPendingAgentQuery(query);
    // Reset after consumed
    setTimeout(() => setPendingAgentQuery(null), 100);
  }, []);

  const meta = TITLES[view];

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar current={view} onChange={setView} alertsCount={alertsCount} onOpenCommand={() => setCmdOpen(true)} />
      <main className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/60">
          <div className="h-14 px-4 lg:px-8 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="lg:hidden flex items-center gap-2 mb-0.5">
                <div className="h-6 w-6 rounded bg-primary/15 flex items-center justify-center">
                  <span className="text-primary text-[10px] font-bold">OC</span>
                </div>
              </div>
              <h1 className="text-[17px] font-display tracking-tight leading-none">{meta.title}</h1>
              <p className="text-[11px] text-muted-foreground mt-1 hidden sm:block leading-none">{meta.sub}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Mobile search trigger */}
              <Button variant="outline" size="icon" className="lg:hidden"
                onClick={() => setCmdOpen(true)}>
                <Search className="h-4 w-4" />
              </Button>
              {/* Notifications */}
              <NotificationPanel />
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-4 lg:p-8 max-w-[1400px] w-full mx-auto">
          <div className="animate-fade-up">
            {view === "dashboard" && <Dashboard onNavigate={setView} />}
            {view === "projects" && <ProjectsView />}
            {view === "finances" && <FinancesView />}
            {view === "inventory" && <InventoryView />}
            {view === "suppliers" && <SuppliersView />}
            {view === "tasks" && <TasksView />}
            {view === "agent" && <AgentView initialQuery={pendingAgentQuery} />}
            {view === "automations" && <AutomationsView />}
          </div>
        </div>
      </main>
      <MobileNav current={view} onChange={setView} alertsCount={alertsCount} />
      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        onNavigate={setView}
        onAskAgent={handleAskAgent}
      />
    </div>
  );
}

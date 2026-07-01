"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import { Sidebar, MobileNav, ViewKey } from "@/components/sidebar-nav";
import { CommandPalette } from "@/components/command-palette";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PanelLeft, Search } from "lucide-react";
import { NotificationPanel } from "@/components/notification-panel";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { motion, AnimatePresence } from "framer-motion";
import { ErrorBoundary } from "@/components/error-boundary";
import { Loader2 } from "lucide-react";

const Dashboard = dynamic(() => import("@/components/views/dashboard").then((m) => ({ default: m.Dashboard })), { ssr: false });
const ProjectsView = dynamic(() => import("@/components/views/projects").then((m) => ({ default: m.ProjectsView })), { ssr: false });
const FinancesView = dynamic(() => import("@/components/views/finances").then((m) => ({ default: m.FinancesView })), { ssr: false });
const InventoryView = dynamic(() => import("@/components/views/inventory").then((m) => ({ default: m.InventoryView })), { ssr: false });
const SuppliersView = dynamic(() => import("@/components/views/suppliers").then((m) => ({ default: m.SuppliersView })), { ssr: false });
const TasksView = dynamic(() => import("@/components/views/tasks").then((m) => ({ default: m.TasksView })), { ssr: false });
const AgentView = dynamic(() => import("@/components/views/agent").then((m) => ({ default: m.AgentView })), { ssr: false });
const AutomationsView = dynamic(() => import("@/components/views/automations").then((m) => ({ default: m.AutomationsView })), { ssr: false });

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  const meta = useMemo(() => TITLES[view], [view]);

  const fallback = (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar current={view} onChange={setView} alertsCount={alertsCount} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} onOpenCommand={() => setCmdOpen(true)} />
      <main className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-background/70 backdrop-blur-xl border-b border-border/40 supports-[backdrop-filter]:bg-background/60">
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
              {/* Theme toggle */}
              <ThemeToggle />
              {/* Mobile search trigger */}
              <Button variant="outline" size="icon" className="lg:hidden"
                onClick={() => setCmdOpen(true)}>
                <Search className="h-4 w-4" />
              </Button>
              {/* Notifications */}
              <NotificationPanel />
              {/* User menu / logout */}
              <UserMenu />
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-4 lg:p-8 max-w-[1400px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {view === "dashboard" && (
                <ErrorBoundary name="Dashboard">
                  <Suspense fallback={fallback}>
                    <Dashboard onNavigate={setView} />
                  </Suspense>
                </ErrorBoundary>
              )}
              {view === "projects" && (
                <ErrorBoundary name="Obras">
                  <Suspense fallback={fallback}>
                    <ProjectsView />
                  </Suspense>
                </ErrorBoundary>
              )}
              {view === "finances" && (
                <ErrorBoundary name="Finanzas">
                  <Suspense fallback={fallback}>
                    <FinancesView />
                  </Suspense>
                </ErrorBoundary>
              )}
              {view === "inventory" && (
                <ErrorBoundary name="Inventario">
                  <Suspense fallback={fallback}>
                    <InventoryView />
                  </Suspense>
                </ErrorBoundary>
              )}
              {view === "suppliers" && (
                <ErrorBoundary name="Proveedores">
                  <Suspense fallback={fallback}>
                    <SuppliersView />
                  </Suspense>
                </ErrorBoundary>
              )}
              {view === "tasks" && (
                <ErrorBoundary name="Tareas">
                  <Suspense fallback={fallback}>
                    <TasksView />
                  </Suspense>
                </ErrorBoundary>
              )}
              {view === "agent" && (
                <ErrorBoundary name="Asistente">
                  <Suspense fallback={fallback}>
                    <AgentView initialQuery={pendingAgentQuery} />
                  </Suspense>
                </ErrorBoundary>
              )}
              {view === "automations" && (
                <ErrorBoundary name="Automatizaciones">
                  <Suspense fallback={fallback}>
                    <AutomationsView />
                  </Suspense>
                </ErrorBoundary>
              )}
            </motion.div>
          </AnimatePresence>
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

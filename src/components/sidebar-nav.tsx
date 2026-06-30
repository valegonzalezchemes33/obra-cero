"use client";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Building2,
  Wallet,
  Package,
  Truck,
  ListChecks,
  Bot,
  HardHat,
  Search,
  ChevronsUpDown,
  Zap,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

export type ViewKey =
  | "dashboard"
  | "projects"
  | "finances"
  | "inventory"
  | "suppliers"
  | "tasks"
  | "agent"
  | "automations";

interface SidebarProps {
  current: ViewKey;
  onChange: (v: ViewKey) => void;
  alertsCount?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenCommand?: () => void;
}

const NAV_ITEMS: { key: ViewKey; label: string; icon: any }[] = [
  { key: "dashboard", label: "Panel", icon: LayoutDashboard },
  { key: "projects", label: "Obras", icon: Building2 },
  { key: "finances", label: "Finanzas", icon: Wallet },
  { key: "inventory", label: "Inventario", icon: Package },
  { key: "suppliers", label: "Proveedores", icon: Truck },
  { key: "tasks", label: "Tareas", icon: ListChecks },
  { key: "automations", label: "Automatizaciones", icon: Zap },
  { key: "agent", label: "Asistente", icon: Bot },
];

export function Sidebar({ current, onChange, alertsCount = 0, collapsed = false, onToggleCollapse, onOpenCommand }: SidebarProps) {
  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="hidden lg:flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border overflow-hidden shrink-0"
    >
      {/* Workspace switcher */}
      <div className={cn("pt-3", collapsed ? "px-2 pb-2 flex justify-center" : "px-3 pb-2")}>
        <button
          className={cn(
            "flex items-center rounded-md hover:bg-sidebar-accent transition-colors group",
            collapsed ? "justify-center h-9 w-9 mx-auto" : "gap-2 px-2 py-1.5 w-full"
          )}
        >
          <div className="h-7 w-7 rounded-md bg-sidebar-primary/15 ring-1 ring-sidebar-primary/25 flex items-center justify-center shrink-0">
            <HardHat className="h-3.5 w-3.5 text-sidebar-primary" />
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1 text-left">
                <div className="text-[13px] font-semibold tracking-tight leading-none truncate">Obra Cero</div>
                <div className="text-[10px] text-sidebar-foreground/45 mt-1 leading-none">Workspace</div>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-foreground/40 shrink-0" />
            </>
          )}
        </button>
      </div>

      {/* Command palette trigger */}
      <div className={cn(collapsed ? "px-2 pb-2 flex justify-center" : "px-3 pb-2")}>
        <button
          onClick={onOpenCommand}
          className={cn(
            "flex items-center rounded-md transition-colors text-sidebar-foreground/55 hover:text-sidebar-foreground/90 border border-sidebar-border/60",
            collapsed
              ? "justify-center h-9 w-9 hover:bg-sidebar-accent"
              : "gap-2 px-2 py-1.5 w-full bg-sidebar-accent/40 hover:bg-sidebar-accent"
          )}
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && (
            <>
              <span className="text-[12px] flex-1 text-left">Buscar…</span>
              <kbd className="text-[10px] font-mono px-1 py-0.5 rounded bg-sidebar-foreground/8 text-sidebar-foreground/55">⌘K</kbd>
            </>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-0.5", collapsed ? "px-1.5 pt-2 pb-4" : "px-2 pt-2 pb-4")}>
        {!collapsed && (
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/35 px-2 mb-1.5">
            Operación
          </div>
        )}
        {NAV_ITEMS.map((item, idx) => {
          const Icon = item.icon;
          const active = current === item.key;
          return (
            <motion.button
              key={item.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.03, ease: "easeOut" }}
              onClick={() => onChange(item.key)}
              className={cn(
                "w-full group relative flex items-center rounded-md text-[13px] transition-colors",
                collapsed
                  ? "justify-center h-9"
                  : "gap-2.5 px-2 py-1.5",
                active
                  ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/90"
              )}
              title={collapsed ? item.label : undefined}
            >
              <AnimatePresence>
                {active && !collapsed && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-sidebar-primary"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  />
                )}
              </AnimatePresence>
              {active && collapsed && (
                <span className="absolute inset-0 rounded-md bg-sidebar-accent" />
              )}
              <Icon className={cn(
                "h-[15px] w-[15px] shrink-0 relative",
                active ? "text-sidebar-primary" : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/70"
              )} />
              {!collapsed && <span className="flex-1 text-left relative">{item.label}</span>}
              {item.key === "agent" && alertsCount > 0 && !collapsed && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-sidebar-primary/15 text-sidebar-primary text-[10px] font-medium px-1.5 py-0.5 rounded tabular relative"
                >
                  {alertsCount}
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Toggle collapse + status */}
      <div className={cn("pb-3", collapsed ? "px-2" : "px-3")}>
        <div className={cn(
          "flex items-center rounded-md text-[11px] text-sidebar-foreground/50 mb-2",
          collapsed ? "justify-center" : "gap-2 px-2 py-1.5"
        )}>
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          {!collapsed && <span>Asistente activo · 100% local</span>}
        </div>
        <button
          onClick={onToggleCollapse}
          className={cn(
            "w-full flex items-center rounded-md hover:bg-sidebar-accent transition-colors text-sidebar-foreground/40 hover:text-sidebar-foreground/70",
            collapsed ? "justify-center h-9" : "gap-2 px-2 py-1.5"
          )}
          title={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span className="text-[11px]">Colapsar</span>}
        </button>
      </div>
    </motion.aside>
  );
}

export function MobileNav({ current, onChange }: SidebarProps) {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border z-50">
      <div className="grid grid-cols-7 gap-0.5 px-2 py-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = current === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={cn(
                "relative flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-md text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              {active && (
                <motion.div
                  layoutId="mobile-active"
                  className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

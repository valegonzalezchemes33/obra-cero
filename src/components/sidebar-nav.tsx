"use client";

import { cn } from "@/lib/utils";
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
} from "lucide-react";

export type ViewKey =
  | "dashboard"
  | "projects"
  | "finances"
  | "inventory"
  | "suppliers"
  | "tasks"
  | "agent";

interface SidebarProps {
  current: ViewKey;
  onChange: (v: ViewKey) => void;
  alertsCount?: number;
  onOpenCommand?: () => void;
}

const NAV_ITEMS: { key: ViewKey; label: string; icon: any }[] = [
  { key: "dashboard", label: "Panel", icon: LayoutDashboard },
  { key: "projects", label: "Obras", icon: Building2 },
  { key: "finances", label: "Finanzas", icon: Wallet },
  { key: "inventory", label: "Inventario", icon: Package },
  { key: "suppliers", label: "Proveedores", icon: Truck },
  { key: "tasks", label: "Tareas", icon: ListChecks },
  { key: "agent", label: "Asistente", icon: Bot },
];

export function Sidebar({ current, onChange, alertsCount = 0, onOpenCommand }: SidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col w-60 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Workspace switcher */}
      <div className="px-3 pt-3 pb-2">
        <button
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors group"
        >
          <div className="h-7 w-7 rounded-md bg-sidebar-primary/15 ring-1 ring-sidebar-primary/25 flex items-center justify-center shrink-0">
            <HardHat className="h-3.5 w-3.5 text-sidebar-primary" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="text-[13px] font-semibold tracking-tight leading-none truncate">Obra Cero</div>
            <div className="text-[10px] text-sidebar-foreground/45 mt-1 leading-none">Workspace</div>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-foreground/40 shrink-0" />
        </button>
      </div>

      {/* Command palette trigger */}
      <div className="px-3 pb-2">
        <button
          onClick={onOpenCommand}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-sidebar-accent/40 hover:bg-sidebar-accent transition-colors text-sidebar-foreground/55 hover:text-sidebar-foreground/90 border border-sidebar-border/60"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="text-[12px] flex-1 text-left">Buscar…</span>
          <kbd className="text-[10px] font-mono px-1 py-0.5 rounded bg-sidebar-foreground/8 text-sidebar-foreground/55">⌘K</kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 pt-2 pb-4 space-y-0.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/35 px-2 mb-1.5">
          Operación
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = current === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={cn(
                "w-full group relative flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/90"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-sidebar-primary" />
              )}
              <Icon className={cn(
                "h-[15px] w-[15px] shrink-0",
                active ? "text-sidebar-primary" : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/70"
              )} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.key === "agent" && alertsCount > 0 && (
                <span className="bg-sidebar-primary/15 text-sidebar-primary text-[10px] font-medium px-1.5 py-0.5 rounded tabular">
                  {alertsCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer status */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-sidebar-foreground/50">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          <span>Asistente activo · 100% local</span>
        </div>
      </div>
    </aside>
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
                "flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-md text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

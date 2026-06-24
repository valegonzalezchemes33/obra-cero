"use client";

import * as React from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  LayoutDashboard,
  Building2,
  Wallet,
  Package,
  Truck,
  ListChecks,
  Bot,
  Plus,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Search,
} from "lucide-react";
import { ViewKey } from "@/components/sidebar-nav";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (v: ViewKey) => void;
  onAskAgent: (query: string) => void;
}

const NAV_ITEMS: { key: ViewKey; label: string; icon: any; hint: string }[] = [
  { key: "dashboard", label: "Panel", icon: LayoutDashboard, hint: "Ir al panel" },
  { key: "projects", label: "Obras", icon: Building2, hint: "Ver obras" },
  { key: "finances", label: "Finanzas", icon: Wallet, hint: "Ver finanzas" },
  { key: "inventory", label: "Inventario", icon: Package, hint: "Ver inventario" },
  { key: "suppliers", label: "Proveedores", icon: Truck, hint: "Ver proveedores" },
  { key: "tasks", label: "Tareas", icon: ListChecks, hint: "Ver tareas" },
  { key: "agent", label: "Asistente IA", icon: Bot, hint: "Abrir asistente" },
];

const AGENT_QUERIES = [
  { label: "¿Cómo vamos?", icon: Sparkles },
  { label: "¿Qué alertas hay?", icon: Sparkles },
  { label: "Recomendaciones", icon: Sparkles },
  { label: "Detectar anomalías", icon: Sparkles },
  { label: "Margen por obra", icon: Sparkles },
  { label: "¿Qué materiales faltan?", icon: Sparkles },
  { label: "Proyección de presupuesto", icon: Sparkles },
  { label: "Comparar con mes anterior", icon: Sparkles },
];

export function CommandPalette({ open, onOpenChange, onNavigate, onAskAgent }: CommandPaletteProps) {
  const handleNav = (v: ViewKey) => {
    onNavigate(v);
    onOpenChange(false);
  };
  const handleQuery = (q: string) => {
    onAskAgent(q);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden max-w-xl" showCloseButton={false}>
        <Command className="rounded-lg">
          <div className="flex items-center border-b border-border px-3" cmdk-input-wrapper="">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <CommandInput placeholder="Buscar módulos, acciones o consultar al asistente…" className="h-11 border-0 focus-visible:ring-0 text-[13px]" />
          </div>
          <CommandList className="max-h-[400px]">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              Sin resultados. Escribí una consulta para el asistente…
            </CommandEmpty>

            <CommandGroup heading="Navegación" className="text-[11px] text-muted-foreground tracking-wide uppercase font-semibold">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.key}
                    value={`${item.label} ${item.hint}`}
                    onSelect={() => handleNav(item.key)}
                    className="text-[13px]"
                  >
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{item.label}</span>
                    <span className="text-[11px] text-muted-foreground">{item.hint}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Consultas al asistente" className="text-[11px] text-muted-foreground tracking-wide uppercase font-semibold">
              {AGENT_QUERIES.map((q) => {
                const Icon = q.icon;
                return (
                  <CommandItem
                    key={q.label}
                    value={`agente ${q.label}`}
                    onSelect={() => handleQuery(q.label)}
                    className="text-[13px]"
                  >
                    <Icon className="mr-2 h-4 w-4 text-primary" />
                    <span className="flex-1">{q.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

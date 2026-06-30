// Utilidades de formato y tokens semánticos compartidos

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export function formatCurrency(value: number, opts?: { decimals?: number }) {
  if (opts?.decimals !== undefined) {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: opts.decimals,
      minimumFractionDigits: opts.decimals,
    }).format(value);
  }
  return currencyFormatter.format(value);
}

const numberFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export function formatNumber(value: number, decimals = 0) {
  if (decimals > 0) {
    return new Intl.NumberFormat("es-AR", {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    }).format(value);
  }
  return numberFormatter.format(value);
}

export function formatPct(value: number, decimals = 1) {
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const STATUS_LABELS: Record<string, string> = {
  planning: "Planificación",
  in_progress: "En progreso",
  paused: "Pausada",
  finished: "Finalizada",
  cancelled: "Cancelada",
  pending: "Pendiente",
  done: "Hecha",
  blocked: "Bloqueada",
};

// Semantic class maps using CSS variables (themeable)
export const STATUS_BADGE: Record<string, string> = {
  planning: "bg-info-soft text-info border-info/15",
  in_progress: "bg-warning-soft text-warning border-warning/20",
  paused: "bg-muted text-muted-foreground border-border",
  finished: "bg-success-soft text-success border-success/15",
  cancelled: "bg-destructive/10 text-destructive border-destructive/15",
  pending: "bg-muted text-muted-foreground border-border",
  done: "bg-success-soft text-success border-success/15",
  blocked: "bg-destructive/10 text-destructive border-destructive/15",
};

export const STATUS_DOT: Record<string, string> = {
  planning: "bg-info",
  in_progress: "bg-warning",
  paused: "bg-muted-foreground",
  finished: "bg-success",
  cancelled: "bg-destructive",
  pending: "bg-muted-foreground",
  done: "bg-success",
  blocked: "bg-destructive",
};

export const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-info-soft text-info border-info/15",
  high: "bg-warning-soft text-warning border-warning/20",
  critical: "bg-destructive/10 text-destructive border-destructive/15",
};

export const PRIORITY_DOT: Record<string, string> = {
  low: "bg-muted-foreground",
  medium: "bg-info",
  high: "bg-warning",
  critical: "bg-destructive",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

// Chart colors mapped to CSS variables — access at runtime via getComputedStyle
export function chartColor(idx: number): string {
  const colors = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6"];
  const key = colors[idx % colors.length];
  if (typeof window !== "undefined") {
    const v = getComputedStyle(document.documentElement).getPropertyValue(key).trim();
    if (v) return `oklch(${v})`;
  }
  // Fallbacks (must match globals.css)
  const fallbacks = ["oklch(0.48 0.135 36)", "oklch(0.50 0.10 160)", "oklch(0.52 0.09 260)", "oklch(0.68 0.12 75)", "oklch(0.50 0.15 16)", "oklch(0.55 0.06 200)"];
  return fallbacks[idx % fallbacks.length];
}

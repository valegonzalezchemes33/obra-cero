"use client";

import { formatCurrency, formatNumber, formatPct } from "@/lib/format";

// Custom Recharts tooltip — premium look
export function ChartTooltip({ active, payload, label, type = "currency" }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-md text-[12px]">
      {label && <div className="text-muted-foreground mb-1">{label}</div>}
      <div className="space-y-0.5">
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2 tabular">
            <span className="size-2 rounded-sm" style={{ background: p.color || p.fill }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-medium">
              {type === "currency" ? formatCurrency(p.value) : type === "pct" ? formatPct(p.value) : formatNumber(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const chartAxisProps = {
  tick: { fontSize: 11, fill: "var(--color-muted-foreground)" },
  axisLine: false,
  tickLine: false,
};

export const chartGridProps = {
  stroke: "var(--color-border)",
  strokeDasharray: "none",
  vertical: false,
  opacity: 0.6,
};

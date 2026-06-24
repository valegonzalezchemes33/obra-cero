"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

export interface KpiCardProps {
  label: string;
  value: string;
  delta?: { value: number; label?: string }; // positive=green, negative=red
  sparkline?: number[];
  onClick?: () => void;
  accent?: "primary" | "success" | "warning" | "destructive";
}

export function KpiCard({ label, value, delta, sparkline, onClick, accent = "primary" }: KpiCardProps) {
  const sparkData = (sparkline || []).map((v, i) => ({ i, v }));
  const deltaPositive = (delta?.value ?? 0) >= 0;
  const deltaColor = deltaPositive ? "text-success" : "text-destructive";
  const lineColor =
    accent === "success" ? "var(--color-success)"
    : accent === "warning" ? "var(--color-warning)"
    : accent === "destructive" ? "var(--color-destructive)"
    : "var(--color-chart-1)";

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-150 cursor-pointer group",
        "hover:border-border hover:shadow-xs hover:-translate-y-px",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start justify-between mb-1">
          <div className="micro-label text-muted-foreground/80">{label}</div>
          {delta && (
            <div className={cn("flex items-center gap-0.5 text-[11px] font-medium tabular", deltaColor)}>
              {deltaPositive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(delta.value).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="text-[22px] font-display tracking-tight tabular leading-tight">{value}</div>
        {delta?.label && (
          <div className="text-[11px] text-muted-foreground mt-1 tabular">{delta.label}</div>
        )}
      </div>
      {sparkData.length > 0 && (
        <div className="h-8 w-full -mb-1 opacity-90">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={lineColor}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export function SkeletonKpi() {
  return (
    <Card className="p-5 space-y-3">
      <div className="h-3 w-20 shimmer rounded" />
      <div className="h-6 w-32 shimmer rounded" />
      <div className="h-3 w-16 shimmer rounded" />
    </Card>
  );
}

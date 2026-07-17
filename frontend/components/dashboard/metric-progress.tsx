"use client";

import { type LucideIcon } from "lucide-react";

interface MetricProgressProps {
  icon: LucideIcon;
  label: string;
  current: number;
  target: number;
  unit?: string;
  color?: "green" | "blue" | "amber" | "purple" | "red" | "cyan" | "indigo";
  note?: string;
}

const COLOR_STYLES = {
  green: "bg-emerald-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  purple: "bg-purple-500",
  red: "bg-red-500",
  cyan: "bg-cyan-500",
  indigo: "bg-indigo-500",
};

export function MetricProgress({
  icon: Icon,
  label,
  current,
  target,
  unit = "",
  color = "green",
  note,
}: MetricProgressProps) {
  const safeTarget = target > 0 ? target : 1;
  const percentage = Math.min(100, Math.max(0, (current / safeTarget) * 100));
  const displayCurrent = Number.isFinite(current) ? current : 0;
  const displayTarget = Number.isFinite(target) ? target : 0;

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-brandDark">{label}</span>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {displayCurrent.toLocaleString()} / {displayTarget.toLocaleString()}
          {unit && <span className="ml-0.5">{unit}</span>}
        </span>
      </div>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${COLOR_STYLES[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

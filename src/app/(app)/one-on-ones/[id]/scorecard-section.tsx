"use client";

import { MetricValue } from "@/components/metric-value";
import { MetricIcon } from "@/components/metric-icon";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import type { ValueType, Direction } from "@/lib/domain/metrics/types";

interface ScorecardMetric {
  definitionId: string;
  key: string;
  name: string;
  category: string | null;
  unit: string | null;
  valueType: ValueType;
  direction: Direction;
  isPrimary: boolean;
  currentValue: number | null;
  previousValue: number | null;
  target: {
    targetValue: number;
    warningValue: number | null;
    targetType: string;
    source: string;
  } | null;
  status: { status: string; direction: Direction };
}

function ChangeCell({
  current,
  previous,
  direction,
}: {
  current: number | null;
  previous: number | null;
  direction: Direction;
}) {
  if (current === null || previous === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (previous === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const absPct = Math.abs(pct).toFixed(0);

  const isImproved =
    (direction === "higher_is_better" && pct > 0) || (direction === "lower_is_better" && pct < 0);
  const isDeclined =
    (direction === "higher_is_better" && pct < 0) || (direction === "lower_is_better" && pct > 0);

  if (Math.abs(pct) < 1) {
    return <span className="text-muted-foreground text-xs">→ 0%</span>;
  }

  return (
    <span
      className={cn(
        "text-xs font-semibold",
        isImproved
          ? "text-emerald-600 dark:text-emerald-400"
          : isDeclined
            ? "text-rose-600 dark:text-rose-400"
            : "text-muted-foreground"
      )}
    >
      {pct > 0 ? "↑" : "↓"} {absPct}%
    </span>
  );
}

export function ScorecardSection({ metrics }: { metrics: ScorecardMetric[] }) {
  if (metrics.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-6 text-center">
        No metrics assigned to this team.
      </p>
    );
  }

  const grouped = new Map<string, ScorecardMetric[]>();
  for (const m of metrics) {
    const cat = m.category ?? "other";
    const list = grouped.get(cat) ?? [];
    list.push(m);
    grouped.set(cat, list);
  }

  const CATEGORY_LABELS: Record<string, string> = {
    productivity: "Productivity",
    efficiency: "Efficiency",
    quality: "Quality",
    workload: "Workload",
    attendance: "Attendance",
    other: "Other",
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-slate-50/50 dark:bg-slate-900/50">
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Metric
            </th>
            <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Current
            </th>
            <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Previous
            </th>
            <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Change
            </th>
            <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Target
            </th>
            <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {[...grouped.entries()].map(([category, categoryMetrics]) => (
            <CategoryGroup
              key={category}
              label={CATEGORY_LABELS[category] ?? category}
              metrics={categoryMetrics}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategoryGroup({ label, metrics }: { label: string; metrics: ScorecardMetric[] }) {
  return (
    <>
      <tr>
        <td
          colSpan={6}
          className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400"
        >
          {label}
        </td>
      </tr>
      {metrics.map((m) => (
        <MetricRow key={m.definitionId} metric={m} />
      ))}
    </>
  );
}

function MetricRow({ metric }: { metric: ScorecardMetric }) {
  const m = metric;
  return (
    <tr className="border-t border-border/40 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MetricIcon
            metricKey={m.key}
            category={m.category}
            className="h-3.5 w-3.5 text-[#009ca6] shrink-0"
          />
          <span
            className={cn("font-medium", m.isPrimary ? "text-foreground" : "text-muted-foreground")}
          >
            {m.name}
          </span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-right font-variant-numeric tabular-nums font-semibold text-foreground">
        {m.currentValue !== null ? (
          <MetricValue value={m.currentValue} unit={m.unit} valueType={m.valueType} />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right font-variant-numeric tabular-nums text-muted-foreground">
        {m.previousValue !== null ? (
          <MetricValue value={m.previousValue} unit={m.unit} valueType={m.valueType} />
        ) : (
          <span>—</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right font-variant-numeric tabular-nums">
        <ChangeCell current={m.currentValue} previous={m.previousValue} direction={m.direction} />
      </td>
      <td className="px-4 py-2.5 text-right font-variant-numeric tabular-nums text-muted-foreground">
        {m.target ? (
          <MetricValue value={m.target.targetValue} unit={m.unit} valueType={m.valueType} />
        ) : (
          <span>—</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-center">
        <StatusBadge
          status={
            m.status.status as "on_target" | "warning" | "off_target" | "no_target" | "no_data"
          }
        />
      </td>
    </tr>
  );
}

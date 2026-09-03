import { StatusBadge } from "@/components/status-badge";
import { TrendSparkline } from "@/components/trend-sparkline";
import { MetricValue } from "@/components/metric-value";
import { MetricIcon } from "@/components/metric-icon";
import { Card } from "@/components/ui/card";
import type { EmployeeMetricRow } from "@/lib/domain/metrics/queries";

export function MetricCategoryTable({
  title,
  rows,
  trendByDefinitionId,
}: {
  title: string;
  rows: EmployeeMetricRow[];
  trendByDefinitionId: Map<string, Array<number | null>>;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border/80 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/80 bg-slate-50/30 dark:bg-slate-900/30 text-left font-semibold text-muted-foreground">
              <th className="py-2.5 px-4">Metric</th>
              <th className="py-2.5 px-3 text-right">This Week</th>
              <th className="py-2.5 px-3 text-right">Last Week</th>
              <th className="py-2.5 px-3 text-right">Target</th>
              <th className="py-2.5 px-3 text-right">Status</th>
              <th className="py-2.5 px-4 text-right">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => (
              <tr key={row.definitionId} className="hover:bg-muted/30 transition-colors">
                <td className="py-3 px-4 font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    <MetricIcon
                      metricKey={row.key}
                      category={row.category}
                      className="h-6 w-6 text-[#009ca6]"
                    />
                    <span>{row.name}</span>
                  </div>
                </td>
                <td className="py-3 px-3 text-right font-bold text-foreground">
                  <MetricValue value={row.currentValue} unit={row.unit} valueType={row.valueType} />
                </td>
                <td className="py-3 px-3 text-right text-muted-foreground">
                  <MetricValue value={row.previousValue} unit={row.unit} valueType={row.valueType} />
                </td>
                <td className="py-3 px-3 text-right text-muted-foreground">
                  {row.target ? (
                    <MetricValue
                      value={row.target.targetValue}
                      unit={row.unit}
                      valueType={row.valueType}
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3 px-3 text-right">
                  <div className="flex justify-end">
                    <StatusBadge status={row.status.status} />
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex justify-end">
                    <TrendSparkline
                      values={trendByDefinitionId.get(row.definitionId) ?? []}
                      direction={row.direction}
                      width={64}
                      height={18}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

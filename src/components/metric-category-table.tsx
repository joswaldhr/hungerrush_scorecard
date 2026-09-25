import { StatusBadge } from "@/components/status-badge";
import { MetricValue } from "@/components/metric-value";
import { MetricIcon } from "@/components/metric-icon";
import { Card } from "@/components/ui/card";
import { formatMetricValue } from "@/lib/domain/metrics/types";
import type { EmployeeMetricRow } from "@/lib/domain/metrics/queries";
import {
  TICKET_ATTRIBUTION_QUALITY,
  TICKET_ATTRIBUTION_REASON,
  HISTORICAL_TARGET_REASON,
} from "@/lib/domain/metrics/availability";

const qualityLabels = new Map([
  ["complete", "Complete"],
  ["partial", "Partial"],
  ["missing", "Missing"],
  ["stale", "Stale"],
  ["failed", "Failed"],
  ["unsupported", "Unsupported"],
  [TICKET_ATTRIBUTION_QUALITY, "Human attribution unverified"],
]);
const targetLabels = { employee: "Employee", role: "Role", team: "Team", org: "Organization" };

function MetricDataDetails({ row }: { row: EmployeeMetricRow }) {
  const observed = row.dataFreshnessAt ? new Date(row.dataFreshnessAt) : null;
  const timestamp = observed && Number.isFinite(observed.getTime()) ? observed.toISOString() : null;
  return (
    <details
      data-html2canvas-ignore="true"
      className="mt-1 font-normal text-muted-foreground print:hidden"
    >
      <summary className="cursor-pointer text-[11px] hover:text-foreground">
        Data details<span className="sr-only"> for {row.name}</span>
      </summary>
      <dl className="mt-2 space-y-1 text-[11px]">
        <div>
          <dt className="inline font-medium">Data quality: </dt>
          <dd className="inline">{qualityLabels.get(row.qualityStatus) ?? "Not verified"}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Source observed: </dt>
          <dd className="inline">
            {timestamp ? (
              <time dateTime={timestamp}>{timestamp.slice(0, 16).replace("T", " ")} UTC</time>
            ) : (
              "Not recorded"
            )}
          </dd>
        </div>
        <div>
          <dt className="inline font-medium">Calculation version: </dt>
          <dd className="inline">
            {row.calculationVersion > 0 ? row.calculationVersion : "Not recorded"}
          </dd>
        </div>
        <div>
          <dt className="inline font-medium">Target from: </dt>
          <dd className="inline">
            {row.targetContextStatus === "historical_unverified"
              ? HISTORICAL_TARGET_REASON
              : row.target
                ? targetLabels[row.target.source]
                : "No target applied"}
          </dd>
        </div>
      </dl>
    </details>
  );
}

function TargetCell({ row }: { row: EmployeeMetricRow }) {
  const { target } = row;
  if (!target) return <>—</>;

  if (target.targetType === "range") {
    if (target.targetMin === null || target.targetMax === null) return <>—</>;
    return (
      <span className="tabular-nums">
        {formatMetricValue(target.targetMin, row.unit, row.valueType)}
        {"–"}
        {formatMetricValue(target.targetMax, row.unit, row.valueType)}
      </span>
    );
  }

  return <MetricValue value={target.targetValue} unit={row.unit} valueType={row.valueType} />;
}

interface MetricCategoryTableProps {
  category: string | null;
  title: string;
  rows: EmployeeMetricRow[];
  currentLabel: string;
  previousLabel: string;
}

export function MetricCategoryTable({
  category,
  title,
  rows,
  currentLabel,
  previousLabel,
}: MetricCategoryTableProps) {
  return (
    <Card className="overflow-hidden print:break-inside-avoid">
      <div className="flex items-center gap-2 border-b border-border/80 px-5 py-3 print:py-1 bg-slate-50/50 dark:bg-slate-900/50">
        <MetricIcon category={category} className="h-6 w-6" />
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/80 bg-slate-50/30 dark:bg-slate-900/30 text-left font-semibold text-muted-foreground">
              <th className="py-2 px-4">Metric</th>
              <th className="py-2 px-3 text-right text-foreground bg-[#009ca6]/[0.06]">
                {currentLabel}
              </th>
              <th className="py-2 px-3 text-right">{previousLabel}</th>
              <th className="py-2 px-3 text-right">Target</th>
              <th className="py-2 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => (
              <tr key={row.definitionId} className="hover:bg-muted/30 transition-colors">
                <th scope="row" className="py-2.5 px-4 text-left font-semibold text-foreground">
                  {row.name}
                  <MetricDataDetails row={row} />
                </th>
                <td className="py-2.5 px-3 text-right font-bold text-foreground bg-[#009ca6]/[0.06]">
                  <MetricValue value={row.currentValue} unit={row.unit} valueType={row.valueType} />
                  {row.qualityStatus === TICKET_ATTRIBUTION_QUALITY && (
                    <p className="mt-1 max-w-44 text-[10px] font-normal text-muted-foreground">
                      {TICKET_ATTRIBUTION_REASON}
                    </p>
                  )}
                  {row.currentValue !== null && row.qualityStatus !== "complete" && (
                    <p className="mt-1 text-[10px] font-normal text-muted-foreground">
                      {qualityLabels.get(row.qualityStatus) ?? "Unverified"} data
                    </p>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right text-muted-foreground">
                  <MetricValue
                    value={row.previousValue}
                    unit={row.unit}
                    valueType={row.valueType}
                  />
                </td>
                <td className="py-2.5 px-3 text-right text-muted-foreground">
                  <TargetCell row={row} />
                </td>
                <td className="py-2.5 px-3 text-right">
                  <div className="flex justify-end">
                    <StatusBadge status={row.status.status} />
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

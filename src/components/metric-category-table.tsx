import { StatusBadge } from "@/components/status-badge";
import { MetricValue } from "@/components/metric-value";
import { MetricIcon } from "@/components/metric-icon";
import { Card } from "@/components/ui/card";
import { formatMetricValue } from "@/lib/domain/metrics/types";
import type { EmployeeMetricRow } from "@/lib/domain/metrics/queries";
import { SOURCE_TARGET_REASON } from "@/lib/domain/metrics/source-context";
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
      <summary className="cursor-pointer text-xs hover:text-foreground">
        Data details<span className="sr-only"> for {row.name}</span>
      </summary>
      <dl className="mt-2 space-y-2 rounded-lg bg-muted/65 p-3 text-xs leading-relaxed">
        <div>
          <dt className="inline font-medium">Reporting timezone: </dt>
          <dd className="inline">{row.reportingTimeZone ?? "UTC"}</dd>
        </div>
        {row.comparisonUnavailableReason && (
          <div>
            <dt className="inline font-medium">Comparison: </dt>
            <dd className="inline">{row.comparisonUnavailableReason}</dd>
          </div>
        )}
        {row.sourceDescription && (
          <div>
            <dt className="inline font-medium">Source measurement: </dt>
            <dd className="inline">{row.sourceDescription}</dd>
          </div>
        )}
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
              : row.targetContextStatus === "source_unverified"
                ? SOURCE_TARGET_REASON
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
    <Card className="overflow-hidden shadow-xs print:break-inside-avoid">
      <div className="flex items-center gap-3 border-b border-border/80 bg-card px-5 py-4 print:py-1">
        <MetricIcon category={category} className="h-8 w-8 rounded-lg" />
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      <div className="overflow-x-auto" role="region" aria-label={`${title} metrics`} tabIndex={0}>
        <table className="w-full min-w-[680px] table-fixed text-[13px] print:min-w-0">
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[16%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border/80 bg-muted/45 text-left text-xs font-medium text-muted-foreground">
              <th scope="col" className="px-5 py-3">
                Metric
              </th>
              <th scope="col" className="px-4 py-3 text-right text-primary bg-primary/[0.06]">
                {currentLabel}
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                {previousLabel}
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Target
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => (
              <tr key={row.definitionId} className="hover:bg-muted/30 transition-colors">
                <th
                  scope="row"
                  className="px-5 py-4 align-top text-left font-semibold text-foreground"
                >
                  {row.name}
                  {row.key === "avg_handle_time" && row.sourceDescription && (
                    <p className="mt-1 max-w-56 text-xs font-normal text-muted-foreground">
                      Source measures full resolution time, not active handling time.
                    </p>
                  )}
                  <MetricDataDetails row={row} />
                </th>
                <td className="px-4 py-4 align-top text-right font-semibold tabular-nums text-foreground bg-primary/[0.045]">
                  <MetricValue value={row.currentValue} unit={row.unit} valueType={row.valueType} />
                  {row.qualityStatus === TICKET_ATTRIBUTION_QUALITY && (
                    <p className="mt-1 ml-auto max-w-52 text-xs font-normal text-muted-foreground">
                      {TICKET_ATTRIBUTION_REASON}
                    </p>
                  )}
                  {row.currentValue === null && row.missingReason && (
                    <p className="mt-1 ml-auto max-w-52 text-xs font-normal text-muted-foreground">
                      {row.missingReason}
                    </p>
                  )}
                  {row.currentValue !== null && row.qualityStatus !== "complete" && (
                    <p className="mt-1 text-xs font-normal text-muted-foreground">
                      {qualityLabels.get(row.qualityStatus) ?? "Unverified"} data
                    </p>
                  )}
                </td>
                <td className="px-4 py-4 align-top text-right tabular-nums text-muted-foreground">
                  <MetricValue
                    value={row.previousValue}
                    unit={row.unit}
                    valueType={row.valueType}
                  />
                </td>
                <td className="px-4 py-4 align-top text-right tabular-nums text-muted-foreground">
                  <TargetCell row={row} />
                </td>
                <td className="px-4 py-4 align-top text-right">
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

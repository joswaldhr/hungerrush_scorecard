import { MetricValue } from "./metric-value";
import { StatusBadge } from "./status-badge";
import { headlineMetrics, metricDelta } from "@/lib/domain/metrics/presentation-highlights";
import type { ScorecardRow } from "@/lib/domain/metrics/scorecard-presentation";
import { formatMetricValue } from "@/lib/domain/metrics/types";

export function ScorecardHighlights({
  rows,
  inProgress,
  previousLabel,
}: {
  rows: ScorecardRow[];
  inProgress: boolean;
  previousLabel: string;
}) {
  const selected = headlineMetrics(rows);
  if (!selected.length) return null;
  return (
    <section aria-label="Selected headline metrics" className="grid gap-3 sm:grid-cols-3">
      {selected.map((row) => {
        const delta = metricDelta(row, inProgress);
        return (
          <article
            key={row.definitionId}
            className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5"
          >
            <h2 className="text-sm font-medium leading-relaxed text-foreground">{row.name}</h2>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              <MetricValue value={row.currentValue} unit={row.unit} valueType={row.valueType} />
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {delta ? (
                <>
                  <span className="font-semibold tabular-nums">{delta}</span> vs {previousLabel}
                </>
              ) : inProgress ? (
                "In progress · no weekly change shown"
              ) : (
                "Weekly change unavailable"
              )}
            </p>
            {row.currentValue === null && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {row.missingReason || "No reported value for this week."}
              </p>
            )}
            {row.currentValue !== null && row.qualityStatus !== "complete" && (
              <p className="mt-2 text-sm text-muted-foreground">
                Data quality warning · see details below
              </p>
            )}
            {row.target &&
              row.targetContextStatus !== "historical_unverified" &&
              row.targetContextStatus !== "source_unverified" && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Target:{" "}
                  {row.target.targetType === "range" &&
                  row.target.targetMin !== null &&
                  row.target.targetMax !== null
                    ? `${formatMetricValue(row.target.targetMin, row.unit, row.valueType)}–${formatMetricValue(row.target.targetMax, row.unit, row.valueType)}`
                    : row.target.targetValue !== null
                      ? formatMetricValue(row.target.targetValue, row.unit, row.valueType)
                      : "Unavailable"}
                </p>
              )}
            <div className="mt-3">
              <StatusBadge status={row.displayStatus} />
            </div>
          </article>
        );
      })}
    </section>
  );
}

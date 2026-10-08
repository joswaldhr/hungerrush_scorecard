import type { RecoveryHealth } from "@/lib/domain/metrics/report-recovery-health";

function timestamp(value: string | null) {
  return value ? `${value.slice(0, 16).replace("T", " ")} UTC` : "Not attempted";
}

export function ReportRecoveryHealth({ health }: { health: RecoveryHealth }) {
  if (health.state === "not_configured") return null;
  return (
    <section
      aria-labelledby="recovery-heading"
      className="rounded-xl border border-border p-5 space-y-3"
    >
      <h2 id="recovery-heading" className="font-semibold">
        Solved-ticket refresh by week
      </h2>
      <p className="text-sm text-muted-foreground">
        {health.state === "enabled"
          ? "Automatic recovery is enabled."
          : health.state === "disabled"
            ? "Automatic recovery is disabled; retained requests are shown below."
            : "Recovery status is unavailable. Reload to try again."}{" "}
        Request completion does not certify metric accuracy or every employee’s coverage. Call
        metrics, CSAT, first reply, and roster updates have separate refresh paths.
      </p>
      {health.rows.length > 0 && (
        <div
          role="region"
          aria-label="Solved-ticket recovery requests"
          tabIndex={0}
          className="overflow-x-auto"
        >
          <table className="w-full min-w-[640px] text-sm text-left">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th scope="col" className="p-2">
                  Team / work
                </th>
                <th scope="col" className="p-2">
                  Reporting period
                </th>
                <th scope="col" className="p-2">
                  Request status
                </th>
                <th scope="col" className="p-2">
                  Last attempt
                </th>
              </tr>
            </thead>
            <tbody>
              {health.rows.map((row) => (
                <tr key={row.key} className="border-b border-border last:border-0">
                  <th scope="row" className="p-2 font-medium">
                    {row.team}
                    <span className="block font-normal text-xs text-muted-foreground">
                      {row.metric}
                    </span>
                  </th>
                  <td className="p-2 whitespace-nowrap">
                    {row.periodStart
                      ? `${row.periodStart} – ${row.periodEnd}`
                      : "Source collection"}
                  </td>
                  <td className="p-2">
                    <span
                      className={
                        ["failed", "interrupted", "unknown"].includes(row.status)
                          ? "text-status-attention"
                          : "text-muted-foreground"
                      }
                    >
                      {row.label}
                    </span>
                    {row.retryAt && (
                      <span className="block text-xs text-muted-foreground">
                        Retry eligible {timestamp(row.retryAt)}
                      </span>
                    )}
                  </td>
                  <td className="p-2 whitespace-nowrap">{timestamp(row.lastAttemptAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

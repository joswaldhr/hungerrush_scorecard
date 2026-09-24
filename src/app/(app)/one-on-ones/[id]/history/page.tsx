import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAssignedEmployees, getEffectiveManagerContext } from "@/lib/auth/authorization";
import { getStoredMetricHistory } from "@/lib/domain/metrics/history";
import { getStoredMetricRevisions } from "@/lib/domain/metrics/revisions";
import { formatMetricValue, type ValueType } from "@/lib/domain/metrics/types";
import { formatWeekRangeLong } from "@/lib/utils";
import {
  TICKET_ATTRIBUTION_QUALITY,
  TICKET_ATTRIBUTION_REASON,
} from "@/lib/domain/metrics/availability";

export default async function StoredPeriodsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; before?: string; revisions?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const { ctx } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) redirect("/");
  const { id } = await params;
  const employee = (await getAssignedEmployees(ctx)).find((row) => row.id === id);
  if (!employee) notFound();
  const { period, before, revisions: showRevisions } = await searchParams;
  const history = await getStoredMetricHistory(ctx, id, period);
  if (period && !history.selected) notFound();
  let revisions = null;
  if (history.selected) {
    try {
      revisions = await getStoredMetricRevisions(
        ctx,
        id,
        history.selected.start,
        history.selected.end,
        before
      );
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid revision cursor") notFound();
      throw error;
    }
  }
  const historyPath = `/one-on-ones/${id}/history?${new URLSearchParams({ period: history.selected ? `${history.selected.start}/${history.selected.end}` : "" })}`;
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <Link
        href={`/one-on-ones/${id}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to scorecard
      </Link>
      <header>
        <h1 className="text-2xl font-bold">Stored reporting periods</h1>
        <p className="text-muted-foreground">{employee.displayName}</p>
      </header>
      <p className="text-sm text-muted-foreground">
        Each interval shows its stored values separately, including older reporting calendars.
        Overlapping intervals are not added together. Historical targets and employee context have
        not been verified for these snapshots. Unverified human ticket activity is unavailable;
        original stored evidence is preserved.
      </p>
      {history.selected ? (
        <>
          <form className="flex flex-wrap items-end gap-3">
            <label className="grid gap-2 text-sm">
              Reporting interval (UTC)
              <select
                name="period"
                defaultValue={`${history.selected.start}/${history.selected.end}`}
                className="rounded-md border border-border bg-background px-3 py-2"
              >
                {history.periods.map((interval) => (
                  <option
                    key={`${interval.start}/${interval.end}`}
                    value={`${interval.start}/${interval.end}`}
                  >
                    {formatWeekRangeLong(interval.start, interval.end)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium"
            >
              View interval
            </button>
          </form>
          <section className="overflow-x-auto rounded-lg border border-border">
            <h2 className="border-b border-border p-4 font-semibold">
              {formatWeekRangeLong(history.selected.start, history.selected.end)} (UTC)
            </h2>
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  {[
                    "Metric",
                    "Stored value",
                    "Data quality",
                    "Source observed (UTC)",
                    "Calculation version",
                  ].map((label) => (
                    <th key={label} className="p-3 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <th scope="row" className="p-3 font-medium">
                      {row.name}
                    </th>
                    <td className="p-3 tabular-nums">
                      {row.numericValue === null
                        ? "—"
                        : formatMetricValue(row.numericValue, row.unit, row.valueType as ValueType)}
                    </td>
                    <td className="p-3">
                      {row.quality === TICKET_ATTRIBUTION_QUALITY
                        ? TICKET_ATTRIBUTION_REASON
                        : row.quality}
                    </td>
                    <td className="p-3">{row.observedAt?.toISOString() ?? "Unavailable"}</td>
                    <td className="p-3">{row.calculationVersion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <details
            id="revisions"
            open={before !== undefined || showRevisions === "1"}
            className="rounded-lg border border-border p-4"
          >
            <summary className="cursor-pointer font-medium">Retained previous values</summary>
            <p className="my-3 text-sm text-muted-foreground">
              These are previous values saved before a sync replaced them. They are not added to the
              current values above. Corrections made before revision tracking began may not be
              available.
            </p>
            {revisions?.rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      {[
                        "Metric",
                        "Previous value",
                        "Data quality",
                        "Source observed (UTC)",
                        "Calculation version",
                        "Revision recorded (UTC)",
                      ].map((label) => (
                        <th key={label} scope="col" className="p-3 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {revisions.rows.map((row) => (
                      <tr key={row.id} className="border-t border-border">
                        <th scope="row" className="p-3 font-medium">
                          {row.name}
                        </th>
                        {row.evidence ? (
                          <>
                            <td className="p-3 tabular-nums">
                              {row.evidence.numericValue === null
                                ? "Unavailable"
                                : formatMetricValue(
                                    row.evidence.numericValue,
                                    row.unit,
                                    row.valueType as ValueType
                                  )}
                            </td>
                            <td className="p-3">
                              {row.evidence.quality === TICKET_ATTRIBUTION_QUALITY
                                ? TICKET_ATTRIBUTION_REASON
                                : row.evidence.quality}
                            </td>
                            <td className="p-3">{row.evidence.observedAt ?? "Unavailable"}</td>
                            <td className="p-3">{row.evidence.calculationVersion}</td>
                          </>
                        ) : (
                          <td colSpan={4} className="p-3">
                            Revision evidence unavailable
                          </td>
                        )}
                        <td className="p-3">{row.recordedAt.toISOString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No previous values retained for this interval.
              </p>
            )}
            {(before || revisions?.nextCursor) && (
              <nav aria-label="Retained value pages" className="mt-4 flex flex-wrap gap-4 text-sm">
                {before && (
                  <Link
                    href={`${historyPath}&revisions=1#revisions`}
                    className="underline underline-offset-4"
                  >
                    Newest retained values
                  </Link>
                )}
                {revisions?.nextCursor && (
                  <Link
                    href={`${historyPath}&before=${revisions.nextCursor}#revisions`}
                    className="underline underline-offset-4"
                  >
                    Older retained values
                  </Link>
                )}
              </nav>
            )}
          </details>
        </>
      ) : (
        <p className="text-muted-foreground">No stored reporting periods are available.</p>
      )}
    </div>
  );
}

import type { EmployeeMetricRow } from "@/lib/domain/metrics/queries";

type WireRow = Omit<EmployeeMetricRow, "dataFreshnessAt"> & { dataFreshnessAt: string | null };

export async function fetchScorecardWeek(
  employeeId: string,
  periodStart: string,
  signal: AbortSignal
): Promise<EmployeeMetricRow[]> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  const timeout = setTimeout(cancel, 30_000);
  try {
    const response = await fetch(
      `/api/scorecard-week?${new URLSearchParams({ employeeId, week: periodStart })}`,
      {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        redirect: "error",
        signal: controller.signal,
      }
    );
    if (!response.ok) throw new Error("Unable to load scorecard");
    const data = (await response.json()) as { periodStart: string; rows: WireRow[] };
    if (data.periodStart !== periodStart || !Array.isArray(data.rows))
      throw new Error("Unexpected scorecard period");
    return data.rows.map((row) => ({
      ...row,
      dataFreshnessAt: row.dataFreshnessAt ? new Date(row.dataFreshnessAt) : null,
    }));
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
  }
}

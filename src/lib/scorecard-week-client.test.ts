import { afterEach, expect, it, vi } from "vitest";
import { fetchScorecardWeek } from "./scorecard-week-client";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("uses an uncached credentialed GET and restores observation dates", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      periodStart: "2026-09-20",
      rows: [{ currentValue: 0, dataFreshnessAt: "2026-09-27T00:00:00Z" }],
    })
  );
  vi.stubGlobal("fetch", fetcher);
  const rows = await fetchScorecardWeek("synthetic", "2026-09-20", new AbortController().signal);
  expect(fetcher).toHaveBeenCalledWith(
    "/api/scorecard-week?employeeId=synthetic&week=2026-09-20",
    expect.objectContaining({
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
    })
  );
  expect(rows[0]!.currentValue).toBe(0);
  expect(rows[0]!.dataFreshnessAt).toEqual(new Date("2026-09-27T00:00:00Z"));
});
it("rejects a response for a different period rather than exporting it", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ periodStart: "2026-09-13", rows: [] }))
  );
  await expect(
    fetchScorecardWeek("synthetic", "2026-09-20", new AbortController().signal)
  ).rejects.toThrow("Unexpected scorecard period");
});
it.each(["navigation", "timeout"])("aborts the browser request on %s", async (reason) => {
  vi.useFakeTimers();
  let requestSignal: AbortSignal | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          requestSignal = options.signal;
          requestSignal!.addEventListener("abort", () =>
            reject(new DOMException("Cancelled", "AbortError"))
          );
        })
    )
  );
  const controller = new AbortController();
  const result = fetchScorecardWeek("synthetic", "2026-09-20", controller.signal);
  const assertion = expect(result).rejects.toHaveProperty("name", "AbortError");
  if (reason === "navigation") controller.abort();
  else await vi.advanceTimersByTimeAsync(30_000);
  await assertion;
  expect(requestSignal!.aborted).toBe(true);
});

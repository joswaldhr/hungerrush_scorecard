import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { EmployeeMetricRow } from "@/lib/domain/metrics/queries";
import { ScorecardBody } from "@/components/scorecard-body";
import { resolveReportingWeek } from "@/lib/utils";

const fetchMetrics = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/one-on-ones/[id]/actions", () => ({ getWeekMetrics: fetchMetrics }));
vi.mock("@/components/scorecard-export", () => ({
  SCORECARD_CAPTURE_ID: "scorecard-capture",
  ScorecardExport: ({ periodLabel }: { periodLabel: string }) => (
    <div data-export>{periodLabel}</div>
  ),
}));
vi.mock("@/components/metric-category-table", () => ({
  MetricCategoryTable: ({
    rows,
    currentLabel,
  }: {
    rows: EmployeeMetricRow[];
    currentLabel: string;
  }) => (
    <div data-metrics>
      {currentLabel}: {rows[0]?.currentValue}
    </div>
  ),
}));

function rows(value: number): EmployeeMetricRow[] {
  return [
    {
      definitionId: "metric",
      key: "tickets_resolved",
      name: "Tickets",
      category: "tickets",
      unit: "tickets",
      valueType: "count",
      direction: "higher_is_better",
      displayOrder: 0,
      isPrimary: true,
      currentValue: value,
      previousValue: 1,
      target: null,
      status: { status: "no_target", direction: "higher_is_better" },
      qualityStatus: "complete",
      dataFreshnessAt: null,
      calculationVersion: 1,
    },
  ];
}
function deferred() {
  let resolve!: (value: EmployeeMetricRow[]) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<EmployeeMetricRow[]>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
let root: Root;
let container: HTMLDivElement;
async function click(label: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`Missing button: ${label}`);
  await act(async () => {
    button.click();
  });
}
beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-23T12:00:00Z"));
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  fetchMetrics.mockReset();
  window.history.replaceState(null, "", "/one-on-ones/person");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <ScorecardBody
        employeeId="person"
        employeeName="Test Person"
        employeeJobTitle={null}
        teamName="Team"
        managerName={null}
        initialPeriodStart="2026-09-20"
        initialRows={rows(66)}
      />
    )
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("scorecard period snapshot", () => {
  it("hides prior rows and exports until the requested week resolves", async () => {
    const pending = deferred();
    fetchMetrics.mockReturnValue(pending.promise);
    await click("Previous week");
    expect(container.querySelector("[data-metrics]")).toBeNull();
    expect(container.querySelector("[data-export]")).toBeNull();
    expect(container.textContent).toContain("Loading Sep 13");
    await act(async () => pending.resolve(rows(115)));
    expect(container.querySelector("[data-metrics]")?.textContent).toContain("Sep 13–19: 115");
    expect(container.querySelector("[data-export]")?.textContent).toContain("Sep 13");
  });

  it("restores the current week when Back removes the query parameter", async () => {
    fetchMetrics.mockResolvedValue(rows(115));
    await click("Previous week");
    await act(async () => {
      window.history.replaceState(null, "", "/one-on-ones/person");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(container.querySelector("[data-metrics]")?.textContent).toContain("Sep 20–26: 66");
  });

  it("ignores a slower earlier request after rapid navigation", async () => {
    const first = deferred();
    const second = deferred();
    fetchMetrics.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await click("Previous week");
    await click("Previous week");
    await act(async () => second.resolve(rows(81)));
    await act(async () => first.resolve(rows(115)));
    expect(container.querySelector("[data-metrics]")?.textContent).toContain("Sep 6–12: 81");
    expect(container.querySelector("[data-export]")?.textContent).toContain("Sep 6");
  });

  it("shows a retryable failure instead of stale values or export", async () => {
    fetchMetrics.mockRejectedValueOnce(new Error("failed")).mockResolvedValueOnce(rows(115));
    await click("Previous week");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelector("[data-metrics]")).toBeNull();
    expect(container.querySelector("[data-export]")).toBeNull();
    const retry = [...container.querySelectorAll("button")].find((b) => b.textContent === "Retry")!;
    await act(async () => retry.click());
    expect(container.querySelector("[data-metrics]")?.textContent).toContain("115");
  });

  it("refreshes cached data after its lifetime and on window focus", async () => {
    fetchMetrics
      .mockResolvedValueOnce(rows(115))
      .mockResolvedValueOnce(rows(116))
      .mockResolvedValueOnce(rows(117));
    await click("Previous week");
    await click("Next week");
    vi.setSystemTime(new Date("2026-09-23T12:02:00Z"));
    await click("Previous week");
    expect(container.querySelector("[data-metrics]")?.textContent).toContain("116");
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(container.querySelector("[data-metrics]")?.textContent).toContain("117");
  });
});

describe("reporting-week boundary", () => {
  it("normalizes valid dates and rejects impossible, absent, or future input", () => {
    expect(resolveReportingWeek("2026-09-15")).toBe("2026-09-13");
    for (const value of [null, "", "2026-02-30", "2026-99-99", "2027-01-01"]) {
      expect(resolveReportingWeek(value)).toBe("2026-09-20");
    }
  });
});

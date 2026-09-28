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
  it("switches presentation readability without changing the loaded week, rows or export snapshot", async () => {
    const beforeUrl = window.location.href;
    const beforeRows = container.querySelector("[data-metrics]")?.textContent;
    const beforeExport = container.querySelector("[data-export]")?.textContent;
    const toggle = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Presentation view"
    )!;
    await act(async () => toggle.click());
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[data-presentation-view="true"]')).not.toBeNull();
    expect(container.querySelector("[data-metrics]")?.textContent).toBe(beforeRows);
    expect(container.querySelector("[data-export]")?.textContent).toBe(beforeExport);
    expect(container.textContent).toContain("Reported values do not imply certified accuracy");
    expect(window.location.href).toBe(beforeUrl);
    expect(fetchMetrics).not.toHaveBeenCalled();
    await act(async () => toggle.click());
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("switches review/progress shortcuts and preserves the selected week in history links", async () => {
    fetchMetrics.mockResolvedValue(rows(0));
    await click("Last week · Review");
    expect(window.location.search).toBe("?week=2026-09-13");
    expect(
      container.querySelector('[aria-label="Last week · Review"]')?.getAttribute("aria-pressed")
    ).toBe("true");
    expect(container.textContent).toContain("1 of 1 metrics have reported values");
    expect(container.querySelector('a[href*="history"]')?.getAttribute("href")).toContain(
      "returnWeek=2026-09-13"
    );
    await click("This week · In progress");
    expect(window.location.search).toBe("?week=2026-09-20");
    expect(
      container
        .querySelector('[aria-label="This week · In progress"]')
        ?.getAttribute("aria-pressed")
    ).toBe("true");
    expect(container.querySelector('[aria-label="Next week"]')).toHaveProperty("disabled", true);
    expect(container.querySelector("[data-export]")?.textContent).toContain("In progress");
  });

  it("keeps an empty last week selected instead of substituting another period", async () => {
    fetchMetrics.mockResolvedValue(
      rows(0).map((row) => ({ ...row, currentValue: null, qualityStatus: "missing" }))
    );
    await click("Last week · Review");
    expect(container.textContent).toContain("0 of 1 metrics have reported values");
    expect(container.textContent).toContain("No values are available for this reporting week");
    expect(window.location.search).toBe("?week=2026-09-13");
    expect(fetchMetrics).toHaveBeenCalledTimes(1);
  });

  it("refreshes the default after Sunday rollover while explicit links remain pinned", async () => {
    fetchMetrics.mockResolvedValue(rows(82));
    vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(fetchMetrics).toHaveBeenLastCalledWith("person", "2026-09-20");
    await click("This week · In progress");
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(fetchMetrics).toHaveBeenLastCalledWith("person", "2026-09-27");
    expect(container.querySelector("[data-export]")?.textContent).not.toContain("In progress");
  });
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

  it("restores last week when Back removes the query parameter", async () => {
    fetchMetrics.mockResolvedValue(rows(115));
    await click("Previous week");
    await act(async () => {
      window.history.replaceState(null, "", "/one-on-ones/person");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(container.querySelector("[data-metrics]")?.textContent).toContain("Sep 13–19: 115");
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
  it.each([
    ["2026-09-28T12:00:00Z", "2026-09-20"],
    ["2026-09-26T23:59:59Z", "2026-09-13"],
    ["2026-09-27T00:00:00Z", "2026-09-20"],
    ["2026-10-01T12:00:00Z", "2026-09-20"],
    ["2027-01-01T12:00:00Z", "2026-12-20"],
    ["2026-11-01T06:00:00Z", "2026-10-25"],
  ])("uses last week at %s without changing calendar boundaries", (now, expected) => {
    vi.setSystemTime(new Date(now));
    expect(resolveReportingWeek(null)).toBe(expected);
  });
  it("normalizes valid dates and rejects impossible, absent, or future input", () => {
    expect(resolveReportingWeek("2026-09-15")).toBe("2026-09-13");
    expect(resolveReportingWeek("2026-09-23")).toBe("2026-09-20");
    for (const value of [null, "", "2026-02-30", "2026-99-99", "2027-01-01"]) {
      expect(resolveReportingWeek(value)).toBe("2026-09-13");
    }
  });
});

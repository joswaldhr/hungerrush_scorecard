import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { MetricCategoryTable } from "@/components/metric-category-table";
import type { EmployeeMetricRow } from "@/lib/domain/metrics/queries";

const row: EmployeeMetricRow = {
  definitionId: "synthetic",
  key: "synthetic",
  name: "Synthetic metric",
  category: null,
  unit: "tickets",
  valueType: "count",
  direction: "higher_is_better",
  displayOrder: 0,
  isPrimary: true,
  currentValue: 0,
  previousValue: null,
  target: null,
  status: { status: "no_target", direction: "higher_is_better" },
  qualityStatus: "complete",
  dataFreshnessAt: new Date("2026-09-23T12:34:56Z"),
  calculationVersion: 2,
};
async function renderRow(value: EmployeeMetricRow, check: (container: HTMLDivElement) => void) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <MetricCategoryTable
          category={null}
          title="Metrics"
          rows={[value]}
          currentLabel="Sep 20–26"
          previousLabel="Sep 13–19"
        />
      )
    );
    check(container);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
}

it("shows recorded evidence for confirmed zero without conflating it with missing data", async () => {
  await renderRow(row, (container) => {
    expect(container.querySelector("tbody td")?.textContent).toBe("0");
    const details = container.querySelector("details")!;
    expect(details.textContent).toContain("Data quality: Complete");
    expect(details.querySelector("time")?.getAttribute("datetime")).toBe(
      "2026-09-23T12:34:56.000Z"
    );
    expect(details.textContent).toContain("2026-09-23 12:34 UTC");
    expect(details.textContent).toContain("Calculation version: 2");
    expect(details.textContent).toContain("No target applied");
  });
});

it("marks partial numeric results visibly and identifies the applied target scope", async () => {
  await renderRow(
    {
      ...row,
      currentValue: 12,
      qualityStatus: "partial",
      target: {
        targetValue: 10,
        warningValue: null,
        targetMin: null,
        targetMax: null,
        targetType: "minimum",
        source: "team",
        priority: 0,
      },
    },
    (container) => {
      expect(container.querySelector("tbody td")?.textContent).toContain("Partial data");
      expect(container.querySelector("details")?.textContent).toContain("Target from: Team");
    }
  );
});

it("keeps absent observations and calculation versions explicitly unrecorded", async () => {
  await renderRow(
    {
      ...row,
      currentValue: null,
      qualityStatus: "missing",
      dataFreshnessAt: null,
      calculationVersion: 0,
    },
    (container) => {
      expect(container.querySelector("tbody td")?.textContent).toBe("—");
      expect(container.querySelector("details")?.textContent).toContain(
        "Source observed: Not recorded"
      );
      expect(container.querySelector("details")?.textContent).toContain(
        "Calculation version: Not recorded"
      );
      expect(container.querySelector("time")).toBeNull();
    }
  );
});

it("renders unknown quality values without inheriting object properties", async () => {
  await renderRow({ ...row, qualityStatus: "constructor" }, (container) => {
    expect(container.querySelector("details")?.textContent).toContain("Not verified");
    expect(container.querySelector("tbody td")?.textContent).toContain("Unverified data");
  });
});

it("distinguishes an unverified historical target from an unconfigured target", async () => {
  await renderRow({ ...row, targetContextStatus: "historical_unverified" }, (container) => {
    expect(container.querySelector("details")?.textContent).toContain(
      "Historical target context has not been verified."
    );
    expect(container.querySelector("tbody td")?.textContent).toBe("0");
  });
});

it("explains unavailable human activity in the visible scorecard and printable content", async () => {
  await renderRow(
    {
      ...row,
      currentValue: null,
      previousValue: null,
      qualityStatus: "unverified_attribution",
      status: { status: "no_data", direction: row.direction },
    },
    (container) => {
      const current = container.querySelector("tbody td")!;
      expect(current.textContent).toContain("—");
      expect(current.textContent).toContain("Human activity attribution has not been verified.");
      expect(current.querySelector('[data-html2canvas-ignore="true"]')).toBeNull();
      expect(container.querySelector("details")?.textContent).toContain(
        "Human attribution unverified"
      );
    }
  );
});

it("explains unsupported blanks visibly without representing them as confirmed zero", async () => {
  await renderRow(
    {
      ...row,
      currentValue: null,
      qualityStatus: "unsupported",
      missingReason: "Historical call-leg data is not connected.",
    },
    (container) => {
      expect(container.querySelector("tbody td")?.textContent).toContain(
        "—Historical call-leg data is not connected."
      );
      expect(container.querySelector("details")?.textContent).toContain("Unsupported");
    }
  );
});

it("discloses that the handle-time source measures resolution elapsed time", async () => {
  await renderRow(
    {
      ...row,
      key: "avg_handle_time",
      sourceDescription: "Elapsed business minutes to full resolution.",
    },
    (container) => {
      expect(container.querySelector("tbody th")?.textContent).toContain(
        "Source measures full resolution time, not active handling time."
      );
      expect(container.querySelector("details")?.textContent).toContain(
        "Source measurement: Elapsed business minutes"
      );
    }
  );
});

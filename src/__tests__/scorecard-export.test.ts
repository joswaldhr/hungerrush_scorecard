import { afterEach, describe, expect, it } from "vitest";
import {
  exportCsv,
  exportDataDetails,
  type ExportSnapshot,
} from "@/lib/domain/metrics/export-snapshot";
import { freezeScorecardCapture } from "@/lib/scorecard-capture";

const snapshot: ExportSnapshot = {
  employeeName: "Synthetic employee",
  periodLabel: "Sep 13 – Sep 19, 2026",
  previousPeriodLabel: "Sep 6 – Sep 12, 2026",
  metrics: [
    {
      category: null,
      name: "Tickets",
      currentValue: 0,
      previousValue: null,
      targetValue: null,
      targetType: null,
      targetMin: null,
      targetMax: null,
      status: "no_target",
      unit: "count",
      valueType: "count",
      qualityStatus: "complete",
      dataFreshnessAt: "2026-09-20T07:00:00.000Z",
      calculationVersion: 1,
      targetSource: null,
    },
  ],
};
afterEach(() => {
  document.body.innerHTML = "";
});
describe("scorecard export context", () => {
  it("explains withheld human ticket metrics in CSV and text when no connector reason exists", () => {
    const metrics = snapshot.metrics.map((metric) => ({
      ...metric,
      currentValue: null,
      qualityStatus: "unverified_attribution",
      missingReason: null,
    }));
    const reason = "Human activity attribution has not been verified.";
    expect(exportCsv({ ...snapshot, metrics }, () => "No Data")).toContain(`"${reason}"`);
    expect(exportDataDetails(metrics)).toContain(reason);
    expect(exportDataDetails(snapshot.metrics)).not.toContain(reason);
  });
  it("exports per-metric timezone and changed-definition context without labeling all periods UTC", () => {
    const metrics = snapshot.metrics.map((metric) => ({
      ...metric,
      reportingTimeZone: "America/Chicago",
      sourceContract: "synthetic-v1",
      targetContextStatus: "source_unverified" as const,
      comparisonUnavailableReason: "Definitions changed; comparison unavailable.",
    }));
    const csv = exportCsv({ ...snapshot, metrics }, () => "No Target");
    expect(csv).not.toContain("Period (UTC)");
    expect(csv).toContain(
      '"America/Chicago","synthetic-v1","Definitions changed; comparison unavailable."'
    );
    expect(exportDataDetails(metrics)).toContain("reporting timezone America/Chicago");
    expect(exportDataDetails(metrics)).toContain(
      "Targets have not been verified for this source definition."
    );
  });
  it("retains source definitions and unsupported reasons in CSV and copied/captured content", () => {
    const metrics = snapshot.metrics.map((metric) => ({
      ...metric,
      sourceDescription: "First reply in business minutes.",
      missingReason: "Survey denominator unavailable.",
    }));
    const csv = exportCsv({ ...snapshot, metrics }, () => "No Data");
    expect(csv).toContain('"Source measurement","Unavailable reason"');
    expect(csv).toContain("First reply in business minutes.");
    expect(csv).toContain("Survey denominator unavailable.");
    expect(exportDataDetails(metrics)).toContain("Survey denominator unavailable.");
  });
  it("carries unavailable historical target context into CSV and captured/text evidence", () => {
    const metrics = snapshot.metrics.map((metric) => ({
      ...metric,
      targetContextStatus: "historical_unverified" as const,
    }));
    expect(exportCsv({ ...snapshot, metrics }, () => "No Target")).toContain('"Target context"');
    expect(exportCsv({ ...snapshot, metrics }, () => "No Target")).toContain(
      "Historical target context has not been verified."
    );
    expect(exportDataDetails(metrics)).toContain(
      "Historical target context has not been verified."
    );
  });
  it("exports actual periods, employee, quality and source observation while preserving zero", () => {
    const csv = exportCsv(snapshot, () => "No Target");
    expect(csv).toContain(snapshot.employeeName);
    expect(csv).toContain(snapshot.periodLabel);
    expect(csv).toContain(snapshot.previousPeriodLabel);
    expect(csv).toContain('"0","—"');
    expect(csv).toContain('"complete","2026-09-20T07:00:00.000Z","1","None"');
    expect(csv).not.toContain("This Week");
  });
  it("escapes quotes and spreadsheet formula text", () => {
    const csv = exportCsv({ ...snapshot, employeeName: '=HYPERLINK("example")' }, (value) => value);
    expect(csv).toContain('"\'=HYPERLINK(""example"")"');
  });
  it("freezes capture content before navigation and includes identity and data details", () => {
    const live = document.createElement("div");
    live.id = "scorecard-capture";
    live.textContent = "Original week: 0";
    document.body.append(live);
    const frozen = freezeScorecardCapture(live, snapshot);
    live.textContent = "Different week: 99";
    expect(frozen.element.textContent).toContain("Original week: 0");
    expect(frozen.element.textContent).not.toContain("Different week");
    expect(frozen.element.textContent).toContain(snapshot.employeeName);
    expect(frozen.element.textContent).toContain(snapshot.periodLabel);
    expect(frozen.element.textContent).toContain("observed 2026-09-20T07:00:00.000Z");
    expect(document.querySelectorAll("#scorecard-capture")).toHaveLength(1);
    frozen.dispose();
    expect(frozen.element.isConnected).toBe(false);
  });
});

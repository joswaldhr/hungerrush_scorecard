import { describe, expect, it } from "vitest";
import { demoEmployees, demoRows } from "./fixtures";
import { canAccessDemo } from "./access";
import { loginDestination } from "./login-destination";
import { scorecardPresentation } from "@/lib/domain/metrics/scorecard-presentation";

const now = new Date("2026-09-28T15:00:00Z");
describe("isolated presentation demo", () => {
  it("has 15 unique fictional people, eight POS and seven Menufy", () => {
    expect(demoEmployees).toHaveLength(15);
    expect(new Set(demoEmployees.map((employee) => employee.id)).size).toBe(15);
    expect(new Set(demoEmployees.map((employee) => employee.displayName)).size).toBe(15);
    expect(demoEmployees.filter((employee) => employee.primaryTeamId === "demo-pos")).toHaveLength(
      8
    );
    expect(
      demoEmployees.filter((employee) => employee.primaryTeamId === "demo-menufy")
    ).toHaveLength(7);
  });
  it("provides finite complete comparisons and targets for every person across year/month/current boundaries", () => {
    for (const employee of demoEmployees)
      for (const period of ["2025-12-28", "2026-08-30", "2026-09-13", "2026-09-20", "2026-09-27"]) {
        const rows = demoRows(employee.id, period, now);
        expect(rows).toHaveLength(22);
        for (const row of rows) {
          expect(Number.isFinite(row.currentValue)).toBe(true);
          expect(Number.isFinite(row.previousValue)).toBe(true);
          expect(row.currentValue).toBeGreaterThanOrEqual(0);
          expect(row.target).not.toBeNull();
          expect(row.qualityStatus).toBe("complete");
          expect(row.sourceContract).toBe("cadence-fictional-demo-v1");
          expect(row.sourceDescription).toContain("Sample data:");
          expect(row.dataFreshnessAt!.getTime()).toBeLessThanOrEqual(now.getTime());
          if (row.valueType === "percentage") expect(row.currentValue).toBeLessThanOrEqual(100);
          if (row.valueType === "count") expect(Number.isInteger(row.currentValue)).toBe(true);
        }
        const v = Object.fromEntries(rows.map((row) => [row.key, row.currentValue!]));
        expect(v.outbound_calls_completed! + v.outbound_calls_non_answered!).toBe(
          v.outbound_calls!
        );
        expect(v.inbound_calls_accepted!).toBeLessThanOrEqual(v.inbound_calls_offered!);
        expect(v.inbound_calls_abandoned_on_hold!).toBeLessThanOrEqual(v.inbound_calls_accepted!);
        expect(v.avoidable_worked_elevated_tickets!).toBeLessThanOrEqual(
          v.worked_elevated_tickets!
        );
        expect(v.tickets_resolved!).toBeLessThanOrEqual(v.tickets_updated!);
        expect(v.avg_call_duration_inbound!).toBeGreaterThan(
          v.avg_talk_time_inbound! + v.avg_hold_time_inbound! + v.avg_consultation_time_inbound!
        );
      }
  });
  it("keeps closed-week values stable and has believable variation and real zeros", () => {
    const first = demoRows("demo-01", "2026-09-20", now);
    expect(first).toEqual(demoRows("demo-01", "2026-09-20", new Date("2026-10-10T00:00:00Z")));
    expect(first.some((row) => row.currentValue === 0)).toBe(true);
    expect(first.some((row) => row.currentValue !== row.previousValue)).toBe(true);
    expect(first).not.toEqual(demoRows("demo-02", "2026-09-20", now));
  });
  it("rejects live employee IDs and malformed or future weeks", () => {
    expect(() => demoRows("40000000-0000-4000-8000-00000000000d", "2026-09-20", now)).toThrow();
    for (const date of ["bad", "2026-02-30", "2026-09-28", "2099-01-04"])
      expect(() => demoRows("demo-01", date, now)).toThrow();
  });
  it("uses neutral progress presentation when the fixture week is current", () => {
    const week = new Date();
    week.setUTCDate(week.getUTCDate() - week.getUTCDay());
    const start = week.toISOString().slice(0, 10);
    const presentation = scorecardPresentation(start, demoRows("demo-01", start));
    expect(presentation.reported).toBe(22);
    expect(presentation.mode).toBe("progress");
    expect(presentation.rows.every((row) => row.displayStatus === "in_progress")).toBe(true);
  });
  it("requires an explicit exact allowlist and refuses production even when enabled", () => {
    const config = {
      enabled: "true",
      allowedEmails: "presenter@example.test, reviewer@example.test",
      deployment: "preview",
    };
    expect(canAccessDemo(" Presenter@Example.Test ", config)).toBe(true);
    for (const email of [
      null,
      "",
      "outsider@example.test",
      "presenter@example.test.evil",
      "example.test",
    ])
      expect(canAccessDemo(email, config)).toBe(false);
    expect(canAccessDemo("presenter@example.test", { ...config, enabled: undefined })).toBe(false);
    expect(canAccessDemo("presenter@example.test", { ...config, allowedEmails: undefined })).toBe(
      false
    );
    expect(canAccessDemo("presenter@example.test", { ...config, deployment: "production" })).toBe(
      false
    );
  });
  it("preserves demo sign-in without allowing arbitrary redirects", () => {
    expect(loginDestination("demo")).toBe("/demo/one-on-ones");
    expect(loginDestination(undefined, "https://preview.example/demo/one-on-ones/demo-01")).toBe(
      "/demo/one-on-ones"
    );
    expect(loginDestination("https://evil.test", "https://evil.test/steal")).toBe("/");
    expect(loginDestination(undefined, "/demolition")).toBe("/");
    expect(loginDestination()).toBe("/");
  });
});

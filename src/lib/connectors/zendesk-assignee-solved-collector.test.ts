import { describe, expect, it, vi } from "vitest";
import { fetchAssigneeSolvedReportCandidate } from "./zendesk-assignee-solved-collector";
import {
  calculateAssigneeSolvedReport,
  type AssigneeSolvedReportScope,
} from "./zendesk-assignee-solved-report";
const scope: AssigneeSolvedReportScope = {
  periodStart: "2026-09-27",
  periodEnd: "2026-10-03",
  timeZone: "America/Chicago",
  agentIds: [1, 2],
  groupIds: null,
  brandIds: null,
  dateBasis: "latest-solved",
  attribution: "current-assignee",
};
const now = () => new Date("2026-10-06T00:00:00Z");
const page = (ids: number[], next: string | null = null) => ({
  results: ids.map((id) => ({ id, subject: "PRIVATE" })),
  meta: { has_more: next !== null },
  links: { next },
});
const joined = () => ({
  tickets: [
    { id: 100, assignee_id: 2, group_id: 10, brand_id: 20, status: "solved", subject: "PRIVATE" },
  ],
  metric_sets: [{ ticket_id: 100, solved_at: "2026-09-28T12:00:00Z" }],
});
describe("bounded assignee-solved candidate collection", () => {
  it("supports an explicit current-period cutoff and excludes later joined solves", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(page([100]))
      .mockResolvedValueOnce(joined());
    const s = await fetchAssigneeSolvedReportCandidate(scope, read, {
      now: () => new Date("2026-09-28T12:00:30Z"),
      allowCurrentPeriod: true,
    });
    expect(s.coverage.asOf).toBe("2026-09-28T11:59:30.000Z");
    expect(
      calculateAssigneeSolvedReport(s, scope).agents.map((a) => a.assigneeSolvedTickets)
    ).toEqual([0, 0]);
  });
  it("does not use progress mode for a future reporting week", async () => {
    const read = vi.fn();
    await expect(
      fetchAssigneeSolvedReportCandidate(scope, read, {
        now: () => new Date("2026-09-26T12:00:00Z"),
        allowCurrentPeriod: true,
      })
    ).rejects.toThrow("cutoff");
    expect(read).not.toHaveBeenCalled();
  });
  it("uses complete cursor search then freshly joined assignee and solved-date evidence", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(page([100], "/search/export.json?page[after]=next"))
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(joined());
    const s = await fetchAssigneeSolvedReportCandidate(scope, read, { now });
    expect(read).toHaveBeenCalledTimes(3);
    const query = new URL(read.mock.calls[0]![0], "https://example.invalid").searchParams.get(
      "query"
    );
    expect(query).toContain("solved>=2026-09-26 solved<=2026-10-04 assignee:1 assignee:2");
    expect(query).not.toContain("group:");
    expect(JSON.stringify(s)).not.toContain("PRIVATE");
    expect(
      calculateAssigneeSolvedReport(s, scope).agents.map((a) => a.assigneeSolvedTickets)
    ).toEqual([0, 1]);
  });
  it("fails instead of returning a partial or missing parent census", async () => {
    const missing = vi
      .fn()
      .mockResolvedValueOnce(page([100]))
      .mockResolvedValueOnce({ tickets: [], metric_sets: [] });
    await expect(fetchAssigneeSolvedReportCandidate(scope, missing, { now })).rejects.toThrow(
      "coverage"
    );
    const duplicate = joined();
    duplicate.metric_sets.push({ ...duplicate.metric_sets[0]! });
    const read = vi
      .fn()
      .mockResolvedValueOnce(page([100]))
      .mockResolvedValueOnce(duplicate);
    await expect(fetchAssigneeSolvedReportCandidate(scope, read, { now })).rejects.toThrow(
      "coverage"
    );
  });
  it("shares one budget across search and joins and never swallows a source failure", async () => {
    const read = vi.fn().mockResolvedValue(page([100]));
    await expect(
      fetchAssigneeSolvedReportCandidate(scope, read, { now, requestBudget: 1 })
    ).rejects.toThrow("budget");
    expect(read).toHaveBeenCalledTimes(1);
    await expect(
      fetchAssigneeSolvedReportCandidate(
        scope,
        vi.fn().mockRejectedValue(new Error("source unavailable")),
        { now }
      )
    ).rejects.toThrow("source unavailable");
  });
  it("rejects invalid, oversized and unfinished reporting scopes before source requests", async () => {
    const read = vi.fn();
    await expect(
      fetchAssigneeSolvedReportCandidate(
        { ...scope, agentIds: Array.from({ length: 61 }, (_, i) => i + 1) },
        read,
        { now }
      )
    ).rejects.toThrow("term budget");
    await expect(
      fetchAssigneeSolvedReportCandidate(scope, read, {
        now: () => new Date("2026-10-02T12:00:00Z"),
      })
    ).rejects.toThrow("closed");
    await expect(
      fetchAssigneeSolvedReportCandidate(scope, read, { now, requestBudget: 0 })
    ).rejects.toThrow("budget");
    expect(read).not.toHaveBeenCalled();
  });
  it("can collect a just-closed local week without requiring the padded future date", async () => {
    const read = vi.fn().mockResolvedValue(page([]));
    const s = await fetchAssigneeSolvedReportCandidate(scope, read, {
      now: () => new Date("2026-10-04T05:02:00Z"),
    });
    expect(
      calculateAssigneeSolvedReport(s, scope).agents.map((a) => a.assigneeSolvedTickets)
    ).toEqual([0, 0]);
  });
  it("rejects a backwards observation clock", async () => {
    const times = [new Date("2026-10-06T00:00:00Z"), new Date("2026-10-05T23:59:00Z")];
    await expect(
      fetchAssigneeSolvedReportCandidate(scope, vi.fn().mockResolvedValue(page([])), {
        now: () => times.shift()!,
      })
    ).rejects.toThrow("backwards");
  });
});

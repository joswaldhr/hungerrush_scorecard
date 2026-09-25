// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  calculateSolvedCsatCandidate,
  fetchSolvedCsatCandidate,
  type SolvedCsatScope,
  type SolvedCsatTicket,
} from "./zendesk-solved-csat";

const scope: SolvedCsatScope = {
  periodStart: "2026-09-13",
  periodEnd: "2026-09-19",
  timeZone: "America/Chicago",
  agentId: 7,
  groupIds: [20, 21],
  brandIds: null,
};
const collectorScope = { ...scope, agentIds: [7] };
const ticket = (
  id: number,
  score: "good" | "bad" | "offered" | "unoffered" = "good",
  patch: Partial<SolvedCsatTicket> = {}
): SolvedCsatTicket => ({
  id,
  assignee_id: 7,
  group_id: 20,
  brand_id: 30,
  satisfaction_rating: { score },
  ...patch,
});
const metric = (ticket_id: number, solved_at: string | null = "2026-09-14T12:00:00Z") => ({
  ticket_id,
  solved_at,
});
const page = (tickets: SolvedCsatTicket[], next: string | null = null) => ({
  results: tickets,
  meta: { has_more: next !== null },
  links: { next },
});

describe("solved-date CSAT candidate", () => {
  it("keeps rating score and response denominators distinct, including unreturned offers", () => {
    const r = calculateSolvedCsatCandidate(
      [ticket(1), ticket(2, "bad"), ticket(3, "offered"), ticket(4, "unoffered")],
      [1, 2, 3, 4].map((n) => metric(n)),
      scope
    );
    expect(r.score).toEqual({ numerator: 1, denominator: 2, value: 50 });
    expect(r.response).toEqual({ numerator: 2, denominator: 3, value: 200 / 3 });
    expect(r.surveyedIds).toEqual([1, 2, 3]);
    expect(r.cohortIds).toEqual([1, 2, 3, 4]);
  });
  it("uses local latest-solved dates, current assignee and explicit groups and brand", () => {
    const tickets = [
      ticket(1),
      ticket(2),
      ticket(3),
      ticket(4),
      ticket(5, "good", { assignee_id: 8 }),
      ticket(6, "good", { group_id: 22 }),
      ticket(7, "good", { brand_id: 31 }),
    ];
    const metrics = [
      metric(1, "2026-09-13T04:59:59Z"),
      metric(2, "2026-09-13T05:00:00Z"),
      metric(3, "2026-09-20T04:59:59Z"),
      metric(4, "2026-09-20T05:00:00Z"),
      metric(5),
      metric(6),
      metric(7),
    ];
    expect(
      calculateSolvedCsatCandidate(tickets, metrics, { ...scope, brandIds: [30] }).goodIds
    ).toEqual([2, 3]);
  });
  it("distinguishes no ratings, an unanswered offer and a true zero satisfaction score", () => {
    expect(
      calculateSolvedCsatCandidate([ticket(1, "unoffered")], [metric(1)], scope)
    ).toMatchObject({ score: { value: null }, response: { value: null } });
    expect(calculateSolvedCsatCandidate([ticket(1, "offered")], [metric(1)], scope)).toMatchObject({
      score: { value: null },
      response: { value: 0 },
    });
    expect(calculateSolvedCsatCandidate([ticket(1, "bad")], [metric(1)], scope)).toMatchObject({
      score: { value: 0 },
      response: { value: 100 },
    });
  });
  it("fails missing metric/brand evidence, duplicate IDs and unknown satisfaction values", () => {
    expect(() => calculateSolvedCsatCandidate([ticket(1)], [], scope)).toThrow(/coverage/);
    expect(() => calculateSolvedCsatCandidate([ticket(1), ticket(1)], [metric(1)], scope)).toThrow(
      /Duplicate/
    );
    expect(() => calculateSolvedCsatCandidate([ticket(1)], [metric(1), metric(1)], scope)).toThrow(
      /Duplicate/
    );
    expect(() =>
      calculateSolvedCsatCandidate([ticket(1, "good", { brand_id: undefined })], [metric(1)], {
        ...scope,
        brandIds: [30],
      })
    ).toThrow(/brand evidence/);
    expect(() =>
      calculateSolvedCsatCandidate(
        [
          {
            ...ticket(1),
            satisfaction_rating: { score: "unknown" },
          } as unknown as SolvedCsatTicket,
        ],
        [metric(1)],
        scope
      )
    ).toThrow(/source snapshot/);
  });
  it("fetches all satisfaction states without the commented-rating search trap", async () => {
    const get = vi.fn(async (path: string): Promise<unknown> => {
      if (path.startsWith("/search/export")) return page([ticket(1)], "/next");
      if (path === "/next") return page([ticket(2, "offered"), ticket(3, "unoffered")]);
      return { metric_sets: [metric(1), metric(2), metric(3)] };
    });
    const result = await fetchSolvedCsatCandidate(collectorScope, get);
    expect(result.coverage).toMatchObject({
      complete: true,
      requests: 3,
      population: "all-solved-satisfaction-states",
    });
    const query = new URL(get.mock.calls[0]![0], "https://example.test").searchParams.get("query")!;
    expect(query).toContain("solved>=2026-09-12 solved<=2026-09-20");
    expect(query).toContain("group:20 group:21");
    expect(query).not.toMatch(/satisfaction|updated/);
    expect(query).toContain("assignee:7");
    expect(calculateSolvedCsatCandidate(result.tickets, result.metrics, scope).response).toEqual({
      numerator: 1,
      denominator: 2,
      value: 50,
    });
  });
  it("requires every requested metric set and rejects foreign or duplicate metric IDs", async () => {
    for (const metrics of [[], [metric(2)], [metric(1), metric(1)]]) {
      const get = vi.fn(async (path: string) =>
        path.startsWith("/search/export") ? page([ticket(1)]) : { metric_sets: metrics }
      );
      await expect(fetchSolvedCsatCandidate(collectorScope, get)).rejects.toThrow(/coverage/);
    }
  });
  it("does not return partial data on budget exhaustion or a failed source page", async () => {
    const get = vi.fn(async () => page([ticket(1)]));
    await expect(
      fetchSolvedCsatCandidate(collectorScope, get, { requestBudget: 1 })
    ).rejects.toThrow(/budget exhausted/);
    expect(get).toHaveBeenCalledTimes(1);
    await expect(
      fetchSolvedCsatCandidate(collectorScope, async () => {
        throw new Error("source unavailable");
      })
    ).rejects.toThrow("source unavailable");
  });
  it("rejects empty scope and malformed page coverage rather than yielding a zero", async () => {
    const get = vi.fn(async () => ({ results: [], meta: {}, links: { next: null } }));
    await expect(
      fetchSolvedCsatCandidate({ ...collectorScope, groupIds: [] }, get)
    ).rejects.toThrow(/group scope/);
    expect(get).not.toHaveBeenCalled();
    await expect(
      fetchSolvedCsatCandidate({ ...collectorScope, agentIds: [] }, get)
    ).rejects.toThrow(/employee identities/);
    await expect(
      fetchSolvedCsatCandidate(
        { ...collectorScope, agentIds: Array.from({ length: 61 }, (_, i) => i + 1) },
        get
      )
    ).rejects.toThrow(/search term budget/);
    expect(get).not.toHaveBeenCalled();
    await expect(fetchSolvedCsatCandidate(collectorScope, get)).rejects.toThrow(/export page/);
    expect(() =>
      calculateSolvedCsatCandidate([], [], { ...scope, periodStart: "2026-02-30" })
    ).toThrow(/day/);
  });
});

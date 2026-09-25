// @vitest-environment node
import { expect, it } from "vitest";
import { buildSolvedCsatRecord, normalizeSolvedCsatRecord } from "./zendesk-solved-csat-record";
import { type fetchSolvedCsatCandidate } from "./zendesk-solved-csat";
type Snapshot = Awaited<ReturnType<typeof fetchSolvedCsatCandidate>>;
const identity = {
  agentId: 7,
  externalId: "synthetic@example.test",
  accountReference: "zendesk-account:synthetic",
  subdomain: "synthetic",
};
export function syntheticCsatSnapshot(): Snapshot {
  return {
    tickets: ["good", "bad", "offered"].map((score, i) => ({
      id: i + 1,
      assignee_id: 7,
      group_id: 20,
      brand_id: 30,
      satisfaction_rating: { score: score as "good" | "bad" | "offered" },
    })),
    metrics: [1, 2, 3].map((ticket_id) => ({ ticket_id, solved_at: "2026-09-14T12:00:00Z" })),
    coverage: {
      complete: true,
      population: "all-solved-satisfaction-states",
      requests: 2,
      query: "synthetic",
      observationStartedAt: "2026-09-20T07:00:00Z",
      observationEndedAt: "2026-09-20T07:00:01Z",
      timeZone: "America/Chicago",
      periodStart: "2026-09-13",
      periodEnd: "2026-09-19",
      groupIds: [20],
      brandIds: [30],
      agentIds: [7],
    },
  };
}
function facts(snapshot = syntheticCsatSnapshot()) {
  const record = buildSolvedCsatRecord(snapshot, identity);
  return normalizeSolvedCsatRecord(record.payload, "employee", "team", "2026-09-13", "2026-09-19");
}
it("retains exact numerator/denominator and IDs without rounding or employee content", () => {
  const input = syntheticCsatSnapshot();
  Object.assign(input.tickets[0]!, { subject: "DO NOT RETAIN", description: "DO NOT RETAIN" });
  const record = buildSolvedCsatRecord(input, identity);
  expect(JSON.stringify(record)).not.toContain("DO NOT RETAIN");
  expect(record.externalRecordId).toBe("csat-synthetic@example.test-2026-09-13");
  expect(record.sourceUpdatedAt?.toISOString()).toBe("2026-09-20T07:00:00.000Z");
  const [score, response] = facts();
  expect(score).toMatchObject({
    numericValue: 50,
    dimensionsJson: {
      numerator: 1,
      denominator: 2,
      numeratorTicketIds: [1],
      denominatorTicketIds: [1, 2],
    },
  });
  expect(response).toMatchObject({
    numericValue: 200 / 3,
    dimensionsJson: { numerator: 2, denominator: 3, denominatorTicketIds: [1, 2, 3] },
  });
});
it("emits explicit null and zero facts rather than dropping corrected values", () => {
  const empty = syntheticCsatSnapshot();
  empty.tickets = [];
  empty.metrics = [];
  expect(facts(empty).map((f) => f.numericValue)).toEqual([null, null]);
  const offered = syntheticCsatSnapshot();
  offered.tickets = offered.tickets.slice(2);
  offered.metrics = offered.metrics.slice(2);
  expect(facts(offered).map((f) => f.numericValue)).toEqual([null, 0]);
});

it("publishes only the metrics explicitly selected for a team", () => {
  const record = buildSolvedCsatRecord(syntheticCsatSnapshot(), {
    ...identity,
    metricKeys: ["csat_score"],
  });
  const normalized = normalizeSolvedCsatRecord(
    record.payload,
    "employee",
    null,
    "2026-09-13",
    "2026-09-19"
  );
  expect(normalized.map((f) => f.factType)).toEqual(["csat_score"]);
});
it("binds comparisons to canonical account, identity, group and brand scope", () => {
  const reordered = syntheticCsatSnapshot();
  reordered.coverage.groupIds = [21, 20];
  const a = facts(reordered)[0]!.dimensionsJson!.sourceScopeFingerprint;
  reordered.coverage.groupIds = [20, 21];
  expect(facts(reordered)[0]!.dimensionsJson!.sourceScopeFingerprint).toBe(a);
  reordered.coverage.brandIds = null;
  expect(facts(reordered)[0]!.dimensionsJson!.sourceScopeFingerprint).not.toBe(a);
  expect(() => buildSolvedCsatRecord(reordered, { ...identity, subdomain: "other" })).toThrow(
    /binding/
  );
  expect(() => buildSolvedCsatRecord(reordered, { ...identity, agentId: 8 })).toThrow(/coverage/);
});
it("rejects incomplete snapshots, period relabeling and unsupported contracts", () => {
  const incomplete = syntheticCsatSnapshot();
  incomplete.metrics.pop();
  expect(() => facts(incomplete)).toThrow(/coverage|evidence/);
  const record = buildSolvedCsatRecord(syntheticCsatSnapshot(), identity);
  expect(() =>
    normalizeSolvedCsatRecord(record.payload, "employee", null, "2026-09-20", "2026-09-26")
  ).toThrow(/interval/);
  expect(() =>
    normalizeSolvedCsatRecord(
      { ...record.payload, sourceContract: "unknown" },
      "employee",
      null,
      "2026-09-13",
      "2026-09-19"
    )
  ).toThrow(/evidence/);
  const backwards = syntheticCsatSnapshot();
  backwards.coverage.observationEndedAt = "2026-09-19T00:00:00Z";
  expect(() => facts(backwards)).toThrow(/observation/);
});

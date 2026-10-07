import { describe, expect, it } from "vitest";
import { solvedPublicationFixture } from "@/__tests__/fixtures/solved-publication";
import {
  buildSolvedPublicationRecord,
  normalizeSolvedPublicationRecord,
  parseSolvedRelease,
  assertSolvedObservationFresh,
} from "./zendesk-solved-publication-record";
import { sharedMetricSourceContext } from "@/lib/domain/metrics/source-context";

const build = (f = solvedPublicationFixture()) =>
  buildSolvedPublicationRecord(
    f.snapshot,
    f.policy,
    f.config,
    f.identity,
    f.periodStart,
    f.periodEnd
  );
function facts(f = solvedPublicationFixture()) {
  return normalizeSolvedPublicationRecord(
    build(f).payload,
    f.identity.employeeId,
    f.identity.teamId,
    f.periodStart,
    f.periodEnd
  );
}
describe("qualified solved ticket publication", () => {
  it("publishes only recalculated solved credits, not updates or human-only metrics", () => {
    const f = solvedPublicationFixture();
    const rows = facts(f);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      factType: "zendesk_tickets_solved_credits",
      numericValue: 1,
      dimensionsJson: {
        attribution: "updater-account",
        humanActivityVerified: false,
        publicationEligible: true,
      },
    });
    expect(() =>
      sharedMetricSourceContext([rows[0]!.dimensionsJson, rows[0]!.dimensionsJson])
    ).toThrow("one complete");
  });
  it("does not let unqualified update-role evidence suppress a qualified solved count", () => {
    const f = solvedPublicationFixture();
    f.snapshot.identities = [];
    expect(facts(f)[0]!.numericValue).toBe(1);
  });
  it("uses current assignee rather than updater for the separate POS contract", () => {
    const f = solvedPublicationFixture();
    f.policy = { ...f.policy, kind: "assignee-solved", groupIds: null, brandIds: null };
    f.snapshot.events[0]!.updater_id = 99;
    expect(facts(f)[0]).toMatchObject({
      factType: "zendesk_assignee_solved_tickets",
      numericValue: 1,
    });
    f.snapshot.tickets[0]!.assignee_id = 99;
    expect(facts(f)[0]!.numericValue).toBe(0);
  });
  it("preserves verified zero while refusing incomplete coverage and missing parents", () => {
    const f = solvedPublicationFixture();
    f.snapshot.events = [];
    expect(facts(f)[0]!.numericValue).toBe(0);
    f.snapshot.coverage.complete = false;
    expect(() => build(f)).toThrow("complete source");
    const missing = solvedPublicationFixture();
    missing.snapshot.tickets = [];
    expect(() => build(missing)).toThrow("complete source");
  });
  it("rejects stale/future observations and an interval before cutover", () => {
    const f = solvedPublicationFixture();
    const r = build(f);
    expect(() => assertSolvedObservationFresh(r.payload, new Date(Date.now() + 3600000))).toThrow(
      "stale"
    );
    expect(() => assertSolvedObservationFresh(r.payload, new Date(Date.now() - 3600000))).toThrow(
      "future"
    );
    f.policy.effectivePeriodStart = new Date(Date.parse(f.periodStart) + 7 * 86400000)
      .toISOString()
      .slice(0, 10);
    expect(() => build(f)).toThrow("interval");
  });
  it("rejects foreign account, source, team, employee and week contexts", () => {
    const f = solvedPublicationFixture(),
      r = build(f);
    expect(() => parseSolvedRelease({ ...f.policy, subdomain: "foreign" })).toThrow("binding");
    expect(() =>
      buildSolvedPublicationRecord(
        f.snapshot,
        f.policy,
        { ...f.config, dataSourceId: f.identity.employeeId },
        f.identity,
        f.periodStart,
        f.periodEnd
      )
    ).toThrow("own");
    expect(() =>
      normalizeSolvedPublicationRecord(
        r.payload,
        f.config.organizationId,
        f.identity.teamId,
        f.periodStart,
        f.periodEnd
      )
    ).toThrow("context");
    expect(() =>
      normalizeSolvedPublicationRecord(
        r.payload,
        f.identity.employeeId,
        null,
        f.periodStart,
        f.periodEnd
      )
    ).toThrow("context");
    expect(() =>
      normalizeSolvedPublicationRecord(
        r.payload,
        f.identity.employeeId,
        f.identity.teamId,
        f.periodEnd,
        f.periodEnd
      )
    ).toThrow("context");
  });
  it("replays retained evidence and rejects forged totals or contract substitution", () => {
    const f = solvedPublicationFixture(),
      r = build(f);
    const normalize = (payload: unknown) =>
      normalizeSolvedPublicationRecord(
        payload,
        f.identity.employeeId,
        f.identity.teamId,
        f.periodStart,
        f.periodEnd
      );
    expect(() => normalize({ ...r.payload, total: 999 })).toThrow();
    expect(() =>
      normalize({ ...r.payload, sourceContract: "zendesk-qualified-assignee-solved-tickets-v1" })
    ).toThrow("context");
    const evidence = r.payload.sourceEvidence as { events: unknown[] };
    evidence.events = [];
    expect(normalize(r.payload)[0]!.numericValue).toBe(0);
  });
});

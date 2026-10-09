import { describe, expect, it } from "vitest";
import { solvedPublicationFixture } from "@/__tests__/fixtures/solved-publication";
import { sharedMetricSourceContext } from "@/lib/domain/metrics/source-context";
import { metricSourceDescription, metricSourceName } from "@/lib/domain/metrics/source-description";
import { parseSolvedReportReleases } from "./zendesk-solved-config";
import {
  assertAgentUpdateObservationFresh,
  buildAgentUpdatePublicationRecord,
  normalizeAgentUpdatePublicationRecord,
  parseAgentUpdateRelease,
} from "./zendesk-agent-update-publication-record";

const fixture = () => {
  const f = solvedPublicationFixture();
  return { ...f, policy: { ...f.policy, kind: "agent-updates" as const, groupIds: [10] } };
};
const build = (f = fixture()) =>
  buildAgentUpdatePublicationRecord(
    f.snapshot,
    f.policy,
    f.config,
    f.identity,
    f.periodStart,
    f.periodEnd
  );
const facts = (f = fixture()) =>
  normalizeAgentUpdatePublicationRecord(
    build(f).payload,
    f.identity.employeeId,
    f.identity.teamId,
    f.periodStart,
    f.periodEnd
  );

describe("separate agent-update publication boundary", () => {
  it("counts distinct updates, including account-attributed activity, not fields or solved tickets", () => {
    const f = fixture();
    f.snapshot.events.push({ ...f.snapshot.events[0]!, id: 3, child_events: [] });
    f.snapshot.events.push({ ...f.snapshot.events[0]! }); // identical export boundary overlap
    f.snapshot.tickets[0]!.status = "open";
    const rows = facts(f);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      factType: "zendesk_agent_update_events",
      numericValue: 2,
      unit: "updates",
      dimensionsJson: { attribution: "updater-account", humanActivityVerified: false },
    });
    const context = sharedMetricSourceContext([rows[0]!.dimensionsJson]);
    expect(metricSourceName("Old label", "zendesk_agent_update_events", context)).toBe(
      "Agent update events"
    );
    expect(metricSourceDescription("zendesk_agent_update_events", "zendesk", context)).toContain(
      "does not establish manual human activity"
    );
  });
  it("requires role evidence for both a nonzero count and an apparent zero", () => {
    const f = fixture();
    f.snapshot.identities = [];
    expect(() => build(f)).toThrow("role evidence");
    f.snapshot.events = [];
    expect(() => build(f)).toThrow("role evidence");
    f.snapshot.identities = [{ id: 42, role: "agent" }];
    expect(facts(f)[0]!.numericValue).toBe(0);
  });
  it("rejects incomplete coverage and missing parents; does not infer deletion", () => {
    const f = fixture();
    f.snapshot.coverage.complete = false;
    expect(() => build(f)).toThrow("complete event");
    f.snapshot.coverage.complete = true;
    f.snapshot.tickets = [];
    expect(() => build(f)).toThrow("complete event");
  });
  it("replays scoped current-parent evidence and preserves an explicit zero", () => {
    const f = fixture();
    f.snapshot.tickets[0]!.group_id = 99;
    expect(facts(f)[0]!.numericValue).toBe(0);
    f.snapshot.tickets[0]!.group_id = 10;
    f.snapshot.tickets[0]!.brand_id = 99;
    expect(facts(f)[0]!.numericValue).toBe(0);
  });
  it("rejects supplied totals, changed employee context and solved-policy activation", () => {
    const f = fixture(),
      r = build(f);
    expect(() =>
      normalizeAgentUpdatePublicationRecord(
        { ...r.payload, numericValue: 999 },
        f.identity.employeeId,
        f.identity.teamId,
        f.periodStart,
        f.periodEnd
      )
    ).toThrow();
    expect(() =>
      normalizeAgentUpdatePublicationRecord(
        r.payload,
        f.identity.teamId,
        f.identity.teamId,
        f.periodStart,
        f.periodEnd
      )
    ).toThrow("context");
    expect(() => parseAgentUpdateRelease({ ...f.policy, kind: "updater" })).toThrow();
    expect(() => parseSolvedReportReleases(JSON.stringify([f.policy]), "synthetic")).toThrow();
    expect(() => parseAgentUpdateRelease({ ...f.policy, subdomain: "foreign" })).toThrow("binding");
  });
  it("refuses stale and future observations, including while queued", () => {
    const r = build();
    expect(() =>
      assertAgentUpdateObservationFresh(r.payload, new Date(Date.now() + 3600000))
    ).toThrow("stale");
    expect(() =>
      assertAgentUpdateObservationFresh(r.payload, new Date(Date.now() - 3600000))
    ).toThrow("future");
  });
  it("retains current-week cutoff and refuses an old cutoff relabeled with today's observation", () => {
    const f = fixture(),
      asOf = "2026-10-07T15:59:00Z";
    const source = {
      ...f.snapshot,
      events: [],
      tickets: [],
      observedAt: "2026-10-07T16:00:30Z",
      coverage: { start: "2026-10-04T00:00:00Z", endExclusive: asOf, asOf, complete: true },
    };
    const policy = { ...f.policy, effectivePeriodStart: "2026-10-04" };
    const identity = { ...f.identity, observationStartedAt: "2026-10-07T16:00:00Z" };
    const r = buildAgentUpdatePublicationRecord(
      source,
      policy,
      f.config,
      identity,
      "2026-10-04",
      "2026-10-10",
      new Date("2026-10-07T16:01:00Z")
    );
    const rows = normalizeAgentUpdatePublicationRecord(
      r.payload,
      identity.employeeId,
      identity.teamId,
      "2026-10-04",
      "2026-10-10"
    );
    expect(sharedMetricSourceContext(rows.map((r) => r.dimensionsJson))?.reportingAsOf).toBe(
      "2026-10-07T15:59:00.000Z"
    );
    expect(() =>
      buildAgentUpdatePublicationRecord(
        {
          ...source,
          coverage: {
            ...source.coverage,
            endExclusive: "2026-10-07T14:00:00Z",
            asOf: "2026-10-07T14:00:00Z",
          },
        },
        policy,
        f.config,
        identity,
        "2026-10-04",
        "2026-10-10",
        new Date("2026-10-07T16:01:00Z")
      )
    ).toThrow("stale");
    expect(() =>
      sharedMetricSourceContext([rows[0]!.dimensionsJson, rows[0]!.dimensionsJson])
    ).toThrow("one complete");
  });
});

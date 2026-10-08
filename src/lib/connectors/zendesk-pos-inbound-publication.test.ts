// @vitest-environment node
import { expect, it } from "vitest";
import { posInboundPublicationFixture } from "@/__tests__/fixtures/pos-inbound-publication";
import {
  assertPosInboundPublicationFresh,
  buildPosInboundPublication,
  normalizePosInboundPublication,
} from "./zendesk-pos-inbound-publication";
import {
  POS_INBOUND_CONTRACT,
  sharedMetricSourceContext,
  readMetricSourceContext,
} from "@/lib/domain/metrics/source-context";
import { selectPosInboundContributors } from "@/lib/domain/metrics/pos-inbound-contributors";
import {
  metricSourceDescription,
  unsupportedMetricReason,
} from "@/lib/domain/metrics/source-description";

it("normalizes released POS values with source meaning and excludes incompatible comparisons", () => {
  const f = posInboundPublicationFixture();
  const record = buildPosInboundPublication(
    f.snapshot,
    f.release,
    f.config,
    f.identity,
    f.periodStart,
    f.periodEnd
  );
  const rows = normalizePosInboundPublication(
    record.payload,
    f.identity.employeeId,
    f.identity.teamId,
    f.periodStart,
    f.periodEnd
  );
  const hold = rows.find((r) => r.factType === "avg_hold_time_inbound")!;
  expect(hold).toMatchObject({
    numericValue: 20,
    dimensionsJson: {
      sampleCount: 3,
      cohortCount: 3,
      sourceContract: POS_INBOUND_CONTRACT,
      publicationEligible: true,
    },
  });
  const context = readMetricSourceContext(hold.dimensionsJson)!;
  expect(metricSourceDescription(hold.factType, "zendesk", context)).toContain(
    "whole-call hold time, weighted once"
  );
  expect(metricSourceDescription(hold.factType, "zendesk", context)).toContain(
    "3 measured legs out of 3"
  );
  expect(unsupportedMetricReason("declined_calls", "zendesk", context)).toBeNull();
  expect(unsupportedMetricReason(hold.factType, "zendesk", context)).toContain(
    "No reported duration"
  );
  expect(() => sharedMetricSourceContext([context, context])).toThrow("one complete");
  expect(() => assertPosInboundPublicationFresh(record.payload)).not.toThrow();
  expect(() =>
    assertPosInboundPublicationFresh(record.payload, new Date(Date.now() + 3600000))
  ).toThrow("coverage");
  const tampered = structuredClone(record.payload) as { release: typeof f.release };
  tampered.release.policy.groupIds = [999];
  expect(() =>
    normalizePosInboundPublication(
      tampered,
      f.identity.employeeId,
      f.identity.teamId,
      f.periodStart,
      f.periodEnd
    )
  ).toThrow("differs");
});
it("supersedes only legacy calls, rejecting duplicate, unknown and other qualified definitions", () => {
  const next = {
    id: "new",
    dimensionsJson: { sourceContract: POS_INBOUND_CONTRACT, reportingTimeZone: "UTC" },
    recordType: "pos_inbound_report_summary",
    recordContract: POS_INBOUND_CONTRACT,
  };
  const old = {
    id: "old",
    dimensionsJson: null,
    recordType: "call_stats",
    recordContract: undefined,
  };
  expect(selectPosInboundContributors("avg_hold_time_inbound", [next, old])).toEqual({
    selected: [next],
    supersededFactIds: ["old"],
  });
  expect(() => selectPosInboundContributors("inbound_calls_offered", [next])).toThrow();
  expect(() => selectPosInboundContributors("avg_hold_time_inbound", [next, next])).toThrow();
  expect(() =>
    selectPosInboundContributors("avg_hold_time_inbound", [next, { ...old, recordType: "other" }])
  ).toThrow();
});

it("rejects current-week evidence when publication crosses into the next local week", () => {
  const f = posInboundPublicationFixture();
  const at = new Date(`${f.periodEnd}T23:59:59Z`);
  for (const state of [f.snapshot.callsState, f.snapshot.legsState]) {
    state.observationStartedAt = `${f.periodEnd}T23:59:00Z`;
    state.lastPageAt = `${f.periodEnd}T23:59:30Z`;
  }
  const record = buildPosInboundPublication(
    f.snapshot,
    f.release,
    f.config,
    f.identity,
    f.periodStart,
    f.periodEnd,
    at
  );
  expect(() => assertPosInboundPublicationFresh(record.payload, at)).not.toThrow();
  expect(() =>
    assertPosInboundPublicationFresh(record.payload, new Date(at.getTime() + 1000))
  ).toThrow("after period end");
});

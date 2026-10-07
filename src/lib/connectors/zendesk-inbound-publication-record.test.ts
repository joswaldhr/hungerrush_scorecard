// @vitest-environment node
import { expect, it } from "vitest";
import { inboundPublicationFixture } from "@/__tests__/fixtures/inbound-publication";
import {
  buildInboundPublicationRecord,
  normalizeInboundPublicationRecord,
} from "./zendesk-inbound-publication-record";
import { selectInboundContributors } from "@/lib/domain/metrics/inbound-contributors";
import {
  INBOUND_PARTICIPATION_CONTRACT,
  readMetricSourceContext,
  sharedMetricSourceContext,
} from "@/lib/domain/metrics/source-context";
import {
  metricSourceDescription,
  unsupportedMetricReason,
} from "@/lib/domain/metrics/source-description";
import { assertMetricPublicationEligible } from "@/lib/domain/metrics/publication-eligibility";
it("replays an explicit released snapshot with duration coverage and protects its policy", () => {
  const f = inboundPublicationFixture();
  const record = buildInboundPublicationRecord(
    f.snapshot,
    f.release,
    f.config,
    f.identity,
    f.periodStart,
    f.periodEnd
  );
  const normalize = (payload: unknown) =>
    normalizeInboundPublicationRecord(
      payload,
      f.identity.employeeId,
      f.identity.teamId,
      f.periodStart,
      f.periodEnd
    );
  const facts = normalize(record.payload);
  const total = facts.find((x) => x.factType === "total_talk_time_inbound")!;
  expect(total).toMatchObject({
    numericValue: 2,
    dimensionsJson: {
      sourceContract: INBOUND_PARTICIPATION_CONTRACT,
      publicationEligible: true,
      sampleCount: 3,
      cohortCount: 3,
    },
  });
  expect(() => assertMetricPublicationEligible(total.dimensionsJson)).not.toThrow();
  const context = readMetricSourceContext(total.dimensionsJson)!;
  expect(metricSourceDescription(total.factType, "zendesk", context)).toContain(
    "Sum of employee-leg talk seconds"
  );
  expect(metricSourceDescription(total.factType, "zendesk", context)).toContain(
    "3 measured legs out of 3"
  );
  expect(unsupportedMetricReason(total.factType, "zendesk", context)).toContain("complete set");
  expect(() => sharedMetricSourceContext([total.dimensionsJson, total.dimensionsJson])).toThrow(
    "one complete"
  );
  const bad = structuredClone(record.payload) as { release: typeof f.release };
  bad.release.policy.groupIds = [999];
  expect(() => normalize(bad)).toThrow("differs");
  bad.release.policy = f.release.policy;
  bad.release.releaseEvidenceSha256 = "wrong";
  expect(() => normalize(bad)).toThrow();
});
it("only supersedes exact legacy call records and never averages, unknown contracts or duplicate replacements", () => {
  const current = {
    id: "new",
    dimensionsJson: { sourceContract: INBOUND_PARTICIPATION_CONTRACT, reportingTimeZone: "UTC" },
    recordType: "inbound_participation_summary",
    recordContract: INBOUND_PARTICIPATION_CONTRACT,
  };
  const old = {
    id: "old",
    dimensionsJson: null,
    recordType: "call_stats",
    recordContract: undefined,
  };
  expect(selectInboundContributors("inbound_calls_offered", [old, current])).toEqual({
    selected: [current],
    supersededFactIds: ["old"],
  });
  expect(() => selectInboundContributors("avg_talk_time_inbound", [current])).toThrow();
  expect(() => selectInboundContributors("inbound_calls_offered", [current, current])).toThrow();
  expect(() =>
    selectInboundContributors("inbound_calls_offered", [current, { ...old, recordType: "unknown" }])
  ).toThrow();
});

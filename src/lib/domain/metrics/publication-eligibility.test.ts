import { expect, it } from "vitest";
import { assertMetricPublicationEligible } from "./publication-eligibility";

it("blocks candidate records/contracts even with a forged eligible marker", () => {
  expect(() => assertMetricPublicationEligible({}, "pos_inbound_report_candidate")).toThrow(
    "not eligible"
  );
  for (const publicationEligible of [undefined, false, true])
    expect(() =>
      assertMetricPublicationEligible({
        sourceContract: "zendesk-pos-leg-date-inbound-report-v1",
        publicationEligible,
      })
    ).toThrow("not eligible");
  expect(() => assertMetricPublicationEligible({}, "inbound_report_candidate")).toThrow(
    "not eligible"
  );
  for (const publicationEligible of [undefined, false, true])
    expect(() =>
      assertMetricPublicationEligible({
        sourceContract: "zendesk-inbound-report-v1",
        publicationEligible,
      })
    ).toThrow("not eligible");
});
it("rejects false or malformed explicit eligibility without reclassifying existing policies", () => {
  for (const publicationEligible of [false, null, "false", "true", 0, undefined])
    expect(() => assertMetricPublicationEligible({ publicationEligible })).toThrow("not eligible");
  for (const evidence of [
    null,
    {},
    { sourceContract: "zendesk-solved-current-assignee-csat-v1" },
    { publicationEligible: true },
  ])
    expect(() => assertMetricPublicationEligible(evidence)).not.toThrow();
});

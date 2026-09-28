import { describe, expect, it } from "vitest";
import { selectOutboundContributors } from "@/lib/domain/metrics/outbound-contributors";
import { OUTBOUND_PARTICIPATION_CONTRACT } from "@/lib/domain/metrics/source-context";

const replacement = {
  id: "replacement",
  recordType: "outbound_participation_summary",
  recordContract: OUTBOUND_PARTICIPATION_CONTRACT,
  dimensionsJson: {
    sourceContract: OUTBOUND_PARTICIPATION_CONTRACT,
    reportingTimeZone: "America/Chicago",
  },
};
const legacy = {
  id: "legacy",
  recordType: "call_stats",
  recordContract: undefined,
  dimensionsJson: null,
};

describe("outbound replacement source ownership", () => {
  it("supersedes the call_stats records emitted by the live connector", () => {
    expect(selectOutboundContributors("outbound_calls", [legacy, replacement])).toEqual({
      selected: [replacement],
      supersededFactIds: [legacy.id],
    });
  });

  it.each(["agent_stats", "csat_summary", "unknown"])(
    "rejects unexpected legacy record type %s",
    (recordType) => {
      expect(() =>
        selectOutboundContributors("outbound_calls", [{ ...legacy, recordType }, replacement])
      ).toThrow("unknown source contract");
    }
  );

  it("does not overwrite a call record with an explicit different contract", () => {
    expect(() =>
      selectOutboundContributors("outbound_calls", [
        { ...legacy, recordContract: "another-contract" },
        replacement,
      ])
    ).toThrow("unknown source contract");
  });

  it("leaves legacy contributors untouched when no qualified replacement exists", () => {
    expect(selectOutboundContributors("outbound_calls", [legacy])).toEqual({
      selected: [legacy],
      supersededFactIds: [],
    });
  });
});

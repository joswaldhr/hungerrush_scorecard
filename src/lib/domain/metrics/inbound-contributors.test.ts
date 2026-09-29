import { expect, it } from "vitest";
import { selectInboundContributors } from "./inbound-contributors";
import { INBOUND_PARTICIPATION_CONTRACT } from "./source-context";
const replacement = {
  id: "replacement",
  recordType: "inbound_participation_summary",
  recordContract: INBOUND_PARTICIPATION_CONTRACT,
  dimensionsJson: {
    sourceContract: INBOUND_PARTICIPATION_CONTRACT,
    reportingTimeZone: "America/Chicago",
    dateBasis: "call-created",
    offeredDefinition: "accepted-declined-missed",
  },
};
const legacy = {
  id: "legacy",
  recordType: "call_stats",
  recordContract: undefined,
  dimensionsJson: null,
};
it("retains legacy evidence and selects only one qualified inbound replacement", () => {
  expect(selectInboundContributors("inbound_calls_offered", [legacy, replacement])).toEqual({
    selected: [replacement],
    supersededFactIds: ["legacy"],
  });
  expect(selectInboundContributors("inbound_calls_offered", [legacy])).toEqual({
    selected: [legacy],
    supersededFactIds: [],
  });
  expect(() => selectInboundContributors("outbound_calls", [replacement])).toThrow(
    "Invalid inbound"
  );
  expect(() =>
    selectInboundContributors("inbound_calls_offered", [
      replacement,
      { ...replacement, id: "second" },
    ])
  ).toThrow("Invalid inbound");
});
it.each(["agent_stats", "unknown", "outbound_participation_summary"])(
  "refuses to supersede unrelated %s facts",
  (recordType) => {
    expect(() =>
      selectInboundContributors("inbound_calls_offered", [{ ...legacy, recordType }, replacement])
    ).toThrow("unknown source contract");
  }
);

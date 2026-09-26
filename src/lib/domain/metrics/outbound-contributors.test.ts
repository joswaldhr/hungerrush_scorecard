import { expect, it } from "vitest";
import { selectOutboundContributors } from "./outbound-contributors";
import { OUTBOUND_PARTICIPATION_CONTRACT, FIRST_REPLY_CONTRACT } from "./source-context";

const legacy = {
  id: "old",
  dimensionsJson: null,
  recordType: "agent_stats",
  recordContract: undefined,
};
const current = {
  id: "new",
  dimensionsJson: {
    sourceContract: OUTBOUND_PARTICIPATION_CONTRACT,
    reportingTimeZone: "America/Chicago",
  },
  recordType: "outbound_participation_summary",
  recordContract: OUTBOUND_PARTICIPATION_CONTRACT,
};
it("retains legacy contributors until an exact outbound replacement exists", () => {
  expect(selectOutboundContributors("outbound_calls", [legacy])).toEqual({
    selected: [legacy],
    supersededFactIds: [],
  });
  expect(selectOutboundContributors("outbound_calls", [legacy, current])).toEqual({
    selected: [current],
    supersededFactIds: ["old"],
  });
});
it("rejects unrelated keys, duplicate snapshots and disguised or unknown source records", () => {
  expect(() => selectOutboundContributors("backlog_count", [current])).toThrow();
  const scenarios: Parameters<typeof selectOutboundContributors>[1][] = [
    [current, current],
    [{ ...current, recordType: "agent_stats" }],
    [{ ...current, recordContract: FIRST_REPLY_CONTRACT }],
    [current, { ...legacy, recordType: "unknown" }],
    [
      current,
      {
        ...legacy,
        dimensionsJson: {
          sourceContract: FIRST_REPLY_CONTRACT,
          reportingTimeZone: "America/Chicago",
        },
      },
    ],
  ];
  for (const facts of scenarios)
    expect(() => selectOutboundContributors("outbound_calls", facts)).toThrow();
});

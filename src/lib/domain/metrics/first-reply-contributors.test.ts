import { expect, it } from "vitest";
import { selectFirstReplyContributors } from "./first-reply-contributors";
import { FIRST_REPLY_CONTRACT, SOLVED_CSAT_CONTRACT } from "./source-context";
const legacy: { id: string; dimensionsJson: unknown; recordType: string; recordContract: unknown } =
  {
    id: "old",
    dimensionsJson: null,
    recordType: "agent_stats",
    recordContract: undefined as unknown,
  };
const current = {
  id: "new",
  dimensionsJson: { sourceContract: FIRST_REPLY_CONTRACT, reportingTimeZone: "America/Chicago" },
  recordType: "first_reply_summary",
  recordContract: FIRST_REPLY_CONTRACT,
};
it("selects a complete replacement and retains explicit supersession lineage", () => {
  expect(selectFirstReplyContributors("avg_response_time", [legacy, current])).toEqual({
    selected: [current],
    supersededFactIds: ["old"],
  });
  expect(selectFirstReplyContributors("avg_response_time", [legacy])).toEqual({
    selected: [legacy],
    supersededFactIds: [],
  });
  expect(selectFirstReplyContributors("avg_response_time", [current])).toEqual({
    selected: [current],
    supersededFactIds: [],
  });
});
it("rejects multiple replacements and foreign contributors instead of silently discarding them", () => {
  for (const facts of [
    [current, { ...current, id: "duplicate" }],
    [current, { ...legacy, recordType: "unknown" }],
    [current, { ...legacy, recordContract: "future-contract" }],
    [
      current,
      {
        ...legacy,
        dimensionsJson: { sourceContract: SOLVED_CSAT_CONTRACT, reportingTimeZone: "UTC" },
      },
    ],
    [{ ...current, recordType: "agent_stats" }],
  ])
    expect(() => selectFirstReplyContributors("avg_response_time", facts)).toThrow();
  expect(() => selectFirstReplyContributors("avg_handle_time", [current])).toThrow();
});

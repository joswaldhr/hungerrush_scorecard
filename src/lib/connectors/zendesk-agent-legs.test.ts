// @vitest-environment node
import { expect, it, vi } from "vitest";
import { fetchAgentLegs, summarizeAgentLegs } from "./zendesk-agent-legs";

const leg = (id: number, agent_id = 42, completion_status = "completed", type = "agent") => ({
  id,
  call_id: 10,
  agent_id,
  completion_status,
  type,
  created_at: "2026-09-23T12:00:00Z",
  updated_at: "2026-09-23T13:00:00Z",
  talk_time: 0,
  hold_time: 0,
  duration: 5,
  forwarded_to: "private-phone",
});
const page = (legs: unknown[], next_page = "/boundary") => ({
  legs,
  count: legs.length,
  end_time: 1790168400,
  next_page,
});

it("retains agent attribution through transfers without counting customer legs", async () => {
  const get = vi
    .fn()
    .mockResolvedValue(
      page([
        leg(1),
        { ...leg(2, 84), talk_time: 60 },
        leg(3, 42, "agent_missed"),
        leg(4, 42, "agent_declined"),
        leg(5, 42, "completed", "customer"),
      ])
    );
  const cohort = await fetchAgentLegs("2026-09-23", "2026-09-23", get);
  expect(get.mock.calls[0]?.[0]).toContain("/legs.json?");
  expect(cohort.pages).toBe(2);
  expect(JSON.stringify(cohort)).not.toContain("private-phone");
  const summary = summarizeAgentLegs(cohort.legs, new Set([42, 84]));
  expect(summary.agents[0]).toMatchObject({
    completedLegs: 1,
    missedLegs: 1,
    declinedLegs: 1,
    legIds: [1, 3, 4],
    callIds: [10],
    completedLegTalkSeconds: { numerator: 0, denominator: 1 },
  });
  expect(summary.agents[1]?.completedLegTalkSeconds).toEqual({ numerator: 60, denominator: 1 });
});

it("retains latest leg corrections and leaves empty samples missing", async () => {
  const updated = { ...leg(1), updated_at: "2026-09-23T14:00:00Z", talk_time: 45 };
  const get = vi
    .fn()
    .mockResolvedValueOnce(page([leg(1)]))
    .mockResolvedValueOnce(page([updated], "/last"))
    .mockResolvedValue(page([updated], "/last"));
  const cohort = await fetchAgentLegs("2026-09-23", "2026-09-23", get);
  const summary = summarizeAgentLegs(cohort.legs, new Set([42, 99]));
  expect(summary.agents[0]?.completedLegTalkSeconds).toEqual({ numerator: 45, denominator: 1 });
  expect(summary.agents[1]?.completedLegTalkSeconds).toEqual({ numerator: null, denominator: 0 });
});

it("fails on unknown statuses rather than silently excluding observations", async () => {
  await expect(
    fetchAgentLegs("2026-09-23", "2026-09-23", async () => page([leg(1, 42, "new_status")]))
  ).rejects.toThrow();
});

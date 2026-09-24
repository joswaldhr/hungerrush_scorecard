import { z } from "zod";
import { fetchCompleteTalkWeek } from "./zendesk-talk";
import { averageEvidence } from "./source-evidence";

const duration = z.number().finite().nonnegative().nullable();
const legSchema = z.object({
  id: z.number().int().positive().safe(),
  call_id: z.number().int().positive().safe(),
  agent_id: z.number().int().safe().nullable(),
  type: z.enum(["customer", "agent", "external", "supervisor"]),
  completion_status: z.enum([
    "agent_declined",
    "agent_missed",
    "agent_unreachable",
    "agent_transfer_declined",
    "customer_hang_up",
    "completed",
  ]),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
  talk_time: duration,
  hold_time: duration,
  duration,
});
export type AgentLeg = z.output<typeof legSchema>;
const pageSchema = z.object({
  legs: z.array(legSchema),
  count: z.number().int().nonnegative(),
  end_time: z.number().int().nonnegative().safe(),
  next_page: z.string().nullable(),
});

export function parseAgentLegPage(value: unknown) {
  return pageSchema.parse(value);
}

/** Shares the verified Talk completion guard, while retaining only metric evidence fields. */
export async function fetchAgentLegs(
  periodStart: string,
  periodEnd: string,
  getPage: (path: string) => Promise<unknown>,
  pageBudget = 50
) {
  const result = await fetchCompleteTalkWeek(
    periodStart,
    periodEnd,
    async (path) => {
      const { legs, ...page } = parseAgentLegPage(await getPage(path));
      return { ...page, calls: legs };
    },
    pageBudget,
    "legs"
  );
  return { legs: result.calls, pages: result.pages };
}

// These are leg-grain observations, not replacements for call-grain target bands.
export function summarizeAgentLegs(legs: AgentLeg[], eligibleAgentIds: ReadonlySet<number>) {
  return {
    contract: "zendesk-agent-legs-v2-shadow" as const,
    agents: [...eligibleAgentIds].map((agentId) => {
      const attributed = legs.filter((leg) => leg.type === "agent" && leg.agent_id === agentId);
      const completed = attributed.filter((leg) => leg.completion_status === "completed");
      return {
        agentId,
        completedLegs: completed.length,
        missedLegs: attributed.filter((leg) => leg.completion_status === "agent_missed").length,
        declinedLegs: attributed.filter((leg) => leg.completion_status === "agent_declined").length,
        transferDeclinedLegs: attributed.filter(
          (leg) => leg.completion_status === "agent_transfer_declined"
        ).length,
        unreachableLegs: attributed.filter((leg) => leg.completion_status === "agent_unreachable")
          .length,
        completedLegTalkSeconds: averageEvidence(completed.map((leg) => leg.talk_time)),
        legIds: attributed.map((leg) => leg.id).sort((a, b) => a - b),
        callIds: [...new Set(attributed.map((leg) => leg.call_id))].sort((a, b) => a - b),
      };
    }),
  };
}

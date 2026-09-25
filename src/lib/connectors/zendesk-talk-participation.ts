import { z } from "zod";

const id = z.number().int().positive().safe();
const instant = z.iso.datetime({ offset: true });
const seconds = z.number().finite().nonnegative().nullable();
export const talkParticipationCallSchema = z.object({
  id,
  created_at: instant,
  updated_at: instant,
  direction: z.enum(["inbound", "outbound"]),
  call_group_id: id.nullable(),
  phone_number: z.string().nullable(),
  completion_status: z.enum([
    "completed",
    "abandoned_in_queue",
    "abandoned_in_ivr",
    "abandoned_in_voicemail",
    "abandoned_on_hold",
    "pending_voicemail",
    "failed",
  ]),
});
export const talkParticipationLegSchema = z.object({
  id,
  call_id: id,
  agent_id: z.number().int().nonnegative().safe().nullable(),
  type: z.enum(["agent", "supervisor", "customer", "external"]),
  completion_status: z.enum([
    "completed",
    "agent_missed",
    "agent_declined",
    "agent_transfer_declined",
    "agent_unreachable",
    "customer_hang_up",
  ]),
  created_at: instant,
  updated_at: instant,
  talk_time: seconds,
  hold_time: seconds,
  duration: seconds,
  consultation_time: seconds,
});
export type ParticipationCall = z.infer<typeof talkParticipationCallSchema>;
export type ParticipationLeg = z.infer<typeof talkParticipationLegSchema>;
const scopeSchema = z.object({
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  timeZone: z.string().min(1),
  dateBasis: z.enum(["call-created", "leg-created"]),
  agentId: id,
  groupIds: z.array(id).min(1),
  phoneNumbers: z.array(z.string().min(1)).min(1).nullable(),
});
export type TalkParticipationScope = z.infer<typeof scopeSchema>;

const sorted = (ids: Iterable<number>) => [...new Set(ids)].sort((a, b) => a - b);

function durationEvidence(legs: ParticipationLeg[], key: DurationKey) {
  const measured = legs.filter((leg) => leg[key] !== null);
  const sumSeconds = measured.reduce((sum, leg) => sum + leg[key]!, 0);
  if (!Number.isFinite(sumSeconds)) throw new Error("Talk duration sum overflow");
  return {
    cohortLegIds: sorted(legs.map((leg) => leg.id)),
    measuredLegIds: sorted(measured.map((leg) => leg.id)),
    missingLegIds: sorted(legs.filter((leg) => leg[key] === null).map((leg) => leg.id)),
    zeroLegIds: sorted(legs.filter((leg) => leg[key] === 0).map((leg) => leg.id)),
    sumSeconds,
    sampleCount: measured.length,
    meanSeconds: measured.length ? sumSeconds / measured.length : null,
  };
}
type DurationKey = "talk_time" | "hold_time" | "duration" | "consultation_time";

/**
 * Qualification candidate only; no production publisher imports this module.
 * Two inspected reports use different date bases. Keep that choice explicit.
 * Parent-call group/line scope is final routing scope, not historical agent membership.
 * A call-level abandonment or completion describes participation, not responsibility
 * or proof that an outbound customer answered. No non-answered value is inferred.
 */
export function calculateTalkParticipation(
  calls: ParticipationCall[],
  legs: ParticipationLeg[],
  input: TalkParticipationScope
) {
  const parsedScope = scopeSchema.safeParse(input);
  const parsedCalls = z.array(talkParticipationCallSchema).safeParse(calls);
  const parsedLegs = z.array(talkParticipationLegSchema).safeParse(legs);
  if (!parsedScope.success || !parsedCalls.success || !parsedLegs.success)
    throw new Error("Invalid Talk participation evidence");
  const scope = parsedScope.data;
  if (
    scope.periodStart > scope.periodEnd ||
    Date.parse(scope.periodEnd) - Date.parse(scope.periodStart) > 31 * 86400000 ||
    new Set(scope.groupIds).size !== scope.groupIds.length ||
    (scope.phoneNumbers !== null && new Set(scope.phoneNumbers).size !== scope.phoneNumbers.length)
  )
    throw new Error("Invalid Talk participation scope");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: scope.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const inPeriod = (instant: string) => {
    const parts = formatter.formatToParts(new Date(instant));
    const part = (name: string) => parts.find((p) => p.type === name)!.value;
    const day = `${part("year")}-${part("month")}-${part("day")}`;
    return day >= scope.periodStart && day <= scope.periodEnd;
  };
  const byCall = new Map<number, ParticipationCall>();
  for (const call of parsedCalls.data) {
    if (byCall.has(call.id)) throw new Error("Duplicate Talk participation call");
    if (Date.parse(call.updated_at) < Date.parse(call.created_at))
      throw new Error("Invalid Talk call chronology");
    byCall.set(call.id, call);
  }
  const seen = new Set<number>();
  const selected: ParticipationLeg[] = [];
  for (const leg of parsedLegs.data) {
    if (seen.has(leg.id)) throw new Error("Duplicate Talk participation leg");
    seen.add(leg.id);
    if (Date.parse(leg.updated_at) < Date.parse(leg.created_at))
      throw new Error("Invalid Talk leg chronology");
    if (leg.agent_id !== scope.agentId || !["agent", "supervisor"].includes(leg.type)) continue;
    if (scope.dateBasis === "leg-created" && !inPeriod(leg.created_at)) continue;
    const parent = byCall.get(leg.call_id);
    if (!parent) throw new Error("Incomplete Talk participation parent-call coverage");
    if (scope.dateBasis === "call-created" && !inPeriod(parent.created_at)) continue;
    if (parent.call_group_id === null || !scope.groupIds.includes(parent.call_group_id)) continue;
    if (
      scope.phoneNumbers !== null &&
      (parent.phone_number === null || !scope.phoneNumbers.includes(parent.phone_number))
    )
      continue;
    selected.push(leg);
  }
  const summarize = (direction: "inbound" | "outbound") => {
    const participating = selected.filter(
      (leg) => byCall.get(leg.call_id)!.direction === direction
    );
    const agentLegs = participating.filter((leg) => leg.type === "agent");
    const accepted = agentLegs.filter(
      (leg) => leg.completion_status === "completed" && leg.talk_time !== null && leg.talk_time > 0
    );
    const missed = agentLegs.filter((leg) => leg.completion_status === "agent_missed");
    const declined = agentLegs.filter((leg) =>
      ["agent_declined", "agent_transfer_declined"].includes(leg.completion_status)
    );
    const reportOffered = [...accepted, ...missed, ...declined];
    const offeredIds = new Set(reportOffered.map((leg) => leg.id));
    // Matches the inspected POS leg-duration denominator. Menufy SUM/MAX report
    // fields are comparisons only; they are not renamed as averages.
    const durationLegs = participating.filter(
      (leg) => leg.completion_status !== "agent_unreachable"
    );
    const callIds = sorted(participating.map((leg) => leg.call_id));
    return {
      selectedLegIds: sorted(participating.map((leg) => leg.id)),
      participatingCallIds: callIds,
      agentLegIds: sorted(agentLegs.map((leg) => leg.id)),
      supervisorLegIds: sorted(
        participating.filter((leg) => leg.type === "supervisor").map((leg) => leg.id)
      ),
      acceptedLegIds: sorted(accepted.map((leg) => leg.id)),
      missedLegIds: sorted(missed.map((leg) => leg.id)),
      declinedLegIds: sorted(declined.map((leg) => leg.id)),
      unreachableLegIds: sorted(
        agentLegs
          .filter((leg) => leg.completion_status === "agent_unreachable")
          .map((leg) => leg.id)
      ),
      // This is the report's subtotal, NOT every offer/attempt in routing data.
      reportOfferedLegIds: sorted(offeredIds),
      otherAgentLegIds: sorted(
        agentLegs.filter((leg) => !offeredIds.has(leg.id)).map((leg) => leg.id)
      ),
      abandonedOnHoldParticipatingCallIds: callIds.filter(
        (key) => byCall.get(key)!.completion_status === "abandoned_on_hold"
      ),
      completedParticipatingCallIds: callIds.filter(
        (key) => byCall.get(key)!.completion_status === "completed"
      ),
      failedParticipatingCallIds: callIds.filter(
        (key) => byCall.get(key)!.completion_status === "failed"
      ),
      durations: {
        talk: durationEvidence(durationLegs, "talk_time"),
        hold: durationEvidence(durationLegs, "hold_time"),
        duration: durationEvidence(durationLegs, "duration"),
        consultation: durationEvidence(durationLegs, "consultation_time"),
      },
    };
  };
  return {
    contract: "zendesk-talk-participation-candidate-v1" as const,
    dateBasis: scope.dateBasis,
    inbound: summarize("inbound"),
    outbound: summarize("outbound"),
  };
}

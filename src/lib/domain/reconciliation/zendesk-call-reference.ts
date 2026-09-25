/** Offline diagnostic only: no production connector or aggregation imports. */
export interface ReferenceCall {
  id: number;
  created_at: string;
  direction: string;
  call_group_id: number | null;
  phone_number: string | null;
  completion_status: string;
}

export interface ReferenceLeg {
  id: number;
  call_id: number;
  agent_id: number | null;
  type: string;
  completion_status: string;
  talk_time: number | null;
  hold_time: number | null;
}

export interface CallReferenceScope {
  startDay: string;
  endDay: string;
  timeZone: string;
  groupIds: number[] | null;
  phoneNumbers: string[] | null;
  agentId: number;
}

/**
 * Matches the inspected inbound Explore report, not an approved scorecard contract.
 * Caller must prove the call population AND all related legs are complete. A joined
 * abandoned call describes participation, not responsibility for the abandonment.
 */
export function referenceInboundCalls(
  calls: ReferenceCall[],
  legs: ReferenceLeg[],
  scope: CallReferenceScope
) {
  for (const day of [scope.startDay, scope.endDay]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Invalid call reference day");
    const date = new Date(`${day}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day)
      throw new Error("Invalid call reference day");
  }
  if (scope.startDay > scope.endDay) throw new Error("Reversed call reference period");
  if (!Number.isSafeInteger(scope.agentId) || scope.agentId <= 0)
    throw new Error("Invalid reference agent ID");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: scope.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const byCall = new Map<number, ReferenceCall>();
  const cohort = new Set<number>();
  for (const call of calls) {
    if (!Number.isSafeInteger(call.id) || call.id <= 0 || byCall.has(call.id))
      throw new Error("Invalid or duplicate call ID");
    byCall.set(call.id, call);
    if (
      !["inbound", "outbound"].includes(call.direction) ||
      (call.call_group_id !== null &&
        (!Number.isSafeInteger(call.call_group_id) || call.call_group_id <= 0)) ||
      (call.phone_number !== null && typeof call.phone_number !== "string") ||
      typeof call.completion_status !== "string"
    )
      throw new Error("Invalid call scope fields");
    if (
      !/(Z|[+-]\d{2}:\d{2})$/.test(call.created_at) ||
      !Number.isFinite(Date.parse(call.created_at))
    )
      throw new Error("Invalid call timestamp");
    const parts = formatter.formatToParts(new Date(call.created_at));
    const part = (name: string) => parts.find((p) => p.type === name)!.value;
    const day = `${part("year")}-${part("month")}-${part("day")}`;
    if (
      day >= scope.startDay &&
      day <= scope.endDay &&
      call.direction === "inbound" &&
      (scope.groupIds === null ||
        (call.call_group_id !== null && scope.groupIds.includes(call.call_group_id))) &&
      (scope.phoneNumbers === null ||
        (call.phone_number !== null && scope.phoneNumbers.includes(call.phone_number)))
    )
      cohort.add(call.id);
  }
  const seen = new Set<number>();
  const accepted: number[] = [],
    missed: number[] = [],
    declined: number[] = [];
  const participating = new Set<number>(),
    abandoned = new Set<number>();
  const selected: number[] = [];
  let talkSeconds = 0,
    measuredTalk = 0,
    maxHoldSeconds: number | null = null;
  let missingTalk = 0,
    missingHold = 0;
  for (const leg of legs) {
    if (!Number.isSafeInteger(leg.id) || leg.id <= 0 || seen.has(leg.id))
      throw new Error("Invalid or duplicate leg ID");
    seen.add(leg.id);
    if (!Number.isSafeInteger(leg.call_id) || leg.call_id <= 0)
      throw new Error("Invalid leg call ID");
    // The report groups by leg agent for all measures. Only its built-in
    // accepted/missed/declined metrics also restrict Leg type = Agent.
    if (leg.agent_id !== scope.agentId) continue;
    if (!byCall.has(leg.call_id)) throw new Error("Incomplete call join for agent legs");
    if (!cohort.has(leg.call_id)) continue;
    if (
      leg.type === "agent" &&
      ![
        "completed",
        "agent_missed",
        "agent_declined",
        "agent_transfer_declined",
        "agent_unreachable",
        "customer_hang_up",
      ].includes(leg.completion_status)
    )
      throw new Error("Unknown agent leg status");
    for (const duration of [leg.talk_time, leg.hold_time])
      if (
        duration !== null &&
        (typeof duration !== "number" || !Number.isFinite(duration) || duration < 0)
      )
        throw new Error("Invalid leg duration");
    selected.push(leg.id);
    participating.add(leg.call_id);
    if (
      leg.type === "agent" &&
      leg.completion_status === "completed" &&
      leg.talk_time !== null &&
      leg.talk_time > 0
    )
      accepted.push(leg.id);
    if (leg.type === "agent" && leg.completion_status === "agent_missed") missed.push(leg.id);
    if (
      leg.type === "agent" &&
      ["agent_declined", "agent_transfer_declined"].includes(leg.completion_status)
    )
      declined.push(leg.id);
    if (byCall.get(leg.call_id)!.completion_status === "abandoned_on_hold")
      abandoned.add(leg.call_id);
    if (leg.talk_time === null) missingTalk++;
    else {
      talkSeconds += leg.talk_time;
      measuredTalk++;
    }
    if (leg.hold_time === null) missingHold++;
    else maxHoldSeconds = Math.max(maxHoldSeconds ?? 0, leg.hold_time);
  }
  const sorted = (values: Iterable<number>) => [...values].sort((a, b) => a - b);
  return {
    selectedLegIds: sorted(selected),
    acceptedLegIds: sorted(accepted),
    declinedLegIds: sorted(declined),
    missedLegIds: sorted(missed),
    participatingCallIds: sorted(participating),
    abandonedParticipatingCallIds: sorted(abandoned),
    accepted: accepted.length,
    missed: missed.length,
    declined: declined.length,
    offered: accepted.length + missed.length + declined.length,
    talkSeconds: measuredTalk ? talkSeconds : null,
    maxHoldSeconds,
    missingTalk,
    missingHold,
  };
}

/** Offline reference for an inspected POS report. Never a publication definition. */
import type { CallReferenceScope, ReferenceCall, ReferenceLeg } from "./zendesk-call-reference";

export interface PosReferenceCall extends ReferenceCall {
  hold_time: number | null;
}

export interface PosReferenceLeg extends ReferenceLeg {
  created_at: string;
  duration: number | null;
  consultation_time: number | null;
}

function durationSummary(values: Array<number | null>) {
  const measured = values.filter((value): value is number => value !== null);
  if (measured.some((value) => !Number.isFinite(value) || value < 0))
    throw new Error("Invalid POS reference duration");
  const numerator = measured.reduce((sum, value) => sum + value, 0);
  return {
    numerator,
    denominator: measured.length,
    missing: values.length - measured.length,
    meanSeconds: measured.length ? numerator / measured.length : null,
  };
}

/**
 * Reproduces the inspected report's LEG-date cohort and its known semantic defects.
 * Caller must prove complete legs, parent calls, report agent selection and group-ID
 * bindings. Current user identity is not historical employment eligibility.
 */
export function referencePosInboundReport(
  calls: PosReferenceCall[],
  legs: PosReferenceLeg[],
  scope: CallReferenceScope
) {
  for (const day of [scope.startDay, scope.endDay]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Invalid POS reference day");
    const date = new Date(`${day}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day)
      throw new Error("Invalid POS reference day");
  }
  if (scope.startDay > scope.endDay) throw new Error("Reversed POS reference interval");
  if (!Number.isSafeInteger(scope.agentId) || scope.agentId <= 0)
    throw new Error("Invalid POS reference agent");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: scope.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const byCall = new Map<number, PosReferenceCall>();
  for (const call of calls) {
    if (!Number.isSafeInteger(call.id) || call.id <= 0 || byCall.has(call.id))
      throw new Error("Invalid or duplicate POS reference call");
    byCall.set(call.id, call);
  }
  const seen = new Set<number>();
  const selected: PosReferenceLeg[] = [];
  for (const leg of legs) {
    if (!Number.isSafeInteger(leg.id) || leg.id <= 0 || seen.has(leg.id))
      throw new Error("Invalid or duplicate POS reference leg");
    seen.add(leg.id);
    if (leg.agent_id !== scope.agentId) continue;
    if (
      !/(Z|[+-]\d{2}:\d{2})$/.test(leg.created_at) ||
      !Number.isFinite(Date.parse(leg.created_at))
    )
      throw new Error("Invalid POS reference leg timestamp");
    const parts = formatter.formatToParts(new Date(leg.created_at));
    const part = (type: string) => parts.find((p) => p.type === type)!.value;
    const day = `${part("year")}-${part("month")}-${part("day")}`;
    if (day < scope.startDay || day > scope.endDay) continue;
    const parent = byCall.get(leg.call_id);
    if (!parent) throw new Error("Incomplete POS reference parent-call join");
    if (!["inbound", "outbound"].includes(parent.direction))
      throw new Error("Unknown POS reference call direction");
    if (parent.direction !== "inbound") continue;
    if (
      scope.groupIds !== null &&
      (parent.call_group_id === null || !scope.groupIds.includes(parent.call_group_id))
    )
      continue;
    if (
      scope.phoneNumbers !== null &&
      (parent.phone_number === null || !scope.phoneNumbers.includes(parent.phone_number))
    )
      continue;
    // Explore's displayed Agent type includes supervisor participation in this dataset.
    if (!["agent", "supervisor"].includes(leg.type)) continue;
    if (
      ![
        "completed",
        "agent_missed",
        "agent_declined",
        "agent_transfer_declined",
        "agent_unreachable",
        "customer_hang_up",
      ].includes(leg.completion_status)
    )
      throw new Error("Unknown POS reference leg status");
    if (leg.completion_status === "agent_unreachable") continue;
    selected.push(leg);
  }
  const ordered = (ids: Iterable<number>) => [...new Set(ids)].sort((a, b) => a - b);
  const participatingCallIds = ordered(selected.map((leg) => leg.call_id));
  const acceptedLegIds = ordered(
    selected
      .filter(
        (leg) =>
          leg.type === "agent" &&
          leg.completion_status === "completed" &&
          leg.talk_time !== null &&
          leg.talk_time > 0
      )
      .map((leg) => leg.id)
  );
  const declinedLegIds = ordered(
    selected
      .filter(
        (leg) =>
          leg.type === "agent" &&
          ["agent_declined", "agent_transfer_declined"].includes(leg.completion_status)
      )
      .map((leg) => leg.id)
  );
  const missedLegIds = ordered(
    selected
      .filter((leg) => leg.type === "agent" && leg.completion_status === "agent_missed")
      .map((leg) => leg.id)
  );
  // The live report is mislabeled "on-hold". Expose the actual formula explicitly.
  const reportIvrQueueVoicemailAbandonedCallIds = participatingCallIds.filter((id) =>
    ["abandoned_in_ivr", "abandoned_in_queue", "abandoned_in_voicemail"].includes(
      byCall.get(id)!.completion_status
    )
  );
  const actualOnHoldParticipatingCallIds = participatingCallIds.filter(
    (id) => byCall.get(id)!.completion_status === "abandoned_on_hold"
  );
  return {
    selectedLegIds: ordered(selected.map((leg) => leg.id)),
    participatingCallIds,
    acceptedLegIds,
    declinedLegIds,
    missedLegIds,
    reportIvrQueueVoicemailAbandonedCallIds,
    actualOnHoldParticipatingCallIds,
    talk: durationSummary(selected.map((leg) => leg.talk_time)),
    // Whole-call hold is intentionally repeated once per joined leg for report parity.
    callHoldWeightedByLeg: durationSummary(
      selected.map((leg) => byCall.get(leg.call_id)!.hold_time)
    ),
    legHold: durationSummary(selected.map((leg) => leg.hold_time)),
    duration: durationSummary(selected.map((leg) => leg.duration)),
    consultation: durationSummary(selected.map((leg) => leg.consultation_time)),
  };
}

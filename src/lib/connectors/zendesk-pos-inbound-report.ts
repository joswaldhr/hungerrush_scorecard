import { z } from "zod";
import {
  talkParticipationCallSchema,
  talkParticipationLegSchema,
} from "./zendesk-talk-participation";

// Only the call fields used by this report are required. The durable POS projection
// retains these plus outbound-specific fields, which are irrelevant to this calculation.
export const posInboundCallSchema = talkParticipationCallSchema.extend({
  hold_time: z.number().finite().nonnegative().nullable(),
});

export const POS_INBOUND_REPORT_CONTRACT = "zendesk-pos-leg-date-inbound-report-v1";
export const posInboundReportKeys = [
  "inbound_calls_accepted",
  "declined_calls",
  "missed_calls",
  "avg_talk_time_inbound",
  "avg_hold_time_inbound",
  "avg_call_duration_inbound",
  "avg_consultation_time_inbound",
] as const;

const ids = z
  .array(z.number().int().positive().safe())
  .min(1)
  .max(100)
  .refine((values) => new Set(values).size === values.length);
export const posInboundScopeSchema = z
  .object({
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    timeZone: z.string().min(1),
    agentId: z.number().int().positive().safe(),
    groupIds: ids,
    phoneNumbers: z
      .array(
        z
          .string()
          .min(1)
          .max(100)
          .refine((value) => value.trim() === value)
      )
      .min(1)
      .max(100)
      .refine((values) => new Set(values).size === values.length)
      .nullable(),
    dateBasis: z.literal("leg-created"),
  })
  .strict();
export type PosInboundScope = z.infer<typeof posInboundScopeSchema>;
const sorted = (values: Iterable<number>) => [...new Set(values)].sort((a, b) => a - b);

/** POS's saved leg-date report, independent of the offline reconciliation reference.
 * No caller publishes this candidate. Offered calls and the mislabeled abandonment
 * report require separate contracts; neither is inferred from these seven measures.
 * Group/line scope describes the observed parent, not historical team membership.
 */
export function calculatePosInboundReport(calls: unknown, legs: unknown, input: PosInboundScope) {
  return preparePosInboundReport(calls, legs)(input);
}

/** Validate and index one immutable source capture once for an entire team. */
export function preparePosInboundReport(calls: unknown, legs: unknown) {
  const parsedCalls = z.array(posInboundCallSchema).safeParse(calls);
  const parsedLegs = z.array(talkParticipationLegSchema).safeParse(legs);
  if (!parsedCalls.success || !parsedLegs.success)
    throw Error("Invalid POS inbound source evidence");
  const sourceCalls = parsedCalls.data;
  const sourceLegs = parsedLegs.data;
  const byCall = new Map<number, z.infer<typeof posInboundCallSchema>>();
  for (const call of sourceCalls) {
    if (byCall.has(call.id)) throw Error("Duplicate POS inbound call");
    if (Date.parse(call.updated_at) < Date.parse(call.created_at))
      throw Error("Invalid POS inbound call chronology");
    byCall.set(call.id, call);
  }
  const seen = new Set<number>();
  const byAgent = new Map<number, z.infer<typeof talkParticipationLegSchema>[]>();
  for (const leg of sourceLegs) {
    if (seen.has(leg.id)) throw Error("Duplicate POS inbound leg");
    seen.add(leg.id);
    if (Date.parse(leg.updated_at) < Date.parse(leg.created_at))
      throw Error("Invalid POS inbound leg chronology");
    if (leg.agent_id === null) continue;
    const group = byAgent.get(leg.agent_id) ?? [];
    group.push(leg);
    byAgent.set(leg.agent_id, group);
  }
  return (input: PosInboundScope) => {
    const scope = posInboundScopeSchema.parse(input);
    if (
      scope.periodStart > scope.periodEnd ||
      Date.parse(scope.periodEnd) - Date.parse(scope.periodStart) > 31 * 86400000
    )
      throw Error("Invalid POS inbound interval");
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: scope.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const inPeriod = (instant: string) => {
      const parts = formatter.formatToParts(new Date(instant));
      const part = (key: string) => parts.find((p) => p.type === key)!.value;
      const day = `${part("year")}-${part("month")}-${part("day")}`;
      return day >= scope.periodStart && day <= scope.periodEnd;
    };
    const selected: z.infer<typeof talkParticipationLegSchema>[] = [];
    for (const leg of byAgent.get(scope.agentId) ?? []) {
      if (
        !inPeriod(leg.created_at) ||
        !["agent", "supervisor"].includes(leg.type) ||
        leg.completion_status === "agent_unreachable"
      )
        continue;
      const call = byCall.get(leg.call_id);
      if (!call) throw Error("Incomplete POS inbound parent-call coverage");
      if (
        call.direction !== "inbound" ||
        call.call_group_id === null ||
        !scope.groupIds.includes(call.call_group_id) ||
        (scope.phoneNumbers !== null &&
          (call.phone_number === null || !scope.phoneNumbers.includes(call.phone_number)))
      )
        continue;
      selected.push(leg);
    }
    const accepted = selected.filter(
      (l) =>
        l.type === "agent" &&
        l.completion_status === "completed" &&
        l.talk_time !== null &&
        l.talk_time > 0
    );
    const uncertainAccepted = selected.filter(
      (l) => l.type === "agent" && l.completion_status === "completed" && l.talk_time === null
    );
    const declined = selected.filter(
      (l) =>
        l.type === "agent" &&
        ["agent_declined", "agent_transfer_declined"].includes(l.completion_status)
    );
    const missed = selected.filter(
      (l) => l.type === "agent" && l.completion_status === "agent_missed"
    );
    const duration = (get: (leg: (typeof selected)[number]) => number | null) => {
      const measured = selected.filter((l) => get(l) !== null);
      const sumSeconds = measured.reduce((sum, l) => sum + get(l)!, 0);
      if (!Number.isFinite(sumSeconds)) throw Error("POS inbound duration overflow");
      return {
        sumSeconds,
        sampleCount: measured.length,
        cohortCount: selected.length,
        meanSeconds: measured.length ? sumSeconds / measured.length : null,
        measuredLegIds: sorted(measured.map((l) => l.id)),
        missingLegIds: sorted(selected.filter((l) => get(l) === null).map((l) => l.id)),
        zeroLegIds: sorted(selected.filter((l) => get(l) === 0).map((l) => l.id)),
      };
    };
    const talk = duration((l) => l.talk_time);
    // This is the saved report's whole-call hold, weighted once per selected leg.
    // It must not be labeled employee-leg hold or deduplicated by parent call.
    const callHoldWeightedByLeg = duration((l) => byCall.get(l.call_id)!.hold_time);
    const totalDuration = duration((l) => l.duration);
    const consultation = duration((l) => l.consultation_time);
    return {
      scope,
      sourceContract: POS_INBOUND_REPORT_CONTRACT,
      selectedLegIds: sorted(selected.map((l) => l.id)),
      participatingCallIds: sorted(selected.map((l) => l.call_id)),
      acceptedLegIds: sorted(accepted.map((l) => l.id)),
      uncertainAcceptedLegIds: sorted(uncertainAccepted.map((l) => l.id)),
      declinedLegIds: sorted(declined.map((l) => l.id)),
      missedLegIds: sorted(missed.map((l) => l.id)),
      durations: { talk, callHoldWeightedByLeg, duration: totalDuration, consultation },
      values: {
        inbound_calls_accepted: uncertainAccepted.length ? null : accepted.length,
        declined_calls: declined.length,
        missed_calls: missed.length,
        avg_talk_time_inbound: talk.meanSeconds,
        avg_hold_time_inbound: callHoldWeightedByLeg.meanSeconds,
        avg_call_duration_inbound: totalDuration.meanSeconds,
        avg_consultation_time_inbound: consultation.meanSeconds,
      },
    };
  };
}

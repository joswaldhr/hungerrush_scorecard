import { z } from "zod";
import { sevenDayPeriodEnd } from "@/lib/domain/metrics/effective-dates";
import {
  talkParticipationCallSchema,
  talkParticipationLegSchema,
} from "./zendesk-talk-participation";

export const INBOUND_REPORT_CONTRACT = "zendesk-inbound-report-v1";
export const inboundReportKeys = [
  "inbound_calls_offered",
  "inbound_calls_accepted",
  "declined_calls",
  "missed_calls",
  "inbound_calls_unreachable",
  "inbound_calls_answer_rate",
  "inbound_calls_abandoned_on_hold",
  "total_talk_time_inbound",
  "max_hold_time_inbound",
] as const;

const ids = z
  .array(z.number().int().positive().safe())
  .min(1)
  .max(100)
  .refine((v) => new Set(v).size === v.length);
export const inboundReportScopeSchema = z
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
      .refine((v) => new Set(v).size === v.length),
    dateBasis: z.literal("call-created"),
    offeredDefinition: z.literal("accepted-declined-missed-unreachable"),
  })
  .strict();
export type InboundReportScope = z.infer<typeof inboundReportScopeSchema>;
const sorted = (values: Iterable<number>) => [...new Set(values)].sort((a, b) => a - b);

/** Inactive Menufy report contract. No source reads, writes, target decisions or averages. */
export function calculateInboundReport(calls: unknown, legs: unknown, input: InboundReportScope) {
  const scope = inboundReportScopeSchema.parse(input);
  if (
    new Date(`${scope.periodStart}T00:00:00Z`).getUTCDay() !== 0 ||
    scope.periodEnd !== sevenDayPeriodEnd(scope.periodStart)
  )
    throw Error("Inbound report requires a Sunday–Saturday interval");
  const sourceCalls = z.array(talkParticipationCallSchema).parse(calls);
  const sourceLegs = z.array(talkParticipationLegSchema).parse(legs);
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
  const byCall = new Map<number, z.infer<typeof talkParticipationCallSchema>>();
  for (const call of sourceCalls) {
    if (byCall.has(call.id)) throw Error("Duplicate inbound call");
    if (Date.parse(call.updated_at) < Date.parse(call.created_at))
      throw Error("Invalid inbound call chronology");
    byCall.set(call.id, call);
  }
  const selected: z.infer<typeof talkParticipationLegSchema>[] = [];
  const seen = new Set<number>();
  for (const leg of sourceLegs) {
    if (seen.has(leg.id)) throw Error("Duplicate inbound leg");
    seen.add(leg.id);
    if (Date.parse(leg.updated_at) < Date.parse(leg.created_at))
      throw Error("Invalid inbound leg chronology");
    if (leg.agent_id !== scope.agentId) continue;
    const parent = byCall.get(leg.call_id);
    if (!parent) throw Error("Incomplete inbound parent-call coverage");
    if (
      parent.direction !== "inbound" ||
      !inPeriod(parent.created_at) ||
      parent.call_group_id === null ||
      !scope.groupIds.includes(parent.call_group_id) ||
      parent.phone_number === null ||
      !scope.phoneNumbers.includes(parent.phone_number)
    )
      continue;
    // The strict leg schema allowlists exactly the six viewer-selected statuses.
    // Built-in offered components restrict Agent legs; SUM/MAX group by leg agent.
    selected.push(leg);
  }
  const agents = selected.filter((leg) => leg.type === "agent");
  const accepted = agents.filter(
    (leg) => leg.completion_status === "completed" && leg.talk_time !== null && leg.talk_time > 0
  );
  const declined = agents.filter((leg) =>
    ["agent_declined", "agent_transfer_declined"].includes(leg.completion_status)
  );
  const missed = agents.filter((leg) => leg.completion_status === "agent_missed");
  const unreachable = agents.filter((leg) => leg.completion_status === "agent_unreachable");
  const offered = [...accepted, ...declined, ...missed, ...unreachable];
  const uncertainAccepted = agents.filter(
    (leg) => leg.completion_status === "completed" && leg.talk_time === null
  );
  const participatingCallIds = sorted(selected.map((leg) => leg.call_id));
  const abandonedCallIds = participatingCallIds.filter(
    (id) => byCall.get(id)!.completion_status === "abandoned_on_hold"
  );
  const duration = (field: "talk_time" | "hold_time") => {
    const measured = selected.filter((leg) => leg[field] !== null);
    const sumSeconds = measured.reduce((sum, leg) => sum + leg[field]!, 0);
    if (!Number.isFinite(sumSeconds)) throw Error("Inbound duration overflow");
    const missingLegIds = sorted(
      selected.filter((leg) => leg[field] === null).map((leg) => leg.id)
    );
    return {
      sumSeconds,
      maxSeconds: measured.length
        ? measured.reduce((max, leg) => Math.max(max, leg[field]!), 0)
        : null,
      sampleCount: measured.length,
      measuredLegIds: sorted(measured.map((leg) => leg.id)),
      missingLegIds,
      complete: missingLegIds.length === 0 && measured.length > 0,
    };
  };
  const talk = duration("talk_time"),
    hold = duration("hold_time");
  return {
    scope,
    selectedLegIds: sorted(selected.map((leg) => leg.id)),
    participatingCallIds,
    acceptedLegIds: sorted(accepted.map((leg) => leg.id)),
    declinedLegIds: sorted(declined.map((leg) => leg.id)),
    missedLegIds: sorted(missed.map((leg) => leg.id)),
    unreachableLegIds: sorted(unreachable.map((leg) => leg.id)),
    offeredLegIds: sorted(offered.map((leg) => leg.id)),
    abandonedCallIds,
    uncertainAcceptedLegIds: sorted(uncertainAccepted.map((leg) => leg.id)),
    talk,
    hold,
    values: {
      inbound_calls_offered: uncertainAccepted.length ? null : offered.length,
      inbound_calls_accepted: uncertainAccepted.length ? null : accepted.length,
      declined_calls: declined.length,
      missed_calls: missed.length,
      inbound_calls_unreachable: unreachable.length,
      inbound_calls_answer_rate:
        uncertainAccepted.length || !offered.length
          ? null
          : (100 * accepted.length) / offered.length,
      inbound_calls_abandoned_on_hold: abandonedCallIds.length,
      total_talk_time_inbound: talk.complete ? talk.sumSeconds : null,
      max_hold_time_inbound: hold.complete ? hold.maxSeconds : null,
    },
  };
}

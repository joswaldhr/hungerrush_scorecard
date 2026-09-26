import { z } from "zod";
import { isZendeskAccountReference } from "./zendesk-account-binding";
import {
  calculateTalkParticipation,
  type TalkParticipationScope,
} from "./zendesk-talk-participation";
import type { readTalkCollectionSnapshot } from "./zendesk-talk-store";

export type TalkCollectionSnapshot = NonNullable<
  Awaited<ReturnType<typeof readTalkCollectionSnapshot>>["snapshot"]
>;
export interface TalkObservationLimits {
  /** Explicit release policy, not inferred from a scheduler or an observation's age. */
  maxAgeMs: number;
  maxSpanMs: number;
}

/** Shared call/leg observation checks; exhaustion alone does not authorize publication. */
export function validateTalkObservation(
  snapshot: TalkCollectionSnapshot,
  expectedAccountReference: string,
  scope: Pick<TalkParticipationScope, "periodStart" | "periodEnd" | "timeZone">,
  limits: TalkObservationLimits,
  now = new Date()
) {
  const interval = z
    .object({ periodStart: z.iso.date(), periodEnd: z.iso.date(), timeZone: z.string().min(1) })
    .safeParse(scope);
  if (
    !interval.success ||
    scope.periodStart > scope.periodEnd ||
    Date.parse(scope.periodEnd) - Date.parse(scope.periodStart) > 31 * 86400000
  )
    throw Error("Invalid Talk reporting interval");
  if (
    !isZendeskAccountReference(expectedAccountReference) ||
    snapshot.accountReference !== expectedAccountReference
  )
    throw Error("Talk observation account mismatch");
  if (
    !Number.isFinite(now.getTime()) ||
    !Number.isSafeInteger(limits.maxAgeMs) ||
    limits.maxAgeMs < 1 ||
    limits.maxAgeMs > 26 * 3600000 ||
    !Number.isSafeInteger(limits.maxSpanMs) ||
    limits.maxSpanMs < 1 ||
    limits.maxSpanMs > 3600000
  )
    throw Error("Invalid Talk observation limits");
  const states = [snapshot.callsState, snapshot.legsState];
  const starts: number[] = [],
    ends: number[] = [];
  for (const [index, state] of states.entries()) {
    if (
      state.accountReference !== expectedAccountReference ||
      state.bootstrapStart !== snapshot.bootstrapStart ||
      state.cursor.resource !== (index === 0 ? "calls" : "legs") ||
      state.cursor.status !== "exhausted" ||
      state.lastPageAt === null
    )
      throw Error("Talk observation requires both exhausted, account-bound streams");
    const start = Date.parse(state.observationStartedAt),
      end = Date.parse(state.lastPageAt);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start > end ||
      end > now.getTime() ||
      !Number.isSafeInteger(state.cursor.watermark) ||
      state.cursor.watermark * 1000 > end
    )
      throw Error("Invalid Talk observation chronology");
    starts.push(start);
    ends.push(end);
  }
  const observationStarted = Math.min(...starts),
    observationEnded = Math.max(...ends);
  if (now.getTime() - Math.min(...ends) > limits.maxAgeMs)
    throw Error("Talk observation is stale under the configured policy");
  if (observationEnded - observationStarted > limits.maxSpanMs)
    throw Error("Talk streams span too wide an observation window; collect a new overlap cycle");
  for (const [index, rows] of [snapshot.calls, snapshot.legs].entries())
    if (
      rows.some(
        (row) =>
          !Number.isFinite(Date.parse(row.updated_at)) || Date.parse(row.updated_at) > ends[index]!
      )
    )
      throw Error("Talk source record is newer than its observation");
  // A full UTC-day pad covers supported local-date boundaries without guessing an offset.
  const requiredBootstrap = Date.parse(`${scope.periodStart}T00:00:00Z`) - 86400000;
  if (
    !Number.isSafeInteger(snapshot.bootstrapStart) ||
    snapshot.bootstrapStart < 0 ||
    !Number.isFinite(requiredBootstrap) ||
    snapshot.bootstrapStart * 1000 > requiredBootstrap
  )
    throw Error("Talk bootstrap does not cover the reporting interval");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: scope.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(Math.min(...ends)));
  const part = (key: string) => parts.find((p) => p.type === key)!.value;
  const observedDay = `${part("year")}-${part("month")}-${part("day")}`;
  if (scope.periodStart > observedDay)
    throw Error("Talk reporting interval has not been observed yet");
  return {
    accountReference: expectedAccountReference,
    observationStartedAt: new Date(observationStarted).toISOString(),
    observationEndedAt: new Date(observationEnded).toISOString(),
    bootstrapStart: snapshot.bootstrapStart,
    callWatermark: snapshot.callsState.cursor.watermark,
    legWatermark: snapshot.legsState.cursor.watermark,
    callCycle: snapshot.callsState.cycle,
    legCycle: snapshot.legsState.cycle,
    sourceIsAtomicSnapshot: false as const,
    independentMetricQualificationComplete: false as const,
  };
}

/** Prepare a candidate employee calculation; independent qualification/publication are separate gates. */
export function prepareTalkParticipationObservation(
  snapshot: TalkCollectionSnapshot,
  expectedAccountReference: string,
  scope: TalkParticipationScope,
  limits: TalkObservationLimits,
  now = new Date()
) {
  const provenance = validateTalkObservation(
    snapshot,
    expectedAccountReference,
    scope,
    limits,
    now
  );
  // Never resolve a parent gap by dropping its leg. The calculator rejects affected employees.
  const result = calculateTalkParticipation(snapshot.calls, snapshot.legs, scope);
  return { result, provenance };
}

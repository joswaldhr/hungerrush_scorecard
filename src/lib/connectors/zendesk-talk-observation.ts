import { isZendeskAccountReference } from "./zendesk-account-binding";
import {
  calculateTalkParticipation,
  type TalkParticipationScope,
} from "./zendesk-talk-participation";
import type { readTalkCollectionSnapshot } from "./zendesk-talk-store";

type Snapshot = NonNullable<Awaited<ReturnType<typeof readTalkCollectionSnapshot>>["snapshot"]>;
export interface TalkObservationLimits {
  /** Explicit release policy, not inferred from a scheduler or an observation's age. */
  maxAgeMs: number;
  maxSpanMs: number;
}

/** Prepare a candidate employee calculation; independent qualification/publication are separate gates. */
export function prepareTalkParticipationObservation(
  snapshot: Snapshot,
  expectedAccountReference: string,
  scope: TalkParticipationScope,
  limits: TalkObservationLimits,
  now = new Date()
) {
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
  // A full UTC-day pad covers supported local-date boundaries without guessing an offset.
  const requiredBootstrap = Date.parse(`${scope.periodStart}T00:00:00Z`) - 86400000;
  if (
    !Number.isSafeInteger(snapshot.bootstrapStart) ||
    snapshot.bootstrapStart < 0 ||
    !Number.isFinite(requiredBootstrap) ||
    snapshot.bootstrapStart * 1000 > requiredBootstrap
  )
    throw Error("Talk bootstrap does not cover the reporting interval");
  // A reported parent gap is never resolved by dropping the orphan leg. The calculator
  // decides whether it affects this employee and throws before returning their numbers.
  const result = calculateTalkParticipation(snapshot.calls, snapshot.legs, scope);
  return {
    result,
    provenance: {
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
    },
  };
}

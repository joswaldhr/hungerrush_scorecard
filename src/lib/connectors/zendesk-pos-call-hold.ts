import { z } from "zod";
import { outboundCallSchema } from "./zendesk-outbound";

// A separate projection. Never re-hash existing participation records as enriched versions.
export const posCallHoldSchema = outboundCallSchema.extend({
  hold_time: z.number().finite().nonnegative().nullable(),
});
export type PosCallWithHold = z.infer<typeof posCallHoldSchema>;

/** Offline exact-version join only. Its caller must independently prove account,
 * observation, paging, group, employee and historical scope before calculation.
 * Missing/newer versions are blocked; null hold is a real unavailable measurement.
 * No store, route or publisher invokes this candidate.
 */
export function joinPosCallHoldEvidence(participation: unknown[], wholeCalls: unknown[]) {
  const base = z.array(outboundCallSchema).parse(participation);
  const projected = z.array(posCallHoldSchema).parse(wholeCalls);
  if (
    new Set(base.map((call) => call.id)).size !== base.length ||
    new Set(projected.map((call) => call.id)).size !== projected.length
  )
    throw Error("Duplicate POS hold projection call");
  const byId = new Map(projected.map((call) => [call.id, call]));
  const calls: PosCallWithHold[] = [];
  const blocked: Array<{ callId: number; reason: "missing" | "version-mismatch" }> = [];
  for (const call of base) {
    const hold = byId.get(call.id);
    if (!hold) {
      blocked.push({ callId: call.id, reason: "missing" });
      continue;
    }
    if (hold.updated_at !== call.updated_at) {
      blocked.push({ callId: call.id, reason: "version-mismatch" });
      continue;
    }
    const common = outboundCallSchema.parse(hold);
    if (JSON.stringify(common) !== JSON.stringify(call))
      throw Error("Conflicting equal-version POS call projections");
    calls.push(hold);
  }
  return { calls, blocked };
}

import { z } from "zod";

const actorId = z.number().int().positive().safe();
const batchSchema = z.object({
  users: z.array(z.object({ id: actorId, role: z.enum(["agent", "admin", "end-user"]) })),
});

/** Current role evidence only. Missing accounts never imply end-user, deletion or automation. */
export function inspectActionActorBatch(requestedIds: readonly number[], response: unknown) {
  const requested = z.array(actorId).min(1).max(100).parse(requestedIds);
  if (new Set(requested).size !== requested.length) throw new Error("Duplicate actor request");
  const { users } = batchSchema.parse(response);
  const requestedSet = new Set(requested);
  const received = new Set(users.map((user) => user.id));
  const counts = {
    requested: requested.length,
    returned: users.length,
    missing: requested.filter((id) => !received.has(id)).length,
    duplicate: users.length - received.size,
    unexpected: [...received].filter((id) => !requestedSet.has(id)).length,
  };
  const status =
    counts.duplicate || counts.unexpected
      ? ("inconsistent" as const)
      : counts.missing
        ? ("incomplete" as const)
        : ("complete" as const);
  // No eligible set is supplied on a partial response, preventing plausible partial totals.
  return {
    status,
    counts,
    eligibleActorIds:
      status === "complete"
        ? new Set(users.filter((user) => user.role !== "end-user").map((user) => user.id))
        : null,
  };
}

export class ActionActorLookupError extends Error {
  constructor(readonly counts: ReturnType<typeof inspectActionActorBatch>["counts"]) {
    super("Actor lookup incomplete or inconsistent");
    this.name = "ActionActorLookupError";
  }
}

import { reportJobStateSchema, type ReportJobDefinition } from "./zendesk-report-jobs";

export type ReportJobHealth = {
  status:
    | "waiting"
    | "queued"
    | "running"
    | "deferred"
    | "failed"
    | "interrupted"
    | "complete"
    | "unknown";
  label: string;
  lastAttemptAt: string | null;
  retryAt: string | null;
};

/** Queue completion is operational evidence, never metric certification or observation freshness. */
export function reportJobHealth(
  request: { definition: ReportJobDefinition; desiredAt: string },
  payload: unknown,
  accountReference: string,
  now: number
): ReportJobHealth {
  const result = (
    status: ReportJobHealth["status"],
    label: string,
    lastAttemptAt: string | null = null,
    retryAt: string | null = null
  ): ReportJobHealth => ({ status, label, lastAttemptAt, retryAt });
  if (!Number.isFinite(now) || !Number.isFinite(Date.parse(request.desiredAt)))
    return result("unknown", "Status unavailable");
  if (payload === undefined) return result("waiting", "Awaiting scheduler");
  const parsed = reportJobStateSchema.safeParse(payload);
  if (!parsed.success || !Number.isFinite(now)) return result("unknown", "Status unavailable");
  const state = parsed.data;
  if (
    state.accountReference !== accountReference ||
    state.definition.kind !== request.definition.kind ||
    state.definition.policyHash !== request.definition.policyHash ||
    (state.definition.kind !== "collection" &&
      request.definition.kind !== "collection" &&
      (state.definition.periodStart !== request.definition.periodStart ||
        state.definition.periodEnd !== request.definition.periodEnd))
  )
    return result("unknown", "Status unavailable");
  if (state.lease)
    return Date.parse(state.lease.expiresAt) > now
      ? result("running", "Running", state.lastAttemptAt)
      : result("interrupted", "Interrupted; awaiting retry", state.lastAttemptAt);
  if (
    state.completedThrough &&
    Date.parse(state.completedThrough) >=
      Math.max(Date.parse(request.desiredAt), Date.parse(state.desiredAt))
  )
    return result("complete", "Request completed", state.lastAttemptAt);
  if (state.lastOutcome === "failed")
    return result("failed", "Failed; retry pending", state.lastAttemptAt, state.notBefore);
  if (state.lastOutcome === "interrupted" || state.lastOutcome === "running")
    return result(
      "interrupted",
      "Interrupted; awaiting retry",
      state.lastAttemptAt,
      state.notBefore
    );
  if (Date.parse(state.notBefore) > now)
    return result("deferred", "Deferred until retry", state.lastAttemptAt, state.notBefore);
  return result("queued", "Refresh pending", state.lastAttemptAt);
}

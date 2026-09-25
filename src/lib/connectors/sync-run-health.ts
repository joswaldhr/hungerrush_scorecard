/** Read-only operational state; publication success does not certify metric semantics. */
export function syncRunHealth(
  run: { status: string; startedAt: Date; metadataJson?: unknown } | null,
  now: number
): { status: string; label: string; explanation: string | null } {
  if (!run) return { status: "never", label: "Never synced", explanation: null };
  if (run.status === "running") {
    const metadata =
      run.metadataJson && typeof run.metadataJson === "object"
        ? (run.metadataJson as Record<string, unknown>)
        : {};
    // Match the publisher's ten-minute legacy lease fallback. No row is changed
    // here; takeover remains the responsibility of the transactional lease owner.
    const expiry =
      metadata.leaseExpiresAt === undefined
        ? run.startedAt.getTime() + 10 * 60_000
        : typeof metadata.leaseExpiresAt === "string"
          ? Date.parse(metadata.leaseExpiresAt)
          : NaN;
    if (!Number.isFinite(expiry) || !Number.isFinite(now))
      return {
        status: "unknown",
        label: "Unknown",
        explanation: "Sync lease information is unavailable.",
      };
    if (expiry <= now)
      return {
        status: "lease_expired",
        label: "Interrupted",
        explanation:
          "The sync lease expired before completion. A new sync can reclaim the expired work.",
      };
    return { status: "running", label: "Syncing", explanation: null };
  }
  const label = new Map([
    ["completed", "Published"],
    ["failed", "Failed"],
    ["skipped", "Skipped"],
  ]).get(run.status);
  return { status: label ? run.status : "unknown", label: label ?? "Unknown", explanation: null };
}

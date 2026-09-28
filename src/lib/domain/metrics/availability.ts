/** September 24 release policy: ticket activity must have verified human attribution.
 * The active Zendesk publisher has no source-bound human review evidence yet. Neither
 * a stored "complete" flag nor increasing the calculation version can establish it.
 * Remove this containment only with the validated human-only publication path.
 */
export function requiresTicketAttributionVerification(definition: {
  key: string;
  sourceStrategy: string | null;
}) {
  return (
    definition.sourceStrategy === "zendesk" &&
    ["tickets_updated", "tickets_resolved"].includes(definition.key)
  );
}

export const TICKET_ATTRIBUTION_QUALITY = "unverified_attribution";
export const TICKET_ATTRIBUTION_REASON = "Human activity attribution has not been verified.";
export const HISTORICAL_TARGET_REASON = "Historical target context has not been verified.";

export const HANDLE_TIME_REASON =
  "Active handling time is unavailable; the current source measures full resolution time.";

/** Read containment only: preserve the stored observation and its revisions. */
export function metricReadRestriction(definition: { key: string; sourceStrategy: string | null }) {
  if (requiresTicketAttributionVerification(definition))
    return {
      quality: TICKET_ATTRIBUTION_QUALITY,
      reason: TICKET_ATTRIBUTION_REASON,
      withholdTarget: false,
    };
  if (definition.sourceStrategy === "zendesk" && definition.key === "avg_handle_time")
    return { quality: "unsupported", reason: HANDLE_TIME_REASON, withholdTarget: true };
  return null;
}

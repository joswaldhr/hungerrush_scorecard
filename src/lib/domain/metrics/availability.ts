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

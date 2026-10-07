/** Candidate evidence is useful for reconciliation, but cannot enter manager values. */
export function assertMetricPublicationEligible(evidence: unknown, recordType?: string) {
  const row =
    evidence !== null && typeof evidence === "object" ? (evidence as Record<string, unknown>) : {};
  // Block the candidate contract even if a caller strips or changes its marker.
  // Activation requires a reviewed code change; no environment toggle bypasses this.
  if (
    recordType === "inbound_report_candidate" ||
    recordType === "ticket_report_credit_candidate" ||
    row.sourceContract === "zendesk-inbound-report-v1" ||
    row.sourceContract === "zendesk-updater-report-credits-v1" ||
    row.sourceContract === "zendesk-assignee-solved-report-v1" ||
    ("publicationEligible" in row && row.publicationEligible !== true)
  )
    throw new Error("Unqualified metric evidence is not eligible for publication");
}

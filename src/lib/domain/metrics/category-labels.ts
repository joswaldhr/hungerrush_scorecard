// Maps a metricDefinition.category value to a display heading for the 1:1
// scorecard. New categories (call metrics, status/time, etc.) get a readable
// label automatically via the fallback -- nothing here needs to change when
// new metric definitions are added under an existing or new category key.
const CATEGORY_LABELS: Record<string, string> = {
  ticket_case_work: "Ticket/Case Work Metrics",
  status_time: "Status/Time Metrics",
  inbound_call: "Inbound Call Metrics",
  outbound_call: "Outbound Call Metrics",
  overall_performance: "Overall Performance KPIs",
};

export function formatCategoryLabel(category: string | null): string {
  if (!category) return "Other Metrics";
  if (CATEGORY_LABELS[category]) return CATEGORY_LABELS[category];
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

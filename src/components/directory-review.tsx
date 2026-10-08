import type { DirectoryReview as Review } from "@/lib/domain/roster/directory-check";

const labels = {
  disabled: "Microsoft account disabled — confirm team membership",
  not_found: "No exact directory match — check identity mapping",
  ambiguous: "Ambiguous directory match — check identity mapping",
  missing_email: "Work email missing — directory check unavailable",
  not_checked: "Not checked for this identity",
};
const healthLabels = {
  not_configured: "Directory checks are not configured.",
  unavailable: "Directory check status is unavailable. Retry later or contact an administrator.",
  not_checked: "Awaiting the first directory check.",
  failed: "Latest check failed. Any results below are from the previous observation.",
  running: "A directory check is running. Any results below are from the previous observation.",
  interrupted:
    "The directory check was interrupted. Any results below are from the previous observation.",
  stale: "Directory observations are over 36 hours old and need refreshing.",
  current: "Latest directory check completed.",
};

export function DirectoryReview({ review }: { review: Review }) {
  return (
    <section
      aria-labelledby="directory-review-title"
      className="space-y-3 rounded-lg border border-border p-4"
    >
      <h2 id="directory-review-title" className="text-sm font-semibold">
        Directory roster review
      </h2>
      <p className="text-sm text-muted-foreground">{healthLabels[review.health]}</p>
      {review.observedAt && (
        <p className="text-xs text-muted-foreground">
          Observed {new Date(review.observedAt).toISOString().replace("T", " ").slice(0, 19)} UTC ·{" "}
          {review.checked} of {review.total} current employee identities checked
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Microsoft account access is a review signal, not proof of employment or current team
        membership. Confirm discrepancies with the manager or HR. This check never archives
        employees or changes assignments.
      </p>
      {review.rows.length > 0 && (
        <ul className="divide-y divide-border">
          {review.rows.map((row) => (
            <li key={row.employeeId} className="py-2 text-sm">
              <span className="font-medium">{row.name}</span>
              <p className="text-muted-foreground">{labels[row.status]}</p>
            </li>
          ))}
        </ul>
      )}
      {review.health === "current" &&
        review.total > 0 &&
        review.checked === review.total &&
        !review.rows.length && (
          <p className="text-sm">No directory account conflicts found in this observation.</p>
        )}
    </section>
  );
}

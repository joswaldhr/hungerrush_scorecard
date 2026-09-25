const routes = new Set([
  "/",
  "/login",
  "/one-on-ones",
  "/data-health",
  "/reconciliation",
  "/admin",
  "/admin/employees",
  "/admin/teams",
  "/admin/metric-visibility",
  "/admin/roster-review",
  "/one-on-ones/[id]",
  "/one-on-ones/[id]/history",
  "/admin/employees/[id]",
]);

function routeTemplate(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  try {
    const path = new URL(value, "https://cadence.invalid").pathname;
    if (routes.has(path)) return path;
    if (/^\/one-on-ones\/[^/]+\/history$/.test(path)) return "/one-on-ones/[id]/history";
    if (/^\/one-on-ones\/[^/]+$/.test(path)) return "/one-on-ones/[id]";
    if (/^\/admin\/employees\/[^/]+$/.test(path)) return "/admin/employees/[id]";
  } catch {
    /* Malformed locations never become log text. */
  }
  return "unknown";
}

/** Only bounded diagnostic categories cross the browser/reporting boundary. */
export function clientErrorReport(input: {
  digest?: unknown;
  boundary?: unknown;
  url?: unknown;
  route?: unknown;
}) {
  return {
    boundary: ["global", "application", "scorecard"].includes(String(input.boundary))
      ? String(input.boundary)
      : "application",
    route: routeTemplate(input.route ?? input.url),
    ...(typeof input.digest === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(input.digest)
      ? { digest: input.digest }
      : {}),
  };
}

import type { EmployeeMetricRow } from "./queries";

// Pure and dependency-free (no db import) so it's safe to use from a client
// component -- extracted out of briefings/generate.ts, which pulls in the db
// client at module scope and can't be imported into "use client" code.
export function deriveOverallStatus(
  metrics: EmployeeMetricRow[]
): "on_track" | "mixed" | "needs_attention" | "no_data" {
  if (metrics.length === 0) return "on_track";
  if (metrics.every((m) => m.status.status === "no_data")) return "no_data";

  const withTargets = metrics.filter(
    (m) => m.status.status !== "no_target" && m.status.status !== "no_data"
  );
  if (withTargets.length === 0) return "on_track";

  const offTarget = withTargets.filter((m) => m.status.status === "off_target").length;
  const onTarget = withTargets.filter((m) => m.status.status === "on_target").length;

  if (offTarget >= 2 || offTarget > withTargets.length / 2) return "needs_attention";
  if (onTarget === withTargets.length) return "on_track";
  return "mixed";
}

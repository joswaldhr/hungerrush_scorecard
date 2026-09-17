export interface VisibilityOverrideCandidate {
  scope: "global_default" | "manager_override" | "scorecard_override";
  managerUserId: string | null;
  targetEmployeeId: string | null;
  teamId: string | null;
  line: string | null;
  hidden: boolean;
}

/**
 * Resolves whether a metric row is hidden, given every visibility override
 * row for that one metric definition. Precedence: scorecard (this employee)
 * -> manager (any manager who owns this employee) -> global default -> shown.
 * Within a scope, a team- and/or line-specific override wins over a blanket
 * one -- teamId disambiguates "POS only" from "everywhere" (POS employees
 * always have line = null, same as an unscoped row, so line alone can't tell
 * the two apart).
 */
export function resolveVisibility(
  candidates: VisibilityOverrideCandidate[],
  employeeId: string,
  managerUserIds: string[],
  teamId: string,
  line: string | null
): boolean {
  const pickAtScope = (
    scope: VisibilityOverrideCandidate["scope"],
    matches: (c: VisibilityOverrideCandidate) => boolean
  ): VisibilityOverrideCandidate | null => {
    const atScope = candidates.filter(
      (c) =>
        c.scope === scope &&
        matches(c) &&
        (c.teamId === null || c.teamId === teamId) &&
        (c.line === null || c.line === line)
    );
    if (atScope.length === 0) return null;

    // Most specific wins: a team- and/or line-specific row outranks a
    // blanket one at the same scope. (Every row reaching this point already
    // has teamId/line either null or matching -- the filter above excludes
    // any mismatch outright.)
    const specificity = (c: VisibilityOverrideCandidate) =>
      (c.teamId !== null ? 2 : 0) + (c.line !== null ? 1 : 0);
    return atScope.reduce((best, c) => (specificity(c) > specificity(best) ? c : best));
  };

  const scorecard = pickAtScope("scorecard_override", (c) => c.targetEmployeeId === employeeId);
  if (scorecard) return scorecard.hidden;

  const manager = pickAtScope(
    "manager_override",
    (c) => c.managerUserId !== null && managerUserIds.includes(c.managerUserId)
  );
  if (manager) return manager.hidden;

  const global = pickAtScope("global_default", () => true);
  if (global) return global.hidden;

  return false; // no override found anywhere -- visible by default
}

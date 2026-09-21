// Pure form logic for the metric-visibility admin editor, kept in its own
// dependency-free module (not visibility-editor.tsx itself) so it can be
// unit-tested without pulling in "./actions" (a "use server" file with real
// DB/next-auth dependencies that don't resolve outside the Next.js runtime).

export type Scope = "scorecard_override" | "manager_override" | "global_default";
export type BrandTop = "menufy" | "pos" | "both";
export type BrandSecond = "restaurant" | "consumer" | "both" | "all";

/**
 * Which team/line rows a bulk visibility change actually writes to -- the
 * highest-risk logic in this editor (a wrong mapping silently hides/shows a
 * metric for the wrong team or line).
 */
export function buildTeamLinePairs(
  brandTop: BrandTop | "",
  brandSecond: BrandSecond | "",
  menufyTeamId: string,
  posTeamId: string
): { teamId: string; line: string | null }[] {
  const pairs: { teamId: string; line: string | null }[] = [];
  if (brandTop === "menufy" || brandTop === "both") {
    if (brandSecond === "both") {
      pairs.push({ teamId: menufyTeamId, line: "restaurant" });
      pairs.push({ teamId: menufyTeamId, line: "consumer" });
    } else if (brandSecond === "all") {
      // A line-agnostic override: also covers any employee whose line
      // hasn't been tagged yet (e.g. a fresh cross-team transfer), which
      // neither "restaurant", "consumer", nor "both" (which writes those
      // two explicit lines, not a line=null row) can reach.
      pairs.push({ teamId: menufyTeamId, line: null });
    } else if (brandSecond) {
      pairs.push({ teamId: menufyTeamId, line: brandSecond });
    }
  }
  if (brandTop === "pos" || brandTop === "both") {
    pairs.push({ teamId: posTeamId, line: null });
  }
  return pairs;
}

export function isValidVisibilitySelection(input: {
  metricDefinitionId: string;
  brandTop: BrandTop | "";
  brandSecond: BrandSecond | "";
  scope: Scope;
  targetEmployeeId: string;
  managerUserId: string;
}): boolean {
  const needsSecondTier = input.brandTop === "menufy" || input.brandTop === "both";
  return (
    input.metricDefinitionId !== "" &&
    input.brandTop !== "" &&
    (!needsSecondTier || input.brandSecond !== "") &&
    (input.scope !== "scorecard_override" || input.targetEmployeeId !== "") &&
    (input.scope !== "manager_override" || input.managerUserId !== "")
  );
}

import type { ResolvedTarget, TargetType, MetricStatus, Direction } from "./types";

interface TargetCandidate {
  targetValue: number | null;
  warningValue: number | null;
  targetMin: number | null;
  targetMax: number | null;
  targetType: string;
  priority: number;
  employeeId: string | null;
  roleKey: string | null;
  teamId: string | null;
  line: string | null;
}

function hasValidTargetBounds(
  target: Pick<
    TargetCandidate,
    "targetType" | "targetValue" | "warningValue" | "targetMin" | "targetMax"
  >
): boolean {
  if (target.targetType === "range") {
    return (
      target.targetMin !== null &&
      target.targetMax !== null &&
      Number.isFinite(target.targetMin) &&
      Number.isFinite(target.targetMax) &&
      target.targetMin <= target.targetMax
    );
  }
  if (!["minimum", "maximum", "exact"].includes(target.targetType)) return false;
  return (
    target.targetValue !== null &&
    Number.isFinite(target.targetValue) &&
    (target.warningValue === null ||
      (Number.isFinite(target.warningValue) &&
        (target.targetType !== "exact" || target.warningValue >= 0)))
  );
}

export function resolveTarget(
  candidates: TargetCandidate[],
  employeeId: string,
  roleKey: string | null,
  teamId: string | null,
  line: string | null
): ResolvedTarget | null {
  if (candidates.length === 0) return null;

  const scored = candidates.map((c) => ({
    ...c,
    score: scoreCandidate(c, employeeId, roleKey, teamId, line),
  }));

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return b.priority - a.priority;
  });

  const best = scored[0];
  if (!best || best.score < 0) return null;
  // An invalid specific rule must not silently fall back to a broader judgment.
  if (!hasValidTargetBounds(best)) return null;
  // Equal-precedence conflicting rules have no justified winner. Returning no
  // target is safer than a database-order-dependent performance judgment.
  const tied = scored.filter(
    (candidate) => candidate.score === best.score && candidate.priority === best.priority
  );
  if (
    tied.some(
      (candidate) =>
        candidate.targetType !== best.targetType ||
        candidate.targetValue !== best.targetValue ||
        candidate.warningValue !== best.warningValue ||
        candidate.targetMin !== best.targetMin ||
        candidate.targetMax !== best.targetMax
    )
  )
    return null;

  return {
    targetValue: best.targetValue,
    warningValue: best.warningValue,
    targetMin: best.targetMin,
    targetMax: best.targetMax,
    targetType: best.targetType as TargetType,
    source: categorizeSource(best, employeeId, roleKey, teamId),
    priority: best.priority,
  };
}

function scoreCandidate(
  c: TargetCandidate,
  employeeId: string,
  roleKey: string | null,
  teamId: string | null,
  line: string | null
): number {
  // A target scoped to a specific line never applies to a lookup for a
  // different (or no) line -- disqualify outright rather than let it win on
  // employee/team/org specificity alone.
  if (c.line !== null && c.line !== line) return -1;
  // Among otherwise-equal candidates, a line-specific match beats a
  // line-blanket one (e.g. a Menufy Restaurant-specific team target beats a
  // Menufy-wide team target for a Restaurant-line employee).
  const lineBonus = c.line !== null && c.line === line ? 1 : 0;

  // Employee-specific: highest priority
  if (c.employeeId === employeeId) return 40 + lineBonus;
  // Role-specific within the team
  if (c.roleKey && c.roleKey === roleKey && c.teamId === teamId) return 30 + lineBonus;
  // Team-level default
  if (c.teamId === teamId && !c.employeeId && !c.roleKey) return 20 + lineBonus;
  // Org-level default (no team, no employee, no role)
  if (!c.teamId && !c.employeeId && !c.roleKey) return 10 + lineBonus;
  return -1;
}

function categorizeSource(
  c: TargetCandidate,
  employeeId: string,
  roleKey: string | null,
  teamId: string | null
): "employee" | "role" | "team" | "org" {
  if (c.employeeId === employeeId) return "employee";
  if (c.roleKey && c.roleKey === roleKey && c.teamId === teamId) return "role";
  if (c.teamId === teamId) return "team";
  return "org";
}

export function evaluateStatus(
  value: number | null,
  target: ResolvedTarget | null,
  direction: Direction
): MetricStatus {
  if (value === null || !Number.isFinite(value)) return { status: "no_data", direction };
  if (!target || !hasValidTargetBounds(target)) return { status: "no_target", direction };

  const { targetValue, warningValue, targetType, targetMin, targetMax } = target;

  // Range targets (e.g. Tickets Solved, IB/OB Calls): on target only strictly
  // within [min, max] -- below min is under-volume, above max is flagged too
  // (possible overload/anomaly), not treated as "exceeding expectations".
  // No warning tier: the source data has no separate warning bounds for ranges.
  if (targetType === "range") {
    if (targetMin === null || targetMax === null) return { status: "no_target", direction };
    if (value < targetMin || value > targetMax) return { status: "off_target", direction };
    return { status: "on_target", direction };
  }

  if (targetValue === null) return { status: "no_target", direction };

  if (targetType === "exact") {
    // Equality-based: how close value is to the target, not which side it's
    // on -- direction-agnostic, unlike minimum/maximum below. warningValue
    // (if set) is an allowed tolerance band around the exact target.
    const diff = Math.abs(value - targetValue);
    if (diff === 0) return { status: "on_target", direction };
    if (warningValue !== null && diff <= warningValue) return { status: "warning", direction };
    return { status: "off_target", direction };
  }

  if (targetType === "minimum") {
    // "minimum" is a literal floor under higher_is_better (value >= target
    // is good). Under lower_is_better it's used to express a ceiling via
    // inversion instead (e.g. hold-time targets: "at most 120s") -- this
    // inverted usage is already live and must keep working. There's no
    // well-defined "good side" for a neutral (informational) metric, so
    // don't guess one.
    if (direction === "neutral") return { status: "no_target", direction };
    const passes = direction === "higher_is_better" ? value >= targetValue : value <= targetValue;
    if (passes) return { status: "on_target", direction };
    const warningPasses =
      warningValue !== null &&
      (direction === "higher_is_better" ? value >= warningValue : value <= warningValue);
    if (warningPasses) return { status: "warning", direction };
    return { status: "off_target", direction };
  }

  if (targetType === "maximum") {
    // Symmetric with "minimum" above: a literal ceiling under
    // lower_is_better, inverted to a floor under higher_is_better. Same
    // no-good-side reasoning applies to neutral.
    if (direction === "neutral") return { status: "no_target", direction };
    const passes = direction === "lower_is_better" ? value <= targetValue : value >= targetValue;
    if (passes) return { status: "on_target", direction };
    const warningPasses =
      warningValue !== null &&
      (direction === "lower_is_better" ? value <= warningValue : value >= warningValue);
    if (warningPasses) return { status: "warning", direction };
    return { status: "off_target", direction };
  }

  return { status: "no_target", direction };
}

/**
 * Evaluate status from period-over-period percentage change (used for team-level summaries
 * where no absolute target exists).
 */
export function evaluateChangeStatus(
  changePct: number | null,
  direction: Direction
): { status: "on_target" | "warning" | "off_target" | "no_data"; isImproved: boolean } {
  if (changePct === null || !Number.isFinite(changePct))
    return { status: "no_data", isImproved: false };

  const isImproved =
    (direction === "higher_is_better" && changePct > 0) ||
    (direction === "lower_is_better" && changePct < 0);

  if (Math.abs(changePct) < 1) return { status: "on_target", isImproved };
  if (isImproved) return { status: "on_target", isImproved };
  if (Math.abs(changePct) >= 10) return { status: "off_target", isImproved };
  return { status: "warning", isImproved };
}

import type { ResolvedTarget, TargetType, MetricStatus, Direction } from "./types";

interface TargetCandidate {
  targetValue: number;
  warningValue: number | null;
  targetType: string;
  priority: number;
  employeeId: string | null;
  roleKey: string | null;
  teamId: string | null;
}

export function resolveTarget(
  candidates: TargetCandidate[],
  employeeId: string,
  roleKey: string | null,
  teamId: string | null
): ResolvedTarget | null {
  if (candidates.length === 0) return null;

  const scored = candidates.map((c) => ({
    ...c,
    score: scoreCandidate(c, employeeId, roleKey, teamId),
  }));

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return b.priority - a.priority;
  });

  const best = scored[0];
  if (!best || best.score < 0) return null;

  return {
    targetValue: best.targetValue,
    warningValue: best.warningValue,
    targetType: best.targetType as TargetType,
    source: categorizeSource(best, employeeId, roleKey, teamId),
    priority: best.priority,
  };
}

function scoreCandidate(
  c: TargetCandidate,
  employeeId: string,
  roleKey: string | null,
  teamId: string | null
): number {
  // Employee-specific: highest priority
  if (c.employeeId === employeeId) return 40;
  // Role-specific within the team
  if (c.roleKey && c.roleKey === roleKey && c.teamId === teamId) return 30;
  // Team-level default
  if (c.teamId === teamId && !c.employeeId && !c.roleKey) return 20;
  // Org-level default (no team, no employee, no role)
  if (!c.teamId && !c.employeeId && !c.roleKey) return 10;
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
  if (value === null) return { status: "no_data", direction };
  if (!target) return { status: "no_target", direction };

  const { targetValue, warningValue, targetType } = target;

  if (targetType === "minimum" || targetType === "exact") {
    if (direction === "higher_is_better") {
      if (value >= targetValue) return { status: "on_target", direction };
      if (warningValue !== null && value >= warningValue) return { status: "warning", direction };
      return { status: "off_target", direction };
    }
    // lower_is_better with minimum target: value at or below target is good
    if (value <= targetValue) return { status: "on_target", direction };
    if (warningValue !== null && value <= warningValue) return { status: "warning", direction };
    return { status: "off_target", direction };
  }

  if (targetType === "maximum") {
    if (direction === "lower_is_better") {
      if (value <= targetValue) return { status: "on_target", direction };
      if (warningValue !== null && value <= warningValue) return { status: "warning", direction };
      return { status: "off_target", direction };
    }
    if (value <= targetValue) return { status: "on_target", direction };
    if (warningValue !== null && value <= warningValue) return { status: "warning", direction };
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
  if (changePct === null) return { status: "no_data", isImproved: false };

  const isImproved =
    (direction === "higher_is_better" && changePct > 0) ||
    (direction === "lower_is_better" && changePct < 0);

  if (Math.abs(changePct) < 1) return { status: "on_target", isImproved };
  if (isImproved) return { status: "on_target", isImproved };
  if (Math.abs(changePct) >= 10) return { status: "off_target", isImproved };
  return { status: "warning", isImproved };
}

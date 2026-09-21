// Pure-logic unit tests for the highest-risk part of the metric-visibility
// admin UI -- which team/line rows a bulk hide/show actually writes to, and
// whether the form is complete enough to submit. No rendering needed; this
// repo has no component-testing infrastructure (see FOLLOWUPS.md), so these
// two functions were pulled out of VisibilityEditor specifically to be
// testable without one.

import { describe, it, expect } from "vitest";
import {
  buildTeamLinePairs,
  isValidVisibilitySelection,
} from "@/app/(app)/admin/metric-visibility/visibility-logic";

const MENUFY_TEAM_ID = "team-menufy";
const POS_TEAM_ID = "team-pos";

describe("buildTeamLinePairs", () => {
  it("returns nothing when no brand is selected", () => {
    expect(buildTeamLinePairs("", "", MENUFY_TEAM_ID, POS_TEAM_ID)).toEqual([]);
  });

  it("writes a single POS row with no line", () => {
    expect(buildTeamLinePairs("pos", "", MENUFY_TEAM_ID, POS_TEAM_ID)).toEqual([
      { teamId: POS_TEAM_ID, line: null },
    ]);
  });

  it("writes a single Menufy row for one selected line", () => {
    expect(buildTeamLinePairs("menufy", "restaurant", MENUFY_TEAM_ID, POS_TEAM_ID)).toEqual([
      { teamId: MENUFY_TEAM_ID, line: "restaurant" },
    ]);
  });

  it("'both' lines writes two explicit rows, not a line=null row", () => {
    expect(buildTeamLinePairs("menufy", "both", MENUFY_TEAM_ID, POS_TEAM_ID)).toEqual([
      { teamId: MENUFY_TEAM_ID, line: "restaurant" },
      { teamId: MENUFY_TEAM_ID, line: "consumer" },
    ]);
  });

  it("'all' lines writes one line-agnostic row (fixed 2026-09-21 -- the gap that left untagged/transferred Menufy employees uncovered by any team-wide hide)", () => {
    expect(buildTeamLinePairs("menufy", "all", MENUFY_TEAM_ID, POS_TEAM_ID)).toEqual([
      { teamId: MENUFY_TEAM_ID, line: null },
    ]);
  });

  it("brandTop 'both' writes Menufy (per the selected line) and POS together", () => {
    expect(buildTeamLinePairs("both", "consumer", MENUFY_TEAM_ID, POS_TEAM_ID)).toEqual([
      { teamId: MENUFY_TEAM_ID, line: "consumer" },
      { teamId: POS_TEAM_ID, line: null },
    ]);
  });

  it("brandTop 'both' with 'all' lines writes the line-agnostic Menufy row plus POS", () => {
    expect(buildTeamLinePairs("both", "all", MENUFY_TEAM_ID, POS_TEAM_ID)).toEqual([
      { teamId: MENUFY_TEAM_ID, line: null },
      { teamId: POS_TEAM_ID, line: null },
    ]);
  });

  it("Menufy with no line selected yet writes nothing (form incomplete)", () => {
    expect(buildTeamLinePairs("menufy", "", MENUFY_TEAM_ID, POS_TEAM_ID)).toEqual([]);
  });
});

describe("isValidVisibilitySelection", () => {
  const base = {
    metricDefinitionId: "metric-1",
    brandTop: "pos" as const,
    brandSecond: "" as const,
    scope: "global_default" as const,
    targetEmployeeId: "",
    managerUserId: "",
  };

  it("is valid once a metric and brand are picked for a global default", () => {
    expect(isValidVisibilitySelection(base)).toBe(true);
  });

  it("is invalid with no metric selected", () => {
    expect(isValidVisibilitySelection({ ...base, metricDefinitionId: "" })).toBe(false);
  });

  it("is invalid with no brand selected", () => {
    expect(isValidVisibilitySelection({ ...base, brandTop: "" })).toBe(false);
  });

  it("requires a Menufy line once brandTop is menufy or both", () => {
    expect(isValidVisibilitySelection({ ...base, brandTop: "menufy", brandSecond: "" })).toBe(
      false
    );
    expect(
      isValidVisibilitySelection({ ...base, brandTop: "menufy", brandSecond: "restaurant" })
    ).toBe(true);
  });

  it("does not require a line for POS-only", () => {
    expect(isValidVisibilitySelection({ ...base, brandTop: "pos", brandSecond: "" })).toBe(true);
  });

  it("requires a target employee for a scorecard_override", () => {
    expect(
      isValidVisibilitySelection({ ...base, scope: "scorecard_override", targetEmployeeId: "" })
    ).toBe(false);
    expect(
      isValidVisibilitySelection({
        ...base,
        scope: "scorecard_override",
        targetEmployeeId: "emp-1",
      })
    ).toBe(true);
  });

  it("requires a manager for a manager_override", () => {
    expect(
      isValidVisibilitySelection({ ...base, scope: "manager_override", managerUserId: "" })
    ).toBe(false);
    expect(
      isValidVisibilitySelection({ ...base, scope: "manager_override", managerUserId: "mgr-1" })
    ).toBe(true);
  });
});

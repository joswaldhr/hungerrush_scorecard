import { describe, it, expect } from "vitest";
import { resolveVisibility } from "@/lib/domain/metrics/visibility-resolution";

const EMP_ID = "emp-1";
const MANAGER_ID = "manager-1";
const MENUFY_TEAM_ID = "team-menufy";
const POS_TEAM_ID = "team-pos";

describe("resolveVisibility", () => {
  it("is visible by default when no overrides exist", () => {
    expect(resolveVisibility([], EMP_ID, [MANAGER_ID], MENUFY_TEAM_ID, null)).toBe(false);
  });

  it("global_default hides a row for everyone", () => {
    const candidates = [
      {
        scope: "global_default" as const,
        managerUserId: null,
        targetEmployeeId: null,
        teamId: null,
        line: null,
        hidden: true,
      },
    ];
    expect(resolveVisibility(candidates, EMP_ID, [MANAGER_ID], MENUFY_TEAM_ID, null)).toBe(true);
  });

  it("manager_override beats global_default", () => {
    const candidates = [
      {
        scope: "global_default" as const,
        managerUserId: null,
        targetEmployeeId: null,
        teamId: null,
        line: null,
        hidden: true,
      },
      {
        scope: "manager_override" as const,
        managerUserId: MANAGER_ID,
        targetEmployeeId: null,
        teamId: null,
        line: null,
        hidden: false,
      },
    ];
    expect(resolveVisibility(candidates, EMP_ID, [MANAGER_ID], MENUFY_TEAM_ID, null)).toBe(false);
  });

  it("scorecard_override beats manager_override and global_default", () => {
    const candidates = [
      {
        scope: "global_default" as const,
        managerUserId: null,
        targetEmployeeId: null,
        teamId: null,
        line: null,
        hidden: false,
      },
      {
        scope: "manager_override" as const,
        managerUserId: MANAGER_ID,
        targetEmployeeId: null,
        teamId: null,
        line: null,
        hidden: false,
      },
      {
        scope: "scorecard_override" as const,
        managerUserId: null,
        targetEmployeeId: EMP_ID,
        teamId: null,
        line: null,
        hidden: true,
      },
    ];
    expect(resolveVisibility(candidates, EMP_ID, [MANAGER_ID], MENUFY_TEAM_ID, null)).toBe(true);
  });

  it("a manager_override for a different manager does not apply", () => {
    const candidates = [
      {
        scope: "manager_override" as const,
        managerUserId: "other-manager",
        targetEmployeeId: null,
        teamId: null,
        line: null,
        hidden: true,
      },
    ];
    expect(resolveVisibility(candidates, EMP_ID, [MANAGER_ID], MENUFY_TEAM_ID, null)).toBe(false);
  });

  it("a scorecard_override for a different employee does not apply", () => {
    const candidates = [
      {
        scope: "scorecard_override" as const,
        managerUserId: null,
        targetEmployeeId: "other-employee",
        teamId: null,
        line: null,
        hidden: true,
      },
    ];
    expect(resolveVisibility(candidates, EMP_ID, [MANAGER_ID], MENUFY_TEAM_ID, null)).toBe(false);
  });

  it("a line-specific override at a scope wins over a line-blanket override at the same scope", () => {
    const candidates = [
      {
        scope: "global_default" as const,
        managerUserId: null,
        targetEmployeeId: null,
        teamId: null,
        line: null,
        hidden: false,
      },
      {
        scope: "global_default" as const,
        managerUserId: null,
        targetEmployeeId: null,
        teamId: null,
        line: "restaurant",
        hidden: true,
      },
    ];
    expect(resolveVisibility(candidates, EMP_ID, [MANAGER_ID], MENUFY_TEAM_ID, "restaurant")).toBe(
      true
    );
    expect(resolveVisibility(candidates, EMP_ID, [MANAGER_ID], MENUFY_TEAM_ID, "consumer")).toBe(
      false
    );
  });

  it("a line-blanket override still applies when no line-specific override exists for the lookup line", () => {
    const candidates = [
      {
        scope: "global_default" as const,
        managerUserId: null,
        targetEmployeeId: null,
        teamId: null,
        line: null,
        hidden: true,
      },
    ];
    expect(resolveVisibility(candidates, EMP_ID, [MANAGER_ID], MENUFY_TEAM_ID, "restaurant")).toBe(
      true
    );
  });

  it("a team-scoped override does not leak to a different team (POS vs Menufy)", () => {
    const candidates = [
      {
        scope: "global_default" as const,
        managerUserId: null,
        targetEmployeeId: null,
        teamId: POS_TEAM_ID,
        line: null,
        hidden: true,
      },
    ];
    // POS employee: hidden. Menufy employee (also line=null): unaffected.
    expect(resolveVisibility(candidates, EMP_ID, [MANAGER_ID], POS_TEAM_ID, null)).toBe(true);
    expect(resolveVisibility(candidates, EMP_ID, [MANAGER_ID], MENUFY_TEAM_ID, null)).toBe(false);
  });

  it("a team-scoped override beats a team-blanket override at the same scope", () => {
    const candidates = [
      {
        scope: "global_default" as const,
        managerUserId: null,
        targetEmployeeId: null,
        teamId: null,
        line: null,
        hidden: false,
      },
      {
        scope: "global_default" as const,
        managerUserId: null,
        targetEmployeeId: null,
        teamId: POS_TEAM_ID,
        line: null,
        hidden: true,
      },
    ];
    expect(resolveVisibility(candidates, EMP_ID, [MANAGER_ID], POS_TEAM_ID, null)).toBe(true);
    expect(resolveVisibility(candidates, EMP_ID, [MANAGER_ID], MENUFY_TEAM_ID, null)).toBe(false);
  });
});

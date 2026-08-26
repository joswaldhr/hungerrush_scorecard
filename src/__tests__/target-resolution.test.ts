import { describe, it, expect } from "vitest";
import { resolveTarget, evaluateStatus } from "@/lib/domain/metrics/target-resolution";

const EMP_ID = "emp-1";
const TEAM_ID = "team-1";

describe("resolveTarget", () => {
  it("returns null when no candidates", () => {
    expect(resolveTarget([], EMP_ID, null, TEAM_ID)).toBeNull();
  });

  it("selects employee-specific target over team target", () => {
    const result = resolveTarget(
      [
        {
          targetValue: 80,
          warningValue: 70,
          targetType: "minimum",
          priority: 0,
          employeeId: null,
          roleKey: null,
          teamId: TEAM_ID,
        },
        {
          targetValue: 90,
          warningValue: 85,
          targetType: "minimum",
          priority: 0,
          employeeId: EMP_ID,
          roleKey: null,
          teamId: null,
        },
      ],
      EMP_ID,
      null,
      TEAM_ID
    );
    expect(result).not.toBeNull();
    expect(result!.targetValue).toBe(90);
    expect(result!.source).toBe("employee");
  });

  it("selects role target over team target", () => {
    const result = resolveTarget(
      [
        {
          targetValue: 80,
          warningValue: null,
          targetType: "minimum",
          priority: 0,
          employeeId: null,
          roleKey: null,
          teamId: TEAM_ID,
        },
        {
          targetValue: 85,
          warningValue: null,
          targetType: "minimum",
          priority: 0,
          employeeId: null,
          roleKey: "senior",
          teamId: TEAM_ID,
        },
      ],
      EMP_ID,
      "senior",
      TEAM_ID
    );
    expect(result!.targetValue).toBe(85);
    expect(result!.source).toBe("role");
  });

  it("selects team target over org default", () => {
    const result = resolveTarget(
      [
        {
          targetValue: 70,
          warningValue: null,
          targetType: "minimum",
          priority: 0,
          employeeId: null,
          roleKey: null,
          teamId: null,
        },
        {
          targetValue: 80,
          warningValue: null,
          targetType: "minimum",
          priority: 0,
          employeeId: null,
          roleKey: null,
          teamId: TEAM_ID,
        },
      ],
      EMP_ID,
      null,
      TEAM_ID
    );
    expect(result!.targetValue).toBe(80);
    expect(result!.source).toBe("team");
  });

  it("falls back to org default when no team target exists", () => {
    const result = resolveTarget(
      [
        {
          targetValue: 70,
          warningValue: null,
          targetType: "minimum",
          priority: 0,
          employeeId: null,
          roleKey: null,
          teamId: null,
        },
      ],
      EMP_ID,
      null,
      TEAM_ID
    );
    expect(result!.targetValue).toBe(70);
    expect(result!.source).toBe("org");
  });

  it("uses priority to break ties at the same scope level", () => {
    const result = resolveTarget(
      [
        {
          targetValue: 80,
          warningValue: null,
          targetType: "minimum",
          priority: 1,
          employeeId: null,
          roleKey: null,
          teamId: TEAM_ID,
        },
        {
          targetValue: 85,
          warningValue: null,
          targetType: "minimum",
          priority: 5,
          employeeId: null,
          roleKey: null,
          teamId: TEAM_ID,
        },
      ],
      EMP_ID,
      null,
      TEAM_ID
    );
    expect(result!.targetValue).toBe(85);
  });
});

describe("evaluateStatus", () => {
  it("returns no_data when value is null, even with a target configured", () => {
    const target = {
      targetValue: 80,
      warningValue: 70,
      targetType: "minimum" as const,
      source: "team" as const,
      priority: 0,
    };
    const result = evaluateStatus(null, target, "higher_is_better");
    expect(result.status).toBe("no_data");
  });

  it("returns no_data when value is null and there is no target either", () => {
    const result = evaluateStatus(null, null, "higher_is_better");
    expect(result.status).toBe("no_data");
  });

  it("returns no_target when target is null", () => {
    const result = evaluateStatus(50, null, "higher_is_better");
    expect(result.status).toBe("no_target");
  });

  it("returns on_target when value meets higher_is_better minimum", () => {
    const target = {
      targetValue: 80,
      warningValue: 70,
      targetType: "minimum" as const,
      source: "team" as const,
      priority: 0,
    };
    expect(evaluateStatus(85, target, "higher_is_better").status).toBe("on_target");
  });

  it("returns warning when value is between warning and target", () => {
    const target = {
      targetValue: 80,
      warningValue: 70,
      targetType: "minimum" as const,
      source: "team" as const,
      priority: 0,
    };
    expect(evaluateStatus(75, target, "higher_is_better").status).toBe("warning");
  });

  it("returns off_target when value is below warning", () => {
    const target = {
      targetValue: 80,
      warningValue: 70,
      targetType: "minimum" as const,
      source: "team" as const,
      priority: 0,
    };
    expect(evaluateStatus(65, target, "higher_is_better").status).toBe("off_target");
  });

  it("handles lower_is_better correctly", () => {
    const target = {
      targetValue: 10,
      warningValue: 15,
      targetType: "maximum" as const,
      source: "team" as const,
      priority: 0,
    };
    expect(evaluateStatus(8, target, "lower_is_better").status).toBe("on_target");
    expect(evaluateStatus(12, target, "lower_is_better").status).toBe("warning");
    expect(evaluateStatus(20, target, "lower_is_better").status).toBe("off_target");
  });
});

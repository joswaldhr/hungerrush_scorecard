import { describe, it, expect } from "vitest";
import {
  resolveTarget,
  evaluateStatus,
  evaluateChangeStatus,
} from "@/lib/domain/metrics/target-resolution";
import { GOLDEN_STATUS_SCENARIOS } from "@/lib/fixtures/golden-dataset";

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

  it("handles minimum + lower_is_better (golden dataset scenario)", () => {
    const { target, direction, onTargetValue, warningValue, offTargetValue } =
      GOLDEN_STATUS_SCENARIOS.minimumLowerIsBetter;
    const resolved = { ...target, source: "team" as const, priority: 0 };
    expect(evaluateStatus(onTargetValue, resolved, direction).status).toBe("on_target");
    expect(evaluateStatus(warningValue, resolved, direction).status).toBe("warning");
    expect(evaluateStatus(offTargetValue, resolved, direction).status).toBe("off_target");
  });

  it(
    "handles maximum + higher_is_better identically to maximum + lower_is_better " +
      "(golden dataset scenario — evaluateStatus's maximum branch does not actually " +
      "branch on direction; see target-resolution.ts:94-103, documented as an " +
      "architecture note in the 2026-09-01 Metric Integrity Report)",
    () => {
      const { target, direction, onTargetValue, warningValue, offTargetValue } =
        GOLDEN_STATUS_SCENARIOS.maximumHigherIsBetter;
      const resolved = { ...target, source: "team" as const, priority: 0 };
      expect(evaluateStatus(onTargetValue, resolved, direction).status).toBe("on_target");
      expect(evaluateStatus(warningValue, resolved, direction).status).toBe("warning");
      expect(evaluateStatus(offTargetValue, resolved, direction).status).toBe("off_target");
    }
  );

  it(
    "KNOWN GAP: targetType 'exact' is evaluated identically to 'minimum' — no " +
      "equality check exists (target-resolution.ts:82). Unreachable today (no " +
      "seed data uses 'exact'), but documents the latent bug rather than leaving " +
      "it undiscovered.",
    () => {
      const target = {
        targetValue: 80,
        warningValue: 70,
        targetType: "exact" as const,
        source: "team" as const,
        priority: 0,
      };
      // A true "exact" semantics would treat 95 as off_target (not equal to 80).
      // Current behavior treats it as on_target, same as "minimum".
      expect(evaluateStatus(95, target, "higher_is_better").status).toBe("on_target");
    }
  );

  it(
    "KNOWN GAP: targetType 'range' silently falls through to no_target even " +
      "though a target row exists (target-resolution.ts:105). Unreachable today " +
      "(no seed data uses 'range'), but the schema's target_type column accepts " +
      "any text value, so this is a live landmine if 'range' targets are ever added.",
    () => {
      const target = {
        targetValue: 80,
        warningValue: 70,
        targetType: "range" as const,
        source: "team" as const,
        priority: 0,
      };
      expect(evaluateStatus(75, target, "higher_is_better").status).toBe("no_target");
    }
  );
});

describe("evaluateChangeStatus", () => {
  it("returns no_data when changePct is null", () => {
    const result = evaluateChangeStatus(null, "higher_is_better");
    expect(result.status).toBe("no_data");
    expect(result.isImproved).toBe(false);
  });

  it("returns on_target for a change under 1% regardless of direction", () => {
    expect(evaluateChangeStatus(0.5, "higher_is_better").status).toBe("on_target");
    expect(evaluateChangeStatus(-0.5, "lower_is_better").status).toBe("on_target");
  });

  it("treats a positive change as improvement when higher_is_better", () => {
    const result = evaluateChangeStatus(15, "higher_is_better");
    expect(result.isImproved).toBe(true);
    expect(result.status).toBe("on_target");
  });

  it("treats a negative change as improvement when lower_is_better", () => {
    const result = evaluateChangeStatus(-15, "lower_is_better");
    expect(result.isImproved).toBe(true);
    expect(result.status).toBe("on_target");
  });

  it("treats a positive change as regression when lower_is_better, scaling with magnitude", () => {
    expect(evaluateChangeStatus(5, "lower_is_better").status).toBe("warning"); // 1% <= |5%| < 10%
    expect(evaluateChangeStatus(15, "lower_is_better").status).toBe("off_target"); // |15%| >= 10%
  });

  it("treats a negative change as regression when higher_is_better, scaling with magnitude", () => {
    expect(evaluateChangeStatus(-5, "higher_is_better").status).toBe("warning");
    expect(evaluateChangeStatus(-15, "higher_is_better").status).toBe("off_target");
  });

  it("handles the exact 10% off_target boundary", () => {
    expect(evaluateChangeStatus(-10, "higher_is_better").status).toBe("off_target");
    expect(evaluateChangeStatus(-9.99, "higher_is_better").status).toBe("warning");
  });
});

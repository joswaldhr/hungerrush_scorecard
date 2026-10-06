import { describe, expect, it } from "vitest";
import {
  compareReportSourceMembership,
  resolveReportGroupLabels,
} from "./zendesk-report-group-scope";

describe("saved report group name scope", () => {
  const groups = [
    { id: 10, name: "Current team" },
    { id: 20, name: "Other team" },
  ];
  const renames = [{ groupId: 20, from: "Former team", to: "Other team" }];

  it("does not expand a saved old-name selection to current activity", () => {
    const scope = resolveReportGroupLabels(["Current team", "Former team"], groups, renames);
    expect(scope.exactNameGroupIds).toEqual([10]);
    expect(scope.historicalAliases).toEqual([{ label: "Former team", groupId: 20 }]);
    expect(scope.requiresSourceSetQualification).toBe(true);
    expect(compareReportSourceMembership([101, 102], [101, 102, 201])).toEqual({
      matches: false,
      missing: [],
      extra: [201],
    });
  });
  it("keeps an explicit current-name selection while recording its old-name alias", () => {
    const scope = resolveReportGroupLabels(["Former team", "Other team"], groups, renames);
    expect(scope.exactNameGroupIds).toEqual([20]);
    expect(scope.historicalAliases).toHaveLength(1);
  });
  it("matches exact source identities independently of order, including empty populations", () => {
    expect(compareReportSourceMembership([102, 101], [101, 102]).matches).toBe(true);
    expect(compareReportSourceMembership([], []).matches).toBe(true);
    expect(compareReportSourceMembership([101], []).missing).toEqual([101]);
  });
  it("refuses ambiguous rename history and reports unresolved labels", () => {
    expect(() =>
      resolveReportGroupLabels(["Former team"], groups, [
        ...renames,
        { groupId: 10, from: "Former team", to: "Current team" },
      ])
    ).toThrow("Ambiguous");
    expect(resolveReportGroupLabels(["Unknown"], groups, []).unknownLabels).toEqual(["Unknown"]);
  });
  it("refuses duplicate identities rather than concealing a broken export or census", () => {
    expect(() => compareReportSourceMembership([1, 1], [1])).toThrow("duplicate");
    expect(() => resolveReportGroupLabels(["Current team"], [...groups, groups[0]!], [])).toThrow();
    expect(() => compareReportSourceMembership([0], [])).toThrow();
  });
});

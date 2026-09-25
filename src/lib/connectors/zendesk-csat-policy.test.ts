// @vitest-environment node
import { expect, it } from "vitest";
import { parseZendeskCsatPolicy, csatPolicyForPeriod } from "./zendesk-csat-policy";
const config = {
  dataSourceId: "00000000-0000-4000-8000-000000000001",
  organizationId: "00000000-0000-4000-8000-000000000002",
};
const raw = () => ({
  schemaVersion: 1,
  ...config,
  accountReference: "zendesk-account:synthetic",
  reportingTimeZone: "America/Chicago",
  effectivePeriodStart: "2026-09-20",
  teams: [
    {
      teamId: "00000000-0000-4000-8000-000000000003",
      groupIds: [20],
      brandIds: [30],
      metricKeys: ["csat_score"],
    },
  ],
});
const parse = (input: unknown) => parseZendeskCsatPolicy(JSON.stringify(input), "synthetic");
it("requires explicit account, source and organization bindings and a prospective cutover", () => {
  const policy = parse(raw());
  expect(csatPolicyForPeriod(policy, config, "2026-09-13")).toBeNull();
  expect(csatPolicyForPeriod(policy, config, "2026-09-20")).toEqual(policy);
  expect(
    csatPolicyForPeriod(
      policy,
      { ...config, dataSourceId: "00000000-0000-4000-8000-000000000004" },
      "2026-09-20"
    )
  ).toBeNull();
  expect(() =>
    csatPolicyForPeriod(policy, { ...config, organizationId: "other" }, "2026-09-20")
  ).toThrow(/organization/);
  expect(() => parse({ ...raw(), accountReference: "zendesk-account:other" })).toThrow(/binding/);
});
it("keeps absent policy disabled and fails on malformed or ambiguous scope", () => {
  expect(parseZendeskCsatPolicy(undefined, "synthetic")).toBeNull();
  expect(() => parseZendeskCsatPolicy("not json", "synthetic")).toThrow(/JSON/);
  const input = raw();
  expect(() => parse({ ...input, teams: [input.teams[0], input.teams[0]] })).toThrow();
  expect(() => parse({ ...input, teams: [{ ...input.teams[0], groupIds: [] }] })).toThrow();
  expect(() => parse({ ...input, teams: [{ ...input.teams[0], groupIds: [20, 20] }] })).toThrow();
  expect(() =>
    parse({ ...input, teams: [{ ...input.teams[0], metricKeys: ["csat_score", "csat_score"] }] })
  ).toThrow();
  expect(() => parse({ ...input, reportingTimeZone: "unknown" })).toThrow();
  expect(() => parse({ ...input, effectivePeriodStart: "2026-09-21" })).toThrow();
  expect(() => parse({ ...input, unexpectedFallback: true })).toThrow();
});

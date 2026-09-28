// @vitest-environment node
import { expect, it } from "vitest";
import { parseZendeskTalkPolicy, talkPolicyForPeriod } from "./zendesk-talk-policy";

const config = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  dataSourceId: "00000000-0000-4000-8000-000000000002",
};
const input = () => ({
  schemaVersion: 1,
  ...config,
  accountReference: "zendesk-account:synthetic",
  reportingTimeZone: "America/Chicago",
  effectivePeriodStart: "2026-09-20",
  observationLimits: { maxAgeMs: 900000, maxSpanMs: 600000 },
  teams: [
    {
      teamId: "00000000-0000-4000-8000-000000000003",
      inbound: {
        dateBasis: "call-created",
        groupIds: [7],
        phoneNumbers: null,
        metricKeys: ["inbound_calls_accepted"],
      },
      outbound: {
        dateBasis: "call-created",
        scopeMeaning: "current-linked-ticket-group",
        ticketGroupIds: [8],
        metricKeys: ["outbound_calls"],
      },
    },
  ],
});
const parse = (value: unknown) => parseZendeskTalkPolicy(JSON.stringify(value), "synthetic");

it("scopes prospective ownership to one organization/source and never enables absent policy", () => {
  expect(parseZendeskTalkPolicy(undefined, "synthetic")).toBeNull();
  const policy = parse(input());
  expect(talkPolicyForPeriod(policy, config, "2026-09-13")).toBeNull();
  expect(talkPolicyForPeriod(policy, config, "2026-09-20")).toEqual(policy);
  expect(
    talkPolicyForPeriod(policy, { ...config, dataSourceId: "other" }, "2026-09-20")
  ).toBeNull();
  expect(() =>
    talkPolicyForPeriod(policy, { ...config, organizationId: "other" }, "2026-09-20")
  ).toThrow("organization");
  expect(() => parse({ ...input(), accountReference: "zendesk-account:other" })).toThrow("binding");
});
it("allows a canary family without silently enabling the other family", () => {
  const value = input();
  expect(
    parse({ ...value, teams: [{ ...value.teams[0], inbound: null }] })!.teams[0]!.inbound
  ).toBeNull();
  expect(
    parse({ ...value, teams: [{ ...value.teams[0], outbound: null }] })!.teams[0]!.outbound
  ).toBeNull();
  expect(() =>
    parse({ ...value, teams: [{ ...value.teams[0], inbound: null, outbound: null }] })
  ).toThrow();
});
it("rejects cross-family and unrelated metric keys", () => {
  for (const key of ["tickets_resolved", "avg_response_time", "outbound_calls", "unknown"])
    expect(() =>
      parse({
        ...input(),
        teams: [
          { ...input().teams[0], inbound: { ...input().teams[0]!.inbound, metricKeys: [key] } },
        ],
      })
    ).toThrow();
  expect(() =>
    parse({
      ...input(),
      teams: [
        {
          ...input().teams[0],
          outbound: { ...input().teams[0]!.outbound, metricKeys: ["inbound_calls_accepted"] },
        },
      ],
    })
  ).toThrow();
});
it("rejects ambiguous teams, scopes, lines and duplicated metric assignments", () => {
  const value = input(),
    team = value.teams[0]!;
  expect(() => parse({ ...value, teams: [team, team] })).toThrow();
  for (const changes of [
    { groupIds: [] },
    { groupIds: [7, 7] },
    { phoneNumbers: [] },
    { phoneNumbers: ["line", "line"] },
    { metricKeys: ["inbound_calls_accepted", "inbound_calls_accepted"] },
  ])
    expect(() =>
      parse({ ...value, teams: [{ ...team, inbound: { ...team.inbound, ...changes } }] })
    ).toThrow();
});
it("requires exact outbound date and group meaning rather than reusing inbound routing scope", () => {
  for (const changes of [
    { dateBasis: "leg-created" },
    { scopeMeaning: "call-group" },
    { ticketGroupIds: [] },
    { phoneNumbers: ["line"] },
  ])
    expect(() =>
      parse({
        ...input(),
        teams: [{ ...input().teams[0], outbound: { ...input().teams[0]!.outbound, ...changes } }],
      })
    ).toThrow();
});
it("requires explicit bounded observation limits and rejects unknown policy fields", () => {
  for (const changes of [
    { observationLimits: undefined },
    { observationLimits: { maxAgeMs: 0, maxSpanMs: 600000 } },
    { observationLimits: { maxAgeMs: 360000000, maxSpanMs: 600000 } },
    { effectivePeriodStart: "2026-09-21" },
    { reportingTimeZone: "unknown" },
    { enableAll: true },
  ])
    expect(() => parse({ ...input(), ...changes })).toThrow();
  expect(() => parseZendeskTalkPolicy("not json", "synthetic")).toThrow("JSON");
  expect(() => talkPolicyForPeriod(parse(input()), config, "2026-09-21")).toThrow("Sunday");
});

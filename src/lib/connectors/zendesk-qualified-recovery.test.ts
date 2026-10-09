// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  env: {
    ZENDESK_CSAT_RECOVERY: undefined as string | undefined,
    ZENDESK_FIRST_REPLY_RECOVERY: undefined as string | undefined,
    ZENDESK_REPORT_RECOVERY: undefined as string | undefined,
  },
  collection: vi.fn(),
  releases: vi.fn(),
  csat: vi.fn(),
  firstReply: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("./zendesk-solved-config", () => ({
  configuredReportEventCollectionPolicy: mocks.collection,
  configuredSolvedReportReleases: mocks.releases,
}));
vi.mock("./zendesk-csat-config", () => ({ configuredCsatPolicy: mocks.csat }));
vi.mock("./zendesk-first-reply-config", () => ({ configuredFirstReplyPolicy: mocks.firstReply }));
import { configuredQualifiedRecovery, planQualifiedRecovery } from "./zendesk-qualified-recovery";
const scope = {
  organizationId: "10000000-0000-4000-8000-000000000001",
  dataSourceId: "10000000-0000-4000-8000-000000000002",
  accountReference: "zendesk-account:synthetic",
};
const policy = {
  ...scope,
  schemaVersion: 1 as const,
  reportingTimeZone: "America/Chicago",
  effectivePeriodStart: "2026-09-06",
  teams: [
    {
      teamId: "10000000-0000-4000-8000-000000000003",
      groupIds: [10],
      brandIds: null,
      metricKeys: ["avg_response_time"] as ["avg_response_time"],
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.ZENDESK_REPORT_RECOVERY = undefined;
  mocks.env.ZENDESK_CSAT_RECOVERY = undefined;
  mocks.env.ZENDESK_FIRST_REPLY_RECOVERY = undefined;
  mocks.collection.mockReturnValue({ scope });
  mocks.releases.mockReturnValue([{ ...scope }]);
  mocks.csat.mockReturnValue(policy);
  mocks.firstReply.mockReturnValue(policy);
});
it.each(["csat", "first-reply"] as const)(
  "%s is default-off and requires an active source/account-bound dispatcher",
  (kind) => {
    expect(configuredQualifiedRecovery(kind)).toBeUndefined();
    expect(mocks.collection).not.toHaveBeenCalled();
    if (kind === "csat") mocks.env.ZENDESK_CSAT_RECOVERY = "1";
    else mocks.env.ZENDESK_FIRST_REPLY_RECOVERY = "1";
    expect(() => configuredQualifiedRecovery(kind)).toThrow("active source-bound");
    mocks.env.ZENDESK_REPORT_RECOVERY = "1";
    expect(configuredQualifiedRecovery(kind)).toEqual({ scope, policy });
    mocks.releases.mockReturnValue([{ ...scope, accountReference: "zendesk-account:foreign" }]);
    expect(() => configuredQualifiedRecovery(kind)).toThrow();
    mocks.releases.mockReturnValue([{ ...scope }]);
    mocks.csat.mockReturnValue(null);
    mocks.firstReply.mockReturnValue(null);
    expect(() => configuredQualifiedRecovery(kind)).toThrow();
  }
);
it.each([
  ["csat", 8],
  ["first-reply", 16],
] as const)("%s retains each slot's selected week through Sunday", (kind, hour) => {
  const before = planQualifiedRecovery(kind, policy, new Date("2026-10-03T23:59:59Z"));
  const sun = planQualifiedRecovery(
    kind,
    policy,
    new Date(`2026-10-04T${String(hour - 1).padStart(2, "0")}:59:59Z`)
  );
  expect(sun).toEqual(before);
  const next = planQualifiedRecovery(
    kind,
    policy,
    new Date(`2026-10-04T${String(hour).padStart(2, "0")}:00:00Z`)
  );
  expect(next.requests[0]).toMatchObject({
    definition: { periodStart: "2026-10-04", periodEnd: "2026-10-10" },
    desiredAt: `2026-10-04T${hour.toString().padStart(2, "0")}:00:00.000Z`,
  });
  expect(next.requests.slice(1)).toEqual(before.requests.slice(1));
  expect(next.policyHash).toBe(before.policyHash);
  expect(
    planQualifiedRecovery(
      kind,
      { ...policy, effectivePeriodStart: "2026-10-04" },
      new Date("2026-10-03T23:59:59Z")
    ).requests
  ).toEqual([]);
});

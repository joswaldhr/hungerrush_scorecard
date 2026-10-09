// @vitest-environment node
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, beforeEach, expect, it, vi } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, dataSources, teams, sourceRecords } from "@/lib/db/schema";
import { requestReportJobs, REPORT_JOB_RECORD } from "@/lib/connectors/zendesk-report-jobs";
import { planReportRecovery } from "@/lib/connectors/zendesk-report-recovery";
import type { SolvedRelease } from "@/lib/connectors/zendesk-solved-publication-record";
const mocks = vi.hoisted(() => ({
  collection: vi.fn(),
  qualified: vi.fn(),
  legacy: vi.fn(),
  releases: vi.fn(),
  env: { ZENDESK_REPORT_RECOVERY: "1" },
}));
vi.mock("@/lib/connectors/zendesk-solved-config", () => ({
  configuredReportEventCollectionPolicy: mocks.collection,
  configuredSolvedReportReleases: mocks.releases,
}));
vi.mock("@/lib/connectors/zendesk-qualified-recovery", async (original) => ({
  ...(await original<object>()),
  configuredQualifiedRecovery: mocks.qualified,
}));
vi.mock("@/lib/connectors/zendesk-legacy-sync-recovery", async (original) => ({
  ...(await original<object>()),
  configuredLegacySyncRecovery: mocks.legacy,
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
import { getReportRecoveryHealth } from "@/lib/domain/metrics/report-recovery-health";
const org = randomUUID(),
  foreignOrg = randomUUID(),
  source = randomUUID(),
  teamA = randomUUID(),
  teamB = randomUUID(),
  foreignTeam = randomUUID();
const collection = {
  scope: {
    organizationId: org,
    dataSourceId: source,
    accountReference: "zendesk-account:synthetic",
  },
  bootstrapStart: 1609459200,
};
const common = {
  ...collection.scope,
  subdomain: "synthetic",
  timeZone: "UTC",
  brandIds: null,
  groupIds: [10],
  effectivePeriodStart: "2026-09-27",
  maxObservationAgeSeconds: 86400,
  releaseEvidenceSha256: "a".repeat(64),
};
const releases: SolvedRelease[] = [
  { ...common, teamId: teamA, kind: "updater" },
  { ...common, teamId: teamB, kind: "assignee-solved" },
];
const now = new Date("2026-10-08T18:00:00Z");
const plan = planReportRecovery(collection, releases, now);
beforeAll(async () => {
  await db
    .insert(organizations)
    .values([org, foreignOrg].map((id) => ({ id, name: "Synthetic health" })));
  await db.insert(teams).values([
    { id: teamA, organizationId: org, name: "Synthetic A", slug: "synthetic-a" },
    { id: teamB, organizationId: org, name: "Synthetic B", slug: "synthetic-b" },
    { id: foreignTeam, organizationId: foreignOrg, name: "Foreign team", slug: "foreign" },
  ]);
  await db.insert(dataSources).values({
    id: source,
    organizationId: org,
    type: "zendesk",
    displayName: "Synthetic health",
    status: "configured",
    configurationReference: collection.scope.accountReference,
  });
  await requestReportJobs(collection.scope, plan.requests);
  // The queue uses the database clock; keep this historical display fixture deterministic.
  await db
    .update(sourceRecords)
    .set({
      payloadJson: sql`jsonb_set(${sourceRecords.payloadJson}, '{notBefore}', to_jsonb('2026-10-08T00:00:00.000Z'::text))`,
    })
    .where(eq(sourceRecords.dataSourceId, source));
});
beforeEach(async () => {
  mocks.qualified.mockReset();
  mocks.legacy.mockReset();
  mocks.collection.mockReturnValue(collection);
  mocks.releases.mockReturnValue(releases);
  mocks.env.ZENDESK_REPORT_RECOVERY = "1";
  await db
    .update(dataSources)
    .set({ configurationReference: collection.scope.accountReference })
    .where(eq(dataSources.id, source));
});
afterAll(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, source));
  await db.delete(dataSources).where(eq(dataSources.id, source));
  await db.delete(teams).where(inArray(teams.id, [teamA, teamB, foreignTeam]));
  await db.delete(organizations).where(inArray(organizations.id, [org, foreignOrg]));
});
it("shows only authorized team periods and makes no queue changes while reading", async () => {
  const before = await db
    .select()
    .from(sourceRecords)
    .where(eq(sourceRecords.dataSourceId, source));
  const result = await getReportRecoveryHealth(org, [teamA, foreignTeam], now);
  expect(result.state).toBe("enabled");
  expect(result.rows).toHaveLength(3);
  expect(result.rows.map((r) => r.team)).toEqual([
    "Shared source collection",
    "Synthetic A",
    "Synthetic A",
  ]);
  expect(result.rows.slice(1).map((r) => r.periodStart)).toEqual(["2026-10-04", "2026-09-27"]);
  expect(result.rows.every((r) => r.status === "queued")).toBe(true);
  expect(
    await db.select().from(sourceRecords).where(eq(sourceRecords.dataSourceId, source))
  ).toEqual(before);
  expect(JSON.stringify(result)).not.toContain(collection.scope.accountReference);
  expect(JSON.stringify(result)).not.toContain("lease");
});
it("does not expose other organizations or expand an individual assignment into team visibility", async () => {
  expect((await getReportRecoveryHealth(foreignOrg, [teamA], now)).rows).toEqual([]);
  expect((await getReportRecoveryHealth(org, [], now)).rows).toEqual([]);
  expect((await getReportRecoveryHealth(org, [foreignTeam], now)).rows).toEqual([]);
});
it("fails closed for source rebinding and invalid configuration without leaking errors", async () => {
  await db
    .update(dataSources)
    .set({ configurationReference: "zendesk-account:other" })
    .where(eq(dataSources.id, source));
  expect(await getReportRecoveryHealth(org, [teamA], now)).toEqual({
    state: "unavailable",
    rows: [],
  });
  mocks.collection.mockImplementation(() => {
    throw Error("secret SQL parameters");
  });
  expect(await getReportRecoveryHealth(org, [teamA], now)).toEqual({
    state: "unavailable",
    rows: [],
  });
});
it("shows the disabled switch separately from retained requests", async () => {
  mocks.env.ZENDESK_REPORT_RECOVERY = "0";
  expect(await getReportRecoveryHealth(org, [teamB], now)).toMatchObject({
    state: "disabled",
    rows: expect.arrayContaining([expect.objectContaining({ team: "Synthetic B" })]),
  });
});
it("ignores historical jobs outside the planned horizon rather than exhausting the read bound", async () => {
  const template = (
    await db.select().from(sourceRecords).where(eq(sourceRecords.dataSourceId, source))
  )[0]!;
  await db.insert(sourceRecords).values(
    Array.from({ length: 101 }, (_, n) => ({
      dataSourceId: source,
      externalRecordType: REPORT_JOB_RECORD,
      externalRecordId: `synthetic-old-${n}`,
      payloadHash: "b".repeat(64),
      payloadJson: {
        ...(template.payloadJson as object),
        definition: {
          ...plan.requests[1]!.definition,
          periodStart: "2020-12-27",
          periodEnd: "2021-01-02",
        },
      },
    }))
  );
  const result = await getReportRecoveryHealth(org, [teamA], now);
  expect(result.rows.every((r) => r.status === "queued")).toBe(true);
});

it("shows all enabled optional imports with only authorized team labels and no data mutation", async () => {
  const base = {
    ...collection.scope,
    schemaVersion: 1,
    reportingTimeZone: "UTC",
    effectivePeriodStart: "2026-09-27",
  };
  mocks.qualified.mockImplementation((kind: string) => ({
    scope: collection.scope,
    policy: {
      ...base,
      teams: [teamA, teamB].map((teamId) => ({
        teamId,
        groupIds: [10],
        brandIds: null,
        metricKeys: [kind === "csat" ? "csat_score" : "avg_response_time"],
      })),
    },
  }));
  mocks.legacy.mockReturnValue(collection.scope);
  const before = await db
    .select()
    .from(sourceRecords)
    .where(eq(sourceRecords.dataSourceId, source));
  const result = await getReportRecoveryHealth(org, [teamA], now);
  expect(result.state).toBe("enabled");
  expect(result.rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        team: "Synthetic A",
        metric: "CSAT (shared import)",
        status: "waiting",
      }),
      expect.objectContaining({
        team: "Synthetic A",
        metric: "First reply (shared import)",
        status: "waiting",
      }),
      expect.objectContaining({
        team: "Shared source import",
        metric: "Legacy metrics (shared import)",
        status: "waiting",
      }),
    ])
  );
  expect(JSON.stringify(result)).not.toContain("Synthetic B");
  expect(
    await db.select().from(sourceRecords).where(eq(sourceRecords.dataSourceId, source))
  ).toEqual(before);
  expect((await getReportRecoveryHealth(org, [], now)).rows).toEqual([]);
});

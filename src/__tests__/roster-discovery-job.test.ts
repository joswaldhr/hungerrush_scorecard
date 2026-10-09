// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  dataSources,
  employees,
  organizations,
  rosterCandidates,
  rosterObservations,
  rosterDiscoveryRuns,
  rosterSourceTeamMappings,
  teams,
  sourceRecords,
} from "@/lib/db/schema";
import { runRosterDiscoveryJob, getRosterDiscoveryHealth } from "@/lib/domain/roster/discovery-job";
import { discoverRosterCandidates } from "@/lib/domain/roster/reconcile";
import type { Connector } from "@/lib/connectors/types";
import {
  claimReportEventCollection,
  deferReportEventRequests,
  releaseReportEventCollection,
} from "@/lib/connectors/zendesk-report-event-store";
import { SourceRetryLaterError } from "@/lib/connectors/source-retry";

const org = randomUUID(),
  source = randomUUID(),
  team = randomUUID();
beforeAll(async () => {
  await db.insert(organizations).values({ id: org, name: "Roster job test" });
  await db.insert(teams).values({ id: team, organizationId: org, name: "Synthetic", slug: team });
  await db.insert(dataSources).values({
    id: source,
    organizationId: org,
    type: "zendesk",
    displayName: "Synthetic",
    configurationReference: "zendesk-account:synthetic",
  });
  await db.insert(rosterSourceTeamMappings).values({
    dataSourceId: source,
    teamId: team,
    externalGroupId: "1",
    externalGroupLabel: "Synthetic",
  });
});
afterAll(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, source));
  await db.delete(rosterDiscoveryRuns).where(eq(rosterDiscoveryRuns.dataSourceId, source));
  await db.delete(rosterCandidates).where(eq(rosterCandidates.dataSourceId, source));
  await db.delete(rosterObservations).where(eq(rosterObservations.dataSourceId, source));
  await db
    .delete(rosterSourceTeamMappings)
    .where(eq(rosterSourceTeamMappings.dataSourceId, source));
  await db.delete(dataSources).where(eq(dataSources.id, source));
  await db.delete(teams).where(eq(teams.id, team));
  await db.delete(organizations).where(eq(organizations.id, org));
});
const connector = (discoverRoster: Connector["discoverRoster"]) =>
  ({ discoverRoster }) as Connector;
async function clearRuns() {
  await db.delete(rosterDiscoveryRuns).where(eq(rosterDiscoveryRuns.dataSourceId, source));
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, source));
}

const accountScope = {
  organizationId: org,
  dataSourceId: source,
  accountReference: "zendesk-account:synthetic",
};

it("does not read Zendesk while another collector owns the account", async () => {
  await clearRuns();
  const lease = await claimReportEventCollection(accountScope);
  expect(lease.acquired).toBe(true);
  const fetch = vi.fn(async () => []);
  const result = await runRosterDiscoveryJob(source, "synthetic", connector(fetch));
  expect(result).toMatchObject({ success: false, retryAt: expect.any(String) });
  expect(fetch).not.toHaveBeenCalled();
  expect(await getRosterDiscoveryHealth(source)).toMatchObject({ failureCode: "source_deferred" });
});

it("preserves a released collector's cooldown without issuing a vendor request", async () => {
  await clearRuns();
  const lease = await claimReportEventCollection(accountScope);
  if (!lease.acquired) throw Error("Fixture lease unavailable");
  const scope = { ...accountScope, token: lease.token };
  await deferReportEventRequests(scope, 900000);
  await releaseReportEventCollection(scope);
  const fetch = vi.fn(async () => []);
  expect(await runRosterDiscoveryJob(source, "synthetic", connector(fetch))).toMatchObject({
    success: false,
    retryAt: expect.any(String),
  });
  expect(fetch).not.toHaveBeenCalled();
  const [saved] = await db
    .select()
    .from(sourceRecords)
    .where(eq(sourceRecords.dataSourceId, source));
  expect(
    Date.parse((saved!.payloadJson as { nextAllowedAt: string }).nextAllowedAt)
  ).toBeGreaterThan(Date.now() + 890000);
});

it("persists roster throttling for the metric collector and releases ownership", async () => {
  await clearRuns();
  const result = await runRosterDiscoveryJob(
    source,
    "synthetic",
    connector(async () => {
      throw new SourceRetryLaterError(900000);
    })
  );
  expect(result).toMatchObject({ success: false, retryAt: expect.any(String) });
  const lease = await claimReportEventCollection(accountScope);
  expect(lease.acquired).toBe(true);
  if (!lease.acquired) throw Error("Roster did not release ownership");
  expect(Date.parse(lease.nextAllowedAt)).toBeGreaterThan(Date.now() + 890000);
});

it("rejects roster publication after account ownership expires", async () => {
  await clearRuns();
  const before = await db
    .select()
    .from(rosterObservations)
    .where(eq(rosterObservations.dataSourceId, source));
  const result = await runRosterDiscoveryJob(
    source,
    "synthetic",
    connector(async () => {
      await db
        .update(sourceRecords)
        .set({
          payloadJson: sql`jsonb_set(payload_json, '{expiresAt}', to_jsonb('2000-01-01T00:00:00.000Z'::text))`,
        })
        .where(eq(sourceRecords.dataSourceId, source));
      return [];
    })
  );
  expect(result.success).toBe(false);
  expect(
    await db.select().from(rosterObservations).where(eq(rosterObservations.dataSourceId, source))
  ).toEqual(before);
});

it("records a failed run even when ownership loss prevents saving source cooldown", async () => {
  await clearRuns();
  const result = await runRosterDiscoveryJob(
    source,
    "synthetic",
    connector(async () => {
      await db
        .update(sourceRecords)
        .set({
          payloadJson: sql`jsonb_set(payload_json, '{expiresAt}', to_jsonb('2000-01-01T00:00:00.000Z'::text))`,
        })
        .where(eq(sourceRecords.dataSourceId, source));
      throw new SourceRetryLaterError(900000);
    })
  );
  expect(result.success).toBe(false);
  expect(result).not.toHaveProperty("retryAt");
  expect(await getRosterDiscoveryHealth(source)).toMatchObject({
    status: "failed",
    failureCode: "cooldown_record_failed",
  });
});

it("records a review candidate and run atomically without adding employees or freshening metrics", async () => {
  await clearRuns();
  const result = await runRosterDiscoveryJob(
    source,
    "synthetic",
    connector(async () => [
      {
        externalId: "job-hire@example.invalid",
        externalEmail: "job-hire@example.invalid",
        externalDisplayName: "Synthetic hire",
        teamId: team,
      },
    ])
  );
  expect(result).toMatchObject({
    success: true,
    reviewOnly: true,
    newCandidates: 1,
    autoApproved: 0,
  });
  expect(await getRosterDiscoveryHealth(source)).toMatchObject({
    status: "completed",
    newCandidates: 1,
  });
  expect(await db.select().from(employees).where(eq(employees.organizationId, org))).toHaveLength(
    0
  );
  const [saved] = await db.select().from(dataSources).where(eq(dataSources.id, source));
  expect(saved?.lastSuccessfulSyncAt).toBeNull();
});

it("coalesces concurrent triggers and honors cooldown", async () => {
  await clearRuns();
  const fetch = vi.fn(async () => []);
  const results = await Promise.all([
    runRosterDiscoveryJob(source, "synthetic", connector(fetch)),
    runRosterDiscoveryJob(source, "synthetic", connector(fetch)),
  ]);
  expect(fetch).toHaveBeenCalledOnce();
  expect(results.filter((r) => r.success)).toHaveLength(1);
  expect(results.filter((r) => "busy" in r && r.busy)).toHaveLength(1);
});

it("records sanitized failures and retains previous candidates", async () => {
  await clearRuns();
  const before = await db
    .select()
    .from(rosterCandidates)
    .where(eq(rosterCandidates.dataSourceId, source));
  const result = await runRosterDiscoveryJob(
    source,
    "synthetic",
    connector(async () => {
      throw new Error("private source payload must not be recorded");
    })
  );
  expect(result.success).toBe(false);
  const health = await getRosterDiscoveryHealth(source);
  expect(health).toMatchObject({ status: "failed", failureCode: "discovery_failed" });
  expect(JSON.stringify(health)).not.toContain("private source payload");
  expect(
    await db.select().from(rosterCandidates).where(eq(rosterCandidates.dataSourceId, source))
  ).toEqual(before);
});

it("refuses a source disabled during collection before creating candidates", async () => {
  await clearRuns();
  try {
    const result = await runRosterDiscoveryJob(
      source,
      "synthetic",
      connector(async () => {
        await db.update(dataSources).set({ status: "disabled" }).where(eq(dataSources.id, source));
        return [
          {
            externalId: "stale-job@example.invalid",
            externalEmail: "stale-job@example.invalid",
            externalDisplayName: "Stale synthetic",
            teamId: team,
          },
        ];
      })
    );
    expect(result.success).toBe(false);
    expect(
      await db
        .select()
        .from(rosterCandidates)
        .where(eq(rosterCandidates.externalId, "stale-job@example.invalid"))
    ).toHaveLength(0);
  } finally {
    await db.update(dataSources).set({ status: "configured" }).where(eq(dataSources.id, source));
  }
});

it("recovers a dead hosted run while retaining its failed evidence", async () => {
  await clearRuns();
  await db
    .insert(rosterDiscoveryRuns)
    .values({ dataSourceId: source, startedAt: new Date(Date.now() - 11 * 60_000) });
  expect(
    (
      await runRosterDiscoveryJob(
        source,
        "synthetic",
        connector(async () => [])
      )
    ).success
  ).toBe(true);
  const runs = await db
    .select()
    .from(rosterDiscoveryRuns)
    .where(eq(rosterDiscoveryRuns.dataSourceId, source));
  expect(runs).toHaveLength(2);
  expect(runs.find((r) => r.status === "failed")?.failureCode).toBe("worker_expired");
});

it("refuses mismatched source accounts without collecting or inserting a run", async () => {
  await clearRuns();
  const fetch = vi.fn(async () => []);
  await expect(runRosterDiscoveryJob(source, "wrong-account", connector(fetch))).rejects.toThrow(
    "binding"
  );
  expect(fetch).not.toHaveBeenCalled();
  expect(await getRosterDiscoveryHealth(source)).toBeNull();
});

it("fences a superseded worker before it can publish candidates", async () => {
  await clearRuns();
  const before = await db
    .select()
    .from(rosterCandidates)
    .where(eq(rosterCandidates.dataSourceId, source));
  const result = await runRosterDiscoveryJob(
    source,
    "synthetic",
    connector(async () => {
      await db
        .update(rosterDiscoveryRuns)
        .set({ status: "failed", failureCode: "worker_expired" })
        .where(eq(rosterDiscoveryRuns.dataSourceId, source));
      return [
        {
          externalId: "expired@example.invalid",
          externalEmail: "expired@example.invalid",
          externalDisplayName: "Expired synthetic",
          teamId: team,
        },
      ];
    })
  );
  expect(result.success).toBe(false);
  expect(await getRosterDiscoveryHealth(source)).toMatchObject({
    status: "failed",
    failureCode: "worker_expired",
  });
  expect(
    await db.select().from(rosterCandidates).where(eq(rosterCandidates.dataSourceId, source))
  ).toEqual(before);
});

it("rolls candidate writes back when atomic run bookkeeping fails", async () => {
  const before = await db
    .select()
    .from(rosterCandidates)
    .where(eq(rosterCandidates.dataSourceId, source));
  await expect(
    discoverRosterCandidates(
      connector(async () => [
        {
          externalId: "rollback@example.invalid",
          externalEmail: "rollback@example.invalid",
          externalDisplayName: "Rollback synthetic",
          teamId: team,
        },
      ]),
      source,
      {
        reviewOnly: true,
        recordResult: async () => {
          throw new Error("Bookkeeping unavailable");
        },
      }
    )
  ).rejects.toThrow("Bookkeeping unavailable");
  expect(
    await db.select().from(rosterCandidates).where(eq(rosterCandidates.dataSourceId, source))
  ).toEqual(before);
});

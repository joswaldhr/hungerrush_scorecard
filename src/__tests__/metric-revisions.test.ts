// @vitest-environment node
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  dataSources,
  employees,
  metricDefinitions,
  organizations,
  syncRevisions,
  syncRuns,
} from "@/lib/db/schema";
import { getStoredMetricRevisions } from "@/lib/domain/metrics/revisions";
vi.mock("@/lib/auth", () => ({ auth: async () => null }));

const org = randomUUID(),
  foreignOrg = randomUUID();
const employee = randomUUID(),
  otherEmployee = randomUUID();
const definition = randomUUID(),
  foreignDefinition = randomUUID();
const source = randomUUID(),
  foreignSource = randomUUID();
const run = randomUUID(),
  foreignRun = randomUUID();
const ctx = {
  userId: randomUUID(),
  organizationId: org,
  assignedTeamIds: [],
  assignedEmployeeIds: [employee],
};
const start = "2026-09-13",
  end = "2026-09-19";
const snapshot = () => ({
  employee_id: employee,
  metric_definition_id: definition,
  period_start: start,
  period_end: end,
  numeric_value: 0,
  quality_status: "complete",
  data_freshness_at: "2026-09-20T00:00:00+00:00",
  calculation_version: 1,
  unrelated_private_field: "DO NOT EXPOSE",
});
const revision = (snapshotJson: unknown, syncRunId = run, entityType = "metric_value") => ({
  syncRunId,
  entityType,
  entityId: randomUUID(),
  snapshotJson,
});

beforeAll(async () => {
  await db.insert(organizations).values([
    { id: org, name: "Revision fixtures" },
    { id: foreignOrg, name: "Other org" },
  ]);
  await db.insert(employees).values([
    { id: employee, organizationId: org, displayName: "Assigned" },
    { id: otherEmployee, organizationId: org, displayName: "Unassigned" },
  ]);
  await db.insert(metricDefinitions).values([
    {
      id: definition,
      organizationId: org,
      key: "revision_fixture",
      name: "Fixture",
      valueType: "number",
      direction: "higher_is_better",
    },
    {
      id: foreignDefinition,
      organizationId: foreignOrg,
      key: "revision_fixture",
      name: "Foreign",
      valueType: "number",
      direction: "higher_is_better",
    },
  ]);
  await db.insert(dataSources).values([
    { id: source, organizationId: org, type: "fixture", displayName: "Source" },
    {
      id: foreignSource,
      organizationId: foreignOrg,
      type: "fixture",
      displayName: "Foreign source",
    },
  ]);
  await db.insert(syncRuns).values([
    { id: run, dataSourceId: source, status: "completed" },
    { id: foreignRun, dataSourceId: foreignSource, status: "completed" },
  ]);
});
afterAll(async () => {
  await db.delete(syncRevisions).where(inArray(syncRevisions.syncRunId, [run, foreignRun]));
  await db.delete(syncRuns).where(inArray(syncRuns.id, [run, foreignRun]));
  await db.delete(dataSources).where(inArray(dataSources.id, [source, foreignSource]));
  await db
    .delete(metricDefinitions)
    .where(inArray(metricDefinitions.id, [definition, foreignDefinition]));
  await db.delete(employees).where(inArray(employees.id, [employee, otherEmployee]));
  await db.delete(organizations).where(inArray(organizations.id, [org, foreignOrg]));
});

it("exposes only authorized metric evidence, preserving zero, null and unreadable evidence", async () => {
  await db
    .insert(syncRevisions)
    .values([
      revision(snapshot()),
      revision({ ...snapshot(), numeric_value: null }),
      revision({ ...snapshot(), numeric_value: "invalid" }),
      revision({ ...snapshot(), employee_id: otherEmployee }),
      revision({ ...snapshot(), metric_definition_id: foreignDefinition }),
      revision(snapshot(), foreignRun),
      revision(snapshot(), run, "source_record"),
      revision({ ...snapshot(), period_start: "2026-09-14" }),
    ]);
  const result = await getStoredMetricRevisions(ctx, employee, start, end);
  expect(result.rows).toHaveLength(3);
  expect(result.rows.map((row) => row.evidence?.numericValue)).toEqual(
    expect.arrayContaining([0, null, undefined])
  );
  expect(result.rows.find((row) => row.evidence?.numericValue === 0)?.evidence?.observedAt).toBe(
    "2026-09-20T00:00:00+00:00"
  );
  expect(JSON.stringify(result)).not.toMatch(
    /DO NOT EXPOSE|snapshotJson|employee_id|source_record/
  );
  expect(result.hasMore).toBe(false);
  await expect(getStoredMetricRevisions(ctx, otherEmployee, start, end)).rejects.toThrow(
    "Unauthorized"
  );
  await expect(
    getStoredMetricRevisions({ ...ctx, organizationId: foreignOrg }, employee, start, end)
  ).rejects.toThrow("not permitted");
  expect((await getStoredMetricRevisions(ctx, employee, "2026-09-06", "2026-09-12")).rows).toEqual(
    []
  );
});

it("bounds newest-first evidence and explicitly reports older retained revisions", async () => {
  await db.delete(syncRevisions).where(eq(syncRevisions.syncRunId, run));
  await db.insert(syncRevisions).values(
    Array.from({ length: 26 }, (_, index) => ({
      ...revision({ ...snapshot(), numeric_value: index }),
      createdAt: new Date(Date.UTC(2026, 8, 24, 0, 0, index)),
    }))
  );
  const result = await getStoredMetricRevisions(ctx, employee, start, end);
  expect(result.hasMore).toBe(true);
  expect(result.rows).toHaveLength(25);
  expect(result.rows[0]?.evidence?.numericValue).toBe(25);
  expect(result.rows[24]?.evidence?.numericValue).toBe(1);
  await expect(getStoredMetricRevisions(ctx, employee, "2026-02-30", end)).rejects.toThrow(
    "Invalid"
  );
  await expect(getStoredMetricRevisions(ctx, employee, end, start)).rejects.toThrow("Invalid");
});

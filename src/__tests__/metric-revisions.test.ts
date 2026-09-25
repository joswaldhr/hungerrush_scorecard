// @vitest-environment node
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
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

it("preserves stored ticket revisions while withholding unverified human counts", async () => {
  const [inserted] = await db
    .insert(syncRevisions)
    .values(revision({ ...snapshot(), numeric_value: 8765 }))
    .returning();
  try {
    await db
      .update(metricDefinitions)
      .set({ key: "tickets_updated", sourceStrategy: "zendesk" })
      .where(eq(metricDefinitions.id, definition));
    const result = await getStoredMetricRevisions(ctx, employee, start, end);
    expect(result.rows.find((row) => row.id === inserted!.id)?.evidence).toMatchObject({
      numericValue: null,
      quality: "unverified_attribution",
    });
    const [stored] = await db
      .select()
      .from(syncRevisions)
      .where(eq(syncRevisions.id, inserted!.id));
    expect(stored?.snapshotJson).toMatchObject({ numeric_value: 8765, quality_status: "complete" });
  } finally {
    await db
      .update(metricDefinitions)
      .set({ key: "revision_fixture", sourceStrategy: null })
      .where(eq(metricDefinitions.id, definition));
    await db.delete(syncRevisions).where(eq(syncRevisions.id, inserted!.id));
  }
});

it("exposes only authorized metric evidence, preserving zero, null and unreadable evidence", async () => {
  await db
    .insert(syncRevisions)
    .values([
      revision({
        ...snapshot(),
        provenance_json: {
          sourceContract: "synthetic-v1",
          reportingTimeZone: "America/Chicago",
          rawPrivateSource: "DO NOT EXPOSE",
        },
      }),
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
  expect(result.rows.find((row) => row.evidence?.numericValue === 0)?.evidence).toMatchObject({
    sourceContract: "synthetic-v1",
    reportingTimeZone: "America/Chicago",
  });
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
  const older = await getStoredMetricRevisions(ctx, employee, start, end, result.nextCursor!);
  expect(older.rows.map((row) => row.evidence?.numericValue)).toEqual([0]);
  expect(older.hasMore).toBe(false);
  expect(older.nextCursor).toBeNull();
  await expect(getStoredMetricRevisions(ctx, employee, "2026-02-30", end)).rejects.toThrow(
    "Invalid"
  );
  await expect(getStoredMetricRevisions(ctx, employee, end, start)).rejects.toThrow("Invalid");
});

it("pages precisely through tied and sub-millisecond timestamps without widening scope", async () => {
  await db.delete(syncRevisions).where(eq(syncRevisions.syncRunId, run));
  const inserted = await db
    .insert(syncRevisions)
    .values(
      Array.from({ length: 52 }, (_, index) => ({
        ...revision({ ...snapshot(), numeric_value: index }),
        createdAt: sql`'2026-09-24T01:00:00.123456Z'::timestamptz + (${Math.floor(index / 2)} * interval '1 microsecond')`,
      }))
    )
    .returning({ id: syncRevisions.id });
  const first = await getStoredMetricRevisions(ctx, employee, start, end);
  // A concurrent newer correction must not shift the next page or repeat rows.
  await db
    .insert(syncRevisions)
    .values({ ...revision(snapshot()), createdAt: new Date("2026-09-25T00:00:00Z") });
  const second = await getStoredMetricRevisions(ctx, employee, start, end, first.nextCursor!);
  const third = await getStoredMetricRevisions(ctx, employee, start, end, second.nextCursor!);
  expect([first.rows.length, second.rows.length, third.rows.length]).toEqual([25, 25, 2]);
  const ids = [...first.rows, ...second.rows, ...third.rows].map((row) => row.id);
  expect(new Set(ids).size).toBe(52);
  expect(ids.sort()).toEqual(inserted.map((row) => row.id).sort());
  expect(third.nextCursor).toBeNull();
  expect(JSON.stringify(first)).not.toContain("cursorAt");
  await expect(getStoredMetricRevisions(ctx, employee, start, end, "bad")).rejects.toThrow(
    "Invalid revision cursor"
  );
  await expect(
    getStoredMetricRevisions(ctx, employee, "2026-09-06", "2026-09-12", first.nextCursor!)
  ).rejects.toThrow("Invalid revision cursor");
  await expect(
    getStoredMetricRevisions(ctx, otherEmployee, start, end, first.nextCursor!)
  ).rejects.toThrow("Unauthorized");
  const [foreign] = await db
    .insert(syncRevisions)
    .values(revision(snapshot(), foreignRun))
    .returning();
  await expect(getStoredMetricRevisions(ctx, employee, start, end, foreign!.id)).rejects.toThrow(
    "Invalid revision cursor"
  );
});

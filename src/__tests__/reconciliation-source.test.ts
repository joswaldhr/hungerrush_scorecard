// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organizations,
  users,
  employees,
  dataSources,
  sourceRecords,
  normalizedFacts,
  metricDefinitions,
  metricValues,
  reconciliationRuns,
  reconciliationResults,
} from "@/lib/db/schema";
import { runReconciliation } from "@/lib/domain/reconciliation/engine";
const org = randomUUID(),
  foreignOrg = randomUUID(),
  user = randomUUID(),
  employee = randomUUID(),
  metric = randomUUID();
const sources = Array.from({ length: 4 }, () => randomUUID()),
  records = Array.from({ length: 4 }, () => randomUUID());
const period = { periodStart: "2026-09-13", periodEnd: "2026-09-19" };
beforeAll(async () => {
  await db.insert(organizations).values([
    { id: org, name: "Synthetic source reconciliation" },
    { id: foreignOrg, name: "Foreign source fixture" },
  ]);
  await db.insert(users).values({
    id: user,
    organizationId: org,
    email: `${user}@example.test`,
    displayName: "Synthetic manager",
  });
  await db
    .insert(employees)
    .values({ id: employee, organizationId: org, displayName: "Synthetic employee" });
  await db.insert(dataSources).values(
    sources.map((id, i) => ({
      id,
      organizationId: i === 3 ? foreignOrg : org,
      type: i === 2 ? "staging" : "zendesk",
      displayName: "Synthetic source",
    }))
  );
  await db.insert(sourceRecords).values(
    records.map((id, i) => ({
      id,
      dataSourceId: sources[i]!,
      externalRecordType: "fixture",
      externalRecordId: id,
      payloadJson: {},
      payloadHash: "synthetic",
    }))
  );
  // The final row intentionally exercises a cross-organization FK inconsistency.
  await db.insert(normalizedFacts).values(
    records.map((id, i) => ({
      organizationId: org,
      employeeId: employee,
      dataSourceId: sources[i]!,
      sourceRecordId: id,
      factType: "source_fixture",
      numericValue: (i + 1) * 10,
      sourceObservedAt: new Date("2026-09-20T00:00:00Z"),
      ...period,
    }))
  );
  await db.insert(metricDefinitions).values({
    id: metric,
    organizationId: org,
    key: "source_fixture",
    name: "Synthetic source count",
    valueType: "count",
    sourceStrategy: "zendesk",
    calculationType: "sum",
  });
  await db.insert(metricValues).values({
    metricDefinitionId: metric,
    employeeId: employee,
    numericValue: 10,
    provenanceJson: { dataSourceId: sources[0] },
    ...period,
  });
});
afterAll(async () => {
  const runs = db
    .select({ id: reconciliationRuns.id })
    .from(reconciliationRuns)
    .where(eq(reconciliationRuns.organizationId, org));
  await db
    .delete(reconciliationResults)
    .where(inArray(reconciliationResults.reconciliationRunId, runs));
  await db.delete(reconciliationRuns).where(eq(reconciliationRuns.organizationId, org));
  await db.delete(metricValues).where(eq(metricValues.metricDefinitionId, metric));
  await db.delete(metricDefinitions).where(eq(metricDefinitions.id, metric));
  await db.delete(normalizedFacts).where(eq(normalizedFacts.organizationId, org));
  await db.delete(sourceRecords).where(inArray(sourceRecords.id, records));
  await db.delete(dataSources).where(inArray(dataSources.id, sources));
  await db.delete(employees).where(eq(employees.id, employee));
  await db.delete(users).where(eq(users.id, user));
  await db.delete(organizations).where(inArray(organizations.id, [org, foreignOrg]));
});
async function compare(provenance: unknown) {
  await db
    .update(metricValues)
    .set({ provenanceJson: provenance })
    .where(eq(metricValues.metricDefinitionId, metric));
  await db
    .update(reconciliationRuns)
    .set({ startedAt: sql`now() - interval '6 minutes'` })
    .where(eq(reconciliationRuns.organizationId, org));
  const run = await runReconciliation({
    organizationId: org,
    triggeredBy: user,
    employeeIds: [employee],
    ...period,
  });
  const [result] = await db
    .select()
    .from(reconciliationResults)
    .where(eq(reconciliationResults.reconciliationRunId, run.runId));
  return result!;
}
it("reconciles the declared source without mixing sibling, different-type or foreign sources", async () => {
  expect(await compare({ dataSourceId: sources[0] })).toMatchObject({
    status: "match",
    cadenceValue: 10,
    sourceValue: 10,
    notes: null,
  });
  expect(await compare({ dataSourceId: sources[1] })).toMatchObject({
    status: "mismatch",
    cadenceValue: 10,
    sourceValue: 20,
  });
});
it("refuses invalid/foreign source claims and ambiguous legacy provenance", async () => {
  for (const provenance of [
    { dataSourceId: sources[3] },
    { dataSourceId: sources[2] },
    { dataSourceId: randomUUID() },
    {},
    { dataSourceId: sources[0], sourceStrategy: "staging" },
  ])
    expect(await compare(provenance)).toMatchObject({
      status: "source_missing",
      sourceValue: null,
      notes: expect.stringContaining("source instance"),
    });
});
it("permits an unambiguous legacy source but never replaces a malformed explicit source claim", async () => {
  await db.update(dataSources).set({ type: "staging" }).where(eq(dataSources.id, sources[1]!));
  expect(await compare({ sourceStrategy: "zendesk" })).toMatchObject({
    status: "match",
    sourceValue: 10,
  });
  for (const provenance of [{ dataSourceId: null }, { dataSourceId: 123 }, [], "invalid"])
    expect(await compare(provenance)).toMatchObject({
      status: "source_missing",
      sourceValue: null,
    });
});

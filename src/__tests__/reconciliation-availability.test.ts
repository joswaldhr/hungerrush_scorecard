// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organizations,
  users,
  employees,
  metricDefinitions,
  reconciliationRuns,
  reconciliationResults,
} from "@/lib/db/schema";
import type { ManagerContext } from "@/lib/auth/authorization";
import {
  getScopedReconciliationRun,
  getScopedReconciliationRuns,
} from "@/lib/domain/reconciliation/queries";
vi.mock("@/lib/auth", () => ({
  auth: async () => ({ user: { email: "synthetic@example.test" } }),
}));
vi.mock("@/lib/auth/authorization", () => ({ getEffectiveManagerContext: async () => ({ ctx }) }));
import { GET } from "@/app/api/reconciliation/results/route";

const org = randomUUID(),
  foreignOrg = randomUUID(),
  user = randomUUID(),
  employee = randomUUID(),
  coworker = randomUUID(),
  foreignEmployee = randomUUID(),
  runId = randomUUID();
const metrics = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const ctx: ManagerContext = {
  organizationId: org,
  userId: user,
  assignedEmployeeIds: [employee],
  assignedTeamIds: [],
};
beforeAll(async () => {
  await db.insert(organizations).values([
    { id: org, name: "Synthetic reconciliation" },
    { id: foreignOrg, name: "Foreign synthetic reconciliation" },
  ]);
  await db.insert(users).values({
    id: user,
    organizationId: org,
    email: `${user}@example.test`,
    displayName: "Synthetic manager",
  });
  await db.insert(employees).values([
    { id: employee, organizationId: org, displayName: "Assigned fixture" },
    { id: coworker, organizationId: org, displayName: "Unassigned fixture" },
    { id: foreignEmployee, organizationId: foreignOrg, displayName: "Foreign fixture" },
  ]);
  await db.insert(metricDefinitions).values(
    metrics.map((id, index) => ({
      id,
      organizationId: index === 3 ? foreignOrg : org,
      key: ["tickets_updated", "tickets_resolved", "test_count", "foreign_count"][index]!,
      name: "Synthetic metric",
      sourceStrategy: "zendesk",
      valueType: "count",
    }))
  );
  await db.insert(reconciliationRuns).values({
    id: runId,
    organizationId: org,
    triggeredBy: user,
    periodStart: "2026-09-13",
    periodEnd: "2026-09-19",
    status: "completed",
    totalComparisons: 6,
    matchCount: 6,
  });
  await db.insert(reconciliationResults).values(
    [
      { metric: 0, employee, value: 0 },
      { metric: 1, employee, value: 918273 },
      { metric: 2, employee, value: 5 },
      { metric: 2, employee: coworker, value: 99 },
      { metric: 3, employee, value: 55 },
      { metric: 2, employee: foreignEmployee, value: 66 },
    ].map((row) => ({
      reconciliationRunId: runId,
      metricDefinitionId: metrics[row.metric]!,
      employeeId: row.employee,
      metricKey: ["tickets_updated", "tickets_resolved", "test_count", "foreign_count"][
        row.metric
      ]!,
      factType: "fixture",
      periodStart: "2026-09-13",
      periodEnd: "2026-09-19",
      cadenceValue: row.value,
      sourceValue: row.value,
      absoluteDelta: 0,
      relativeDeltaPct: 0,
      status: "match",
      cadenceCalculationVersion: 999,
      notes: "Raw diagnostic evidence",
    }))
  );
});
afterAll(async () => {
  await db
    .delete(reconciliationResults)
    .where(eq(reconciliationResults.reconciliationRunId, runId));
  await db.delete(reconciliationRuns).where(eq(reconciliationRuns.id, runId));
  await db.delete(metricDefinitions).where(inArray(metricDefinitions.id, metrics));
  await db.delete(employees).where(inArray(employees.id, [employee, coworker, foreignEmployee]));
  await db.delete(users).where(eq(users.id, user));
  await db.delete(organizations).where(inArray(organizations.id, [org, foreignOrg]));
});
it("withholds unverified ticket comparisons and recalculates visible list/detail counts without changing evidence", async () => {
  const detail = await getScopedReconciliationRun(ctx, runId);
  expect(detail?.run).toMatchObject({ totalComparisons: 3, matchCount: 1, unavailableCount: 2 });
  const withheld = detail!.results.filter((row) => row.metricKey.startsWith("tickets_"));
  expect(withheld).toHaveLength(2);
  for (const row of withheld)
    expect(row).toMatchObject({
      cadenceValue: null,
      sourceValue: null,
      absoluteDelta: null,
      relativeDeltaPct: null,
      notes: null,
      status: "unverified_attribution",
      unavailableReason: "Human activity attribution has not been verified.",
      employeeName: "Assigned fixture",
    });
  expect(detail!.results.find((row) => row.metricKey === "test_count")?.cadenceValue).toBe(5);
  expect((await getScopedReconciliationRuns(ctx))[0]).toMatchObject({
    matchCount: 1,
    unavailableCount: 2,
    totalComparisons: 3,
  });
  const stored = await db
    .select()
    .from(reconciliationResults)
    .where(eq(reconciliationResults.reconciliationRunId, runId));
  expect(stored).toHaveLength(6);
  expect(stored.find((row) => row.metricKey === "tickets_resolved")?.cadenceValue).toBe(918273);
});
it("applies withholding to the manager results API", async () => {
  const response = await GET(
    new Request(`https://test.invalid/api/reconciliation/results?runId=${runId}`)
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.run.unavailableCount).toBe(2);
  expect(
    body.results.find((row: { metricKey: string }) => row.metricKey === "tickets_resolved")
      .cadenceValue
  ).toBeNull();
  expect(JSON.stringify(body)).not.toContain("918273");
});
it.each(["running", "failed"])(
  "withholds legacy partial comparison rows from a %s run",
  async (status) => {
    await db.update(reconciliationRuns).set({ status }).where(eq(reconciliationRuns.id, runId));
    try {
      expect(await getScopedReconciliationRun(ctx, runId)).toMatchObject({
        run: { totalComparisons: 0, matchCount: 0, unavailableCount: 0 },
        results: [],
      });
      expect((await getScopedReconciliationRuns(ctx))[0]).toMatchObject({
        totalComparisons: 0,
        matchCount: 0,
      });
    } finally {
      await db
        .update(reconciliationRuns)
        .set({ status: "completed" })
        .where(eq(reconciliationRuns.id, runId));
    }
  }
);
it("rejects malformed run IDs and foreign employee/definition associations", async () => {
  expect(await getScopedReconciliationRun(ctx, "not-a-uuid")).toBeNull();
  const detail = await getScopedReconciliationRun(
    { ...ctx, assignedEmployeeIds: [employee, foreignEmployee] },
    runId
  );
  expect(detail?.results).toHaveLength(3);
  expect(detail?.results.every((row) => row.employeeId === employee)).toBe(true);
  expect(
    await getScopedReconciliationRun({ ...ctx, organizationId: foreignOrg }, runId)
  ).toBeNull();
});

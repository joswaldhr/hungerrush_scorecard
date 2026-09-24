// @vitest-environment node
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organizations,
  users,
  employees,
  metricDefinitions,
  reconciliationRuns,
  reconciliationResults,
} from "@/lib/db/schema";
import { runReconciliation } from "@/lib/domain/reconciliation/engine";

it("rolls back prior result batches when a later insert fails, then publishes a complete retry", async () => {
  const organizationId = randomUUID(),
    userId = randomUUID(),
    metricId = randomUUID();
  const employeeIds = Array.from({ length: 101 }, () => randomUUID());
  const failureName = `recon_failure_${organizationId.replaceAll("-", "")}`;
  const fn = sql.identifier(failureName);
  let triggerInstalled = false,
    functionInstalled = false;
  await db
    .insert(organizations)
    .values({ id: organizationId, name: "Synthetic atomic reconciliation" });
  try {
    await db.insert(users).values({
      id: userId,
      organizationId,
      email: `${userId}@example.test`,
      displayName: "Synthetic manager",
    });
    await db
      .insert(employees)
      .values(
        employeeIds.map((id) => ({ id, organizationId, displayName: "Synthetic comparison" }))
      );
    await db.insert(metricDefinitions).values({
      id: metricId,
      organizationId,
      key: "atomic_fixture",
      name: "Synthetic comparison",
      valueType: "count",
      sourceStrategy: "staging",
    });
    // Real PostgreSQL failure on the second 100-row batch, scoped to this fixture only.
    await db.execute(sql`create function ${fn}() returns trigger language plpgsql as $$
      begin
        if exists (select 1 from reconciliation_runs where id = NEW.reconciliation_run_id and organization_id = TG_ARGV[0]::uuid) then
          if (select count(*) from reconciliation_results where reconciliation_run_id = NEW.reconciliation_run_id) >= 100 then
            raise exception 'Synthetic reconciliation batch interruption';
          end if;
        end if;
        return NEW;
      end;
    $$`);
    functionInstalled = true;
    // The literal is generated locally as a UUID; no request/vendor input enters this DDL.
    await db.execute(
      sql`create trigger ${fn} before insert on reconciliation_results for each row execute function ${fn}(${sql.raw(`'${organizationId}'`)})`
    );
    triggerInstalled = true;
    const params = {
      organizationId,
      triggeredBy: userId,
      employeeIds,
      periodStart: "2026-09-13",
      periodEnd: "2026-09-19",
    };
    let failure: unknown;
    try {
      await runReconciliation(params);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    let cause = failure as Error;
    while (cause.cause instanceof Error) cause = cause.cause;
    expect(cause.message).toContain("Synthetic reconciliation batch interruption");
    const [failed] = await db
      .select()
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.organizationId, organizationId));
    expect(failed).toMatchObject({ status: "failed", totalComparisons: 0 });
    expect(failed!.completedAt).not.toBeNull();
    expect(
      await db
        .select()
        .from(reconciliationResults)
        .where(eq(reconciliationResults.reconciliationRunId, failed!.id))
    ).toHaveLength(0);

    await db.execute(sql`drop trigger ${fn} on reconciliation_results`);
    triggerInstalled = false;
    await db.execute(sql`drop function ${fn}()`);
    functionInstalled = false;
    await db
      .update(reconciliationRuns)
      .set({ startedAt: sql`now() - interval '6 minutes'` })
      .where(eq(reconciliationRuns.id, failed!.id));
    const completed = await runReconciliation(params);
    expect(completed).toMatchObject({ totalComparisons: 101, sourceMissingCount: 101 });
    expect(
      await db
        .select()
        .from(reconciliationResults)
        .where(eq(reconciliationResults.reconciliationRunId, completed.runId))
    ).toHaveLength(101);
    const [saved] = await db
      .select()
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.id, completed.runId));
    expect(saved).toMatchObject({
      status: "completed",
      totalComparisons: 101,
      sourceMissingCount: 101,
    });
  } finally {
    if (triggerInstalled) await db.execute(sql`drop trigger ${fn} on reconciliation_results`);
    if (functionInstalled) await db.execute(sql`drop function ${fn}()`);
    const runs = db
      .select({ id: reconciliationRuns.id })
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.organizationId, organizationId));
    await db
      .delete(reconciliationResults)
      .where(sql`${reconciliationResults.reconciliationRunId} in (${runs})`);
    await db
      .delete(reconciliationRuns)
      .where(eq(reconciliationRuns.organizationId, organizationId));
    await db.delete(metricDefinitions).where(eq(metricDefinitions.id, metricId));
    await db.delete(employees).where(eq(employees.organizationId, organizationId));
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
  }
});

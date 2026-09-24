// @vitest-environment node
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, users, reconciliationRuns } from "@/lib/db/schema";
import {
  runReconciliation,
  ReconciliationRateLimitError,
} from "@/lib/domain/reconciliation/engine";

it("atomically claims one reconciliation per cooldown and permits a later run", async () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  await db.insert(organizations).values({ id: organizationId, name: "Synthetic claim test" });
  try {
    await db.insert(users).values({
      id: userId,
      organizationId,
      email: `${userId}@example.test`,
      displayName: "Synthetic manager",
    });
    const params = {
      organizationId,
      triggeredBy: userId,
      employeeIds: [],
      periodStart: "2026-09-13",
      periodEnd: "2026-09-19",
    };
    for (const invalid of [
      { periodStart: "2026-02-30" },
      { periodEnd: "2026-09-12" },
      { thresholdPct: Infinity },
    ]) {
      await expect(runReconciliation({ ...params, ...invalid })).rejects.toThrow();
    }
    expect(
      await db
        .select()
        .from(reconciliationRuns)
        .where(eq(reconciliationRuns.organizationId, organizationId))
    ).toHaveLength(0);
    const results = await Promise.allSettled([
      runReconciliation(params),
      runReconciliation(params),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(
      ReconciliationRateLimitError
    );
    expect(
      await db
        .select()
        .from(reconciliationRuns)
        .where(eq(reconciliationRuns.organizationId, organizationId))
    ).toHaveLength(1);
    await db
      .update(reconciliationRuns)
      .set({ startedAt: sql`now() - interval '6 minutes'` })
      .where(eq(reconciliationRuns.organizationId, organizationId));
    await expect(runReconciliation(params)).resolves.toMatchObject({ totalComparisons: 0 });
  } finally {
    await db
      .delete(reconciliationRuns)
      .where(eq(reconciliationRuns.organizationId, organizationId));
    await db.delete(users).where(eq(users.organizationId, organizationId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
  }
});

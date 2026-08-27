import { runReconciliation } from "@/lib/domain/reconciliation";
import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const ORG_ID = "10000000-0000-4000-8000-000000000001";

function weekDates() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    periodStart: monday.toISOString().split("T")[0]!,
    periodEnd: sunday.toISOString().split("T")[0]!,
  };
}

async function main() {
  const { periodStart, periodEnd } = weekDates();
  // This is a trusted ops/QA CLI (see docs/BUILD_SPEC.md's Phase 9), not the
  // manager-facing path — it deliberately compares every employee in the org.
  const orgEmployees = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.organizationId, ORG_ID));

  const result = await runReconciliation({
    organizationId: ORG_ID,
    triggeredBy: "30000000-0000-4000-8000-000000000001",
    employeeIds: orgEmployees.map((e) => e.id),
    periodStart,
    periodEnd,
  });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

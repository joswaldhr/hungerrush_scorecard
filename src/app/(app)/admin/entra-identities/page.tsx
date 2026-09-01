import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { employees, externalIdentities, dataSources } from "@/lib/db/schema";
import { eq, and, isNotNull, notInArray } from "drizzle-orm";
import { EmptyState } from "@/components/empty-state";
import { CheckCircle2 } from "lucide-react";
import { EntraMatchCard } from "./entra-match-card";

export default async function EntraIdentitiesPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  if (!(await isPlatformAdmin(session.user.email))) redirect("/");

  const [entraSource] = await db.select().from(dataSources).where(eq(dataSources.type, "entra"));

  if (!entraSource) {
    return (
      <div className="max-w-2xl">
        <EmptyState
          title="Entra not configured"
          description="No Entra data source is set up yet."
        />
      </div>
    );
  }

  const handledEmployeeIds = (
    await db
      .select({ employeeId: externalIdentities.employeeId })
      .from(externalIdentities)
      .where(
        and(
          eq(externalIdentities.dataSourceId, entraSource.id),
          isNotNull(externalIdentities.verifiedAt)
        )
      )
  ).map((r) => r.employeeId);

  const unmatchedEmployees = await db
    .select()
    .from(employees)
    .where(
      handledEmployeeIds.length > 0
        ? and(
            eq(employees.employmentStatus, "active"),
            notInArray(employees.id, handledEmployeeIds)
          )
        : eq(employees.employmentStatus, "active")
    );

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Entra Identities</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Match each active employee to their real Entra account once, by name — never guessed by
          email, since Zendesk/Assembled emails have been found to drift from the real Entra
          address. Once matched, the daily check flags anyone whose account gets disabled.
        </p>
      </header>

      {unmatchedEmployees.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="All active employees matched"
          description="Every active employee has a confirmed Entra identity (or a confirmed no-match)."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {unmatchedEmployees.length} employee{unmatchedEmployees.length === 1 ? "" : "s"} left to
            match
          </p>
          {unmatchedEmployees.map((e) => (
            <EntraMatchCard key={e.id} employeeId={e.id} displayName={e.displayName} />
          ))}
        </div>
      )}
    </div>
  );
}

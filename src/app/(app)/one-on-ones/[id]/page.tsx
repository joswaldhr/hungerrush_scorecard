import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getEffectiveManagerContext, getAssignedEmployees } from "@/lib/auth/authorization";
import { getEmployeeMetrics } from "@/lib/domain/metrics/queries";
import { EmptyState } from "@/components/empty-state";
import { ScorecardBody } from "@/components/scorecard-body";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { teams, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolveReportingWeek, shiftWeekStart } from "@/lib/utils";

export default async function OneOnOnePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { id } = await params;
  const { week: weekParam } = await searchParams;
  // Normalize to the containing Sunday-Saturday week, whether the value came
  // from the calendar picker (already a Sunday) or a hand-edited URL.
  const periodStart = resolveReportingWeek(weekParam);

  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const { ctx, isPlatformAdmin } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) redirect(isPlatformAdmin ? "/admin" : "/");

  const employees = await getAssignedEmployees(ctx);
  const employee = employees.find((e) => e.id === id);
  if (!employee) notFound();

  const teamId = employee.primaryTeamId;
  if (!teamId) {
    return (
      <EmptyState
        icon={Users}
        title="No team"
        description="This employee is not assigned to a team."
      />
    );
  }

  const team = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .then((r) => r[0]);
  const managerUser = ctx.userId
    ? await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .then((r) => r[0])
    : null;

  const previousPeriodStart = shiftWeekStart(periodStart, -1);
  const rows = await getEmployeeMetrics(ctx, employee.id, teamId, periodStart, previousPeriodStart);

  return (
    <div className="max-w-5xl mx-auto space-y-6 print:space-y-2 pb-12">
      <div className="print:hidden">
        <Link
          href="/one-on-ones"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to 1:1s</span>
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No metrics assigned"
          description="This team doesn't have any metrics configured yet."
        />
      ) : (
        <ScorecardBody
          key={employee.id}
          employeeId={employee.id}
          employeeName={employee.displayName}
          employeeJobTitle={employee.jobTitle}
          teamName={team?.name ?? "Team"}
          managerName={managerUser?.displayName ?? null}
          initialPeriodStart={periodStart}
          initialRows={rows}
        />
      )}
    </div>
  );
}

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getEffectiveManagerContext,
  getAssignedTeams,
  getAssignedEmployees,
} from "@/lib/auth/authorization";
import { getEmployeeMetricsBatch } from "@/lib/domain/metrics/queries";
import { deriveOverallStatus } from "@/lib/domain/briefings/generate";
import { db } from "@/lib/db";
import { meetingReferences } from "@/lib/db/schema";
import { and, eq, gte, asc, inArray } from "drizzle-orm";
import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ShieldAlert, Users, Calendar } from "lucide-react";
import Link from "next/link";
import { initials, weekDates } from "@/lib/utils";

const STATUS_DOT: Record<string, string> = {
  on_track: "bg-status-on-track",
  mixed: "bg-status-watch",
  needs_attention: "bg-status-attention",
  no_data: "bg-muted-foreground/40",
};

export default async function OneOnOnesPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const { ctx, isPlatformAdmin } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) {
    if (isPlatformAdmin) redirect("/admin");
    return <EmptyState icon={ShieldAlert} title="No access" description="You are not assigned as a manager." />;
  }

  const allTeams = await getAssignedTeams(ctx);
  const employees = await getAssignedEmployees(ctx);
  if (allTeams.length === 0) {
    return <EmptyState icon={Users} title="No teams" description="No teams assigned." />;
  }

  const { periodStart, previousPeriodStart } = weekDates();

  const upcomingByEmployee = new Map<string, Date>();
  if (ctx.assignedEmployeeIds.length > 0) {
    const upcoming = await db
      .select({
        employeeId: meetingReferences.employeeId,
        scheduledStart: meetingReferences.scheduledStart,
      })
      .from(meetingReferences)
      .where(
        and(
          eq(meetingReferences.managerUserId, ctx.userId),
          inArray(meetingReferences.employeeId, ctx.assignedEmployeeIds),
          gte(meetingReferences.scheduledStart, new Date())
        )
      )
      .orderBy(asc(meetingReferences.scheduledStart));

    for (const m of upcoming) {
      if (!upcomingByEmployee.has(m.employeeId)) {
        upcomingByEmployee.set(m.employeeId, m.scheduledStart);
      }
    }
  }

  const employeesByTeam = new Map<string, typeof employees>();
  for (const emp of employees) {
    if (!emp.primaryTeamId) continue;
    const forTeam = employeesByTeam.get(emp.primaryTeamId) ?? [];
    forTeam.push(emp);
    employeesByTeam.set(emp.primaryTeamId, forTeam);
  }

  const statusByEmployee = new Map<string, string>();
  await Promise.all(
    Array.from(employeesByTeam.entries()).map(async ([teamId, teamEmps]) => {
      const batch = await getEmployeeMetricsBatch(
        ctx,
        teamEmps.map((e) => e.id),
        teamId,
        periodStart,
        previousPeriodStart
      );
      for (const [employeeId, metrics] of batch) {
        statusByEmployee.set(employeeId, deriveOverallStatus(metrics));
      }
    })
  );

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">1:1 Preparation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What do I need to know before I meet this person?
        </p>
      </header>

      {allTeams.map((team) => {
        const teamEmployees = employees.filter((e) => e.primaryTeamId === team.id);
        return (
          <section key={team.id} className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">{team.name}</h2>
            {teamEmployees.length === 0 ? (
              <EmptyState icon={Users} title="No employees" description="No employees on this team." />
            ) : (
              <div className="divide-y divide-border rounded-lg border">
                {teamEmployees.map((employee) => {
                  const nextMeeting = upcomingByEmployee.get(employee.id);
                  const status = statusByEmployee.get(employee.id) ?? "no_data";
                  return (
                    <Link
                      key={employee.id}
                      href={`/one-on-ones/${employee.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50"
                    >
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-[10px]">
                            {initials(employee.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${STATUS_DOT[status] ?? STATUS_DOT.no_data}`}
                          title={status.replace(/_/g, " ")}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{employee.displayName}</p>
                        {employee.jobTitle && (
                          <p className="text-xs text-muted-foreground">{employee.jobTitle}</p>
                        )}
                      </div>
                      {nextMeeting && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" aria-hidden="true" />
                          {nextMeeting.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                      <span className="shrink-0 text-xs text-accent">Prepare →</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

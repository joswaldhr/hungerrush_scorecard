import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getEffectiveManagerContext,
  getAssignedTeams,
  getAssignedEmployees,
} from "@/lib/auth/authorization";
import { getEmployeeMetricsBatch } from "@/lib/domain/metrics/queries";
import {
  deriveOverallStatus,
  getStalenessSignals,
  getCadenceGapDays,
  STALE_MEETING_CADENCE_DAYS,
} from "@/lib/domain/briefings/generate";
import { db } from "@/lib/db";
import { meetingReferences } from "@/lib/db/schema";
import { and, eq, gte, asc, inArray } from "drizzle-orm";
import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { ShieldAlert, Users, Calendar, AlertTriangle, ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { initials, weekDates } from "@/lib/utils";

export default async function OneOnOnesPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const { ctx, isPlatformAdmin } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) {
    if (isPlatformAdmin) redirect("/admin");
    return (
      <EmptyState
        icon={ShieldAlert}
        title="No access"
        description="You are not assigned as a manager."
      />
    );
  }

  const allTeams = await getAssignedTeams(ctx);
  const employees = await getAssignedEmployees(ctx);
  if (allTeams.length === 0) {
    return <EmptyState icon={Users} title="No teams" description="No teams assigned." />;
  }

  const { periodStart, previousPeriodStart } = weekDates();
  const now = new Date();

  const stalenessSignals = await getStalenessSignals(ctx.assignedEmployeeIds);

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

  const statusByEmployee = new Map<string, "on_track" | "mixed" | "needs_attention" | "no_data">();
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
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <header>
        <h1 className="text-2xl sm:text-[28px] font-bold text-foreground tracking-tight">
          1:1 Preparation
        </h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Prepare for upcoming one-on-ones, review metric trends, and follow up on commitments.
        </p>
      </header>

      {allTeams.map((team) => {
        const teamEmployees = employees.filter((e) => e.primaryTeamId === team.id);
        return (
          <div key={team.id} className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
              {team.name}
            </h2>
            {teamEmployees.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No employees"
                description="No employees on this team."
              />
            ) : (
              <Card className="overflow-hidden">
                <div className="divide-y divide-border/70">
                  {teamEmployees.map((employee) => {
                    const nextMeeting = upcomingByEmployee.get(employee.id);
                    const status = statusByEmployee.get(employee.id) ?? "no_data";
                    const cadenceGapDays = getCadenceGapDays(employee.id, stalenessSignals, now);
                    const cadenceStale =
                      cadenceGapDays === null || cadenceGapDays >= STALE_MEETING_CADENCE_DAYS;
                    return (
                      <Link
                        key={employee.id}
                        href={`/one-on-ones/${employee.id}`}
                        className="flex flex-wrap items-center justify-between gap-4 p-4 sm:px-6 hover:bg-muted/30 transition-colors group"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <Avatar className="h-10 w-10 ring-1 ring-border shrink-0">
                            <AvatarFallback className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-foreground">
                              {initials(employee.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground group-hover:text-[#009ca6] transition-colors truncate">
                              {employee.displayName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {employee.jobTitle ?? "Support Specialist"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 sm:gap-6">
                          <StatusBadge status={status} />

                          {cadenceStale && (
                            <span
                              className="flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-400"
                              title={
                                cadenceGapDays === null
                                  ? "No 1:1 on record"
                                  : `No 1:1 recorded in ${cadenceGapDays} days`
                              }
                            >
                              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                              <span>
                                {cadenceGapDays === null ? "No 1:1 yet" : `${cadenceGapDays}d gap`}
                              </span>
                            </span>
                          )}

                          {nextMeeting ? (
                            <div className="text-right text-xs">
                              <p className="font-semibold text-foreground flex items-center justify-end gap-1">
                                <Calendar className="h-3.5 w-3.5 text-[#009ca6]" />
                                <span>
                                  {nextMeeting.toLocaleDateString("en-US", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              </p>
                              <p className="text-[11px] text-muted-foreground flex items-center justify-end gap-1 mt-0.5">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {nextMeeting.toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No meeting set</span>
                          )}

                          <div className="flex items-center gap-1 text-xs font-bold text-[#009ca6] group-hover:translate-x-0.5 transition-transform">
                            <span className="hidden sm:inline">Prepare</span>
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        );
      })}
    </div>
  );
}

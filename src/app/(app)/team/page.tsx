import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getEffectiveManagerContext,
  getAssignedTeams,
  getAssignedEmployees,
} from "@/lib/auth/authorization";
import { getEmployeeMetricsBatch, getMetricHistoryBatch } from "@/lib/domain/metrics/queries";
import { db } from "@/lib/db";
import { syncRuns, dataSources, meetingReferences } from "@/lib/db/schema";
import { eq, desc, and, inArray, gte, asc } from "drizzle-orm";
import { DataFreshness } from "@/components/data-freshness";
import { EmptyState } from "@/components/empty-state";
import { TeamRosterTable } from "@/components/team-roster-table";
import { StatCard } from "@/components/stat-card";
import { Users, CheckCircle2, Eye, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { cn, weekDates } from "@/lib/utils";
import { deriveOverallStatus } from "@/lib/domain/briefings/generate";
import type { RosterRow } from "@/components/team-roster-table";
import type { EmployeeMetricRow } from "@/lib/domain/metrics/queries";

function findKeyChange(metrics: EmployeeMetricRow[]): { name: string; pct: number } | null {
  let best: { name: string; pct: number } | null = null;
  for (const m of metrics) {
    if (m.currentValue === null || m.previousValue === null || m.previousValue === 0) continue;
    const pct = ((m.currentValue - m.previousValue) / Math.abs(m.previousValue)) * 100;
    if (best === null || Math.abs(pct) > Math.abs(best.pct)) {
      best = { name: m.name, pct };
    }
  }
  return best;
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team: teamParam } = await searchParams;
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const { ctx, isPlatformAdmin } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) {
    if (isPlatformAdmin) redirect("/admin");
    return <EmptyState title="No access" description="You are not assigned as a manager." />;
  }

  const allTeams = await getAssignedTeams(ctx);
  const employees = await getAssignedEmployees(ctx);
  if (allTeams.length === 0) {
    return <EmptyState title="No teams" description="No teams assigned." />;
  }

  const selectedTeamId = teamParam && allTeams.some((t) => t.id === teamParam) ? teamParam : null;
  const visibleTeams = selectedTeamId ? allTeams.filter((t) => t.id === selectedTeamId) : allTeams;

  const { periodStart, previousPeriodStart, now } = weekDates();

  const [latestSync] = await db
    .select({ completedAt: syncRuns.completedAt })
    .from(syncRuns)
    .innerJoin(dataSources, eq(syncRuns.dataSourceId, dataSources.id))
    .where(eq(dataSources.organizationId, ctx.organizationId))
    .orderBy(desc(syncRuns.completedAt))
    .limit(1);

  const freshnessAt = latestSync?.completedAt?.toISOString() ?? null;

  const upcomingByEmployee = new Map<string, string>();
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
        upcomingByEmployee.set(m.employeeId, m.scheduledStart.toISOString());
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

  const metricsByEmployee = new Map<string, EmployeeMetricRow[]>();
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
        metricsByEmployee.set(employeeId, metrics);
      }
    })
  );

  const primaryByEmployee = new Map<string, EmployeeMetricRow | null>();
  for (const emp of employees) {
    const metrics = metricsByEmployee.get(emp.id) ?? [];
    primaryByEmployee.set(emp.id, metrics.find((m) => m.isPrimary) ?? metrics[0] ?? null);
  }

  const historyRequests = employees
    .map((emp) => {
      const primary = primaryByEmployee.get(emp.id);
      return primary ? { employeeId: emp.id, metricDefinitionId: primary.definitionId } : null;
    })
    .filter((r): r is { employeeId: string; metricDefinitionId: string } => r !== null);

  const historyByRequest = await getMetricHistoryBatch(ctx, historyRequests, 4);

  const employeeData = employees.map((emp) => {
    const teamId = emp.primaryTeamId ?? null;
    const metrics = metricsByEmployee.get(emp.id) ?? [];
    const primary = primaryByEmployee.get(emp.id) ?? null;
    const trend = primary
      ? (historyByRequest.get(`${emp.id}:${primary.definitionId}`) ?? [])
          .slice()
          .reverse()
          .map((v) => v.numericValue)
      : [];
    const overallStatus = deriveOverallStatus(metrics);
    return { employee: emp, metrics, teamId, primary, trend, overallStatus };
  });

  return (
    <div className="max-w-6xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">How is everyone doing?</p>
        <DataFreshness freshnessAt={freshnessAt} now={now} className="mt-2" />
      </header>

      {/* Team selector — only if multiple teams */}
      {allTeams.length > 1 && (
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5 text-xs">
          <Link
            href="/team"
            aria-pressed={!selectedTeamId}
            className={cn(
              "rounded px-2.5 py-1",
              !selectedTeamId
                ? "bg-accent/10 text-accent"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All Teams
          </Link>
          {allTeams.map((t) => (
            <Link
              key={t.id}
              href={`/team?team=${t.id}`}
              aria-pressed={selectedTeamId === t.id}
              className={cn(
                "rounded px-2.5 py-1",
                selectedTeamId === t.id
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}

      {visibleTeams.map((team) => {
        const teamEmps = employeeData.filter((d) => d.teamId === team.id);
        const onTrack = teamEmps.filter((d) => d.overallStatus === "on_track").length;
        const watch = teamEmps.filter((d) => d.overallStatus === "mixed").length;
        const needsAttention = teamEmps.filter((d) => d.overallStatus === "needs_attention").length;

        const rows: RosterRow[] = teamEmps.map(
          ({ employee, metrics, primary, trend, overallStatus }) => {
            const keyChangeRaw = findKeyChange(metrics);
            const keyChange = keyChangeRaw
              ? {
                  name: keyChangeRaw.name,
                  pct: keyChangeRaw.pct,
                  improved: metrics.some(
                    (m) =>
                      m.name === keyChangeRaw.name &&
                      ((m.direction === "higher_is_better" && keyChangeRaw.pct > 0) ||
                        (m.direction === "lower_is_better" && keyChangeRaw.pct < 0))
                  ),
                }
              : null;

            return {
              employeeId: employee.id,
              displayName: employee.displayName,
              jobTitle: employee.jobTitle,
              overallStatus,
              keyChange,
              metricsOnTarget: metrics.filter((m) => m.status.status === "on_target").length,
              metricsOffTarget: metrics.filter((m) => m.status.status === "off_target").length,
              metricsNoData: metrics.filter((m) => m.status.status === "no_data").length,
              metricsTotal: metrics.length,
              trend,
              trendDirection: primary?.direction ?? "neutral",
              upcomingMeetingAt: upcomingByEmployee.get(employee.id) ?? null,
            };
          }
        );

        return (
          <section key={team.id} className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">{team.name}</h2>

            {/* Summary stats bar */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                icon={Users}
                iconClassName="bg-muted text-foreground"
                value={teamEmps.length}
                label="Employees"
              />
              <StatCard
                icon={CheckCircle2}
                iconClassName="bg-status-on-track-bg text-status-on-track"
                value={onTrack}
                label="On Track"
              />
              <StatCard
                icon={Eye}
                iconClassName="bg-status-watch-bg text-status-watch"
                value={watch}
                label="Watch"
              />
              <StatCard
                icon={AlertTriangle}
                iconClassName="bg-status-attention-bg text-status-attention"
                value={needsAttention}
                label="Needs Attention"
              />
            </div>

            {rows.length === 0 ? (
              <EmptyState title="No employees" description="No employees on this team." />
            ) : (
              <TeamRosterTable rows={rows} />
            )}
          </section>
        );
      })}
    </div>
  );
}

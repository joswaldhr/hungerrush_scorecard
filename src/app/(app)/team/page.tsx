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
import type { RosterRow } from "@/components/team-roster-table";
import type { EmployeeMetricRow } from "@/lib/domain/metrics/queries";

function weekDates() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  return {
    periodStart: monday.toISOString().split("T")[0]!,
    previousPeriodStart: prevMonday.toISOString().split("T")[0]!,
    now: now.getTime(),
  };
}

function deriveOverallStatus(
  metrics: EmployeeMetricRow[]
): "on_track" | "mixed" | "needs_attention" | "no_data" {
  if (metrics.length === 0) return "on_track";
  if (metrics.every((m) => m.status.status === "no_data")) return "no_data";

  const withTargets = metrics.filter(
    (m) => m.status.status !== "no_target" && m.status.status !== "no_data"
  );
  if (withTargets.length === 0) return "on_track";
  const offTarget = withTargets.filter((m) => m.status.status === "off_target").length;
  const onTarget = withTargets.filter((m) => m.status.status === "on_target").length;
  if (offTarget >= 2 || offTarget > withTargets.length / 2) return "needs_attention";
  if (onTarget === withTargets.length) return "on_track";
  return "mixed";
}

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

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const { ctx, isPlatformAdmin } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) {
    if (isPlatformAdmin) redirect("/admin");
    return <EmptyState title="No access" description="You are not assigned as a manager." />;
  }

  const teams = await getAssignedTeams(ctx);
  const employees = await getAssignedEmployees(ctx);
  if (teams.length === 0) {
    return <EmptyState title="No teams" description="No teams assigned." />;
  }

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
    return { employee: emp, metrics, teamId, primary, trend };
  });

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">How is everyone doing?</p>
        <DataFreshness freshnessAt={freshnessAt} now={now} className="mt-2" />
      </header>

      {teams.map((team) => {
        const teamEmps = employeeData.filter((d) => d.teamId === team.id);
        const rows: RosterRow[] = teamEmps.map(({ employee, metrics, primary, trend }) => {
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
            overallStatus: deriveOverallStatus(metrics),
            keyChange,
            metricsOnTarget: metrics.filter((m) => m.status.status === "on_target").length,
            metricsOffTarget: metrics.filter((m) => m.status.status === "off_target").length,
            metricsNoData: metrics.filter((m) => m.status.status === "no_data").length,
            metricsTotal: metrics.length,
            trend,
            trendDirection: primary?.direction ?? "neutral",
            upcomingMeetingAt: upcomingByEmployee.get(employee.id) ?? null,
          };
        });

        return (
          <section key={team.id} className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{team.name}</h2>
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

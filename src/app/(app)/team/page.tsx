import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getEffectiveManagerContext,
  getVisibleTeamsForManager,
  getAssignedEmployees,
} from "@/lib/auth/authorization";
import { getEmployeeMetricsBatch } from "@/lib/domain/metrics/queries";
import { db } from "@/lib/db";
import { syncRuns, dataSources } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { EmptyState } from "@/components/empty-state";
import { TeamRosterTable } from "@/components/team-roster-table";
import { TeamFilters } from "@/components/team-filters";
import { StatCard } from "@/components/stat-card";
import {
  Users,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  RotateCw,
} from "lucide-react";
import { weekDates } from "@/lib/utils";
import { deriveOverallStatus } from "@/lib/domain/briefings/generate";
import type { RosterRow } from "@/components/team-roster-table";
import type { EmployeeMetricRow } from "@/lib/domain/metrics/queries";

function findKeyChange(
  metrics: EmployeeMetricRow[]
): { name: string; pct: number; subtitle: string } | null {
  let best: { name: string; pct: number; subtitle: string } | null = null;
  for (const m of metrics) {
    if (m.currentValue === null || m.previousValue === null || m.previousValue === 0) continue;
    const pct = ((m.currentValue - m.previousValue) / Math.abs(m.previousValue)) * 100;
    if (best === null || Math.abs(pct) > Math.abs(best.pct)) {
      const isHigher = m.direction === "higher_is_better";
      const improved = (isHigher && pct > 0) || (!isHigher && pct < 0);
      const subtitle = improved ? "Improving metric" : "Needs attention";
      best = { name: m.name, pct, subtitle };
    }
  }
  return best;
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; week?: string }>;
}) {
  const { team: teamParam, week: weekParam } = await searchParams;
  const weeksAgo = Math.max(0, Math.min(12, parseInt(weekParam ?? "0", 10) || 0));
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

  const employees = await getAssignedEmployees(ctx);
  const allTeams = await getVisibleTeamsForManager(ctx, employees);
  if (employees.length === 0) {
    return <EmptyState icon={Users} title="No employees" description="No employees assigned." />;
  }

  const selectedTeamId = teamParam && allTeams.some((t) => t.id === teamParam) ? teamParam : null;
  const visibleTeams = selectedTeamId ? allTeams.filter((t) => t.id === selectedTeamId) : allTeams;

  const { periodStart, periodEnd, previousPeriodStart } = weekDates(weeksAgo);

  const [latestSync] = await db
    .select({ completedAt: syncRuns.completedAt })
    .from(syncRuns)
    .innerJoin(dataSources, eq(syncRuns.dataSourceId, dataSources.id))
    .where(eq(dataSources.organizationId, ctx.organizationId))
    .orderBy(desc(syncRuns.completedAt))
    .limit(1);

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
      const empIds = teamEmps.map((e) => e.id);
      const batch = await getEmployeeMetricsBatch(
        ctx,
        empIds,
        teamId,
        periodStart,
        previousPeriodStart
      );
      for (const [employeeId, metrics] of batch) {
        metricsByEmployee.set(employeeId, metrics);
      }
    })
  );

  const employeeData = employees.map((emp) => {
    const teamId = emp.primaryTeamId ?? null;
    const metrics = metricsByEmployee.get(emp.id) ?? [];
    const overallStatus = deriveOverallStatus(metrics);
    return { employee: emp, metrics, teamId, overallStatus };
  });

  const totalEmployees = employeeData.length;
  const totalOnTrack = employeeData.filter((d) => d.overallStatus === "on_track").length;
  const totalWatch = employeeData.filter((d) => d.overallStatus === "mixed").length;
  const totalAttention = employeeData.filter((d) => d.overallStatus === "needs_attention").length;

  const currentTeamName = visibleTeams.length === 1 ? visibleTeams[0]!.name : "All Teams";
  const weekLabel = `Week of ${new Date(`${periodStart}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${new Date(`${periodEnd}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-foreground tracking-tight">
            Your Team
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground flex items-center gap-2">
            <span>{totalEmployees} employees</span>
            <span>•</span>
            <span>{currentTeamName}</span>
            <span>•</span>
            <span className="font-semibold text-foreground/80">{weekLabel}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <TeamFilters allTeams={allTeams} selectedTeamId={selectedTeamId} weeksAgo={weeksAgo} />
          {latestSync?.completedAt && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
              <RotateCw className="h-3 w-3" />
              <span>
                Last updated:{" "}
                {new Date(latestSync.completedAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <StatCard
          icon={CheckCircle2}
          iconClassName="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
          value={totalOnTrack}
          label="On Track"
          detail={
            totalEmployees > 0
              ? `${Math.round((totalOnTrack / totalEmployees) * 100)}% of team`
              : "—"
          }
          detailClassName="text-emerald-600 dark:text-emerald-400 font-semibold"
        />
        <StatCard
          icon={AlertCircle}
          iconClassName="bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
          value={totalWatch}
          label="Watch"
          detail={
            totalEmployees > 0 ? `${Math.round((totalWatch / totalEmployees) * 100)}% of team` : "—"
          }
          detailClassName="text-amber-600 dark:text-amber-400 font-semibold"
        />
        <StatCard
          icon={AlertTriangle}
          iconClassName="bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
          value={totalAttention}
          label="Needs Attention"
          detail={
            totalEmployees > 0
              ? `${Math.round((totalAttention / totalEmployees) * 100)}% of team`
              : "—"
          }
          detailClassName="text-rose-600 dark:text-rose-400 font-semibold"
        />
      </div>

      {visibleTeams.map((team) => {
        const teamEmps = employeeData.filter((d) => d.teamId === team.id);
        const rows: RosterRow[] = teamEmps.map(({ employee, metrics, overallStatus }) => {
          const keyChangeRaw = findKeyChange(metrics);
          const keyChange = keyChangeRaw
            ? {
                name: keyChangeRaw.name,
                pct: keyChangeRaw.pct,
                subtitle: keyChangeRaw.subtitle,
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
          };
        });

        return (
          <div key={team.id} className="space-y-4">
            {allTeams.length > 1 && (
              <h2 className="text-sm font-bold text-foreground px-1">{team.name}</h2>
            )}

            {rows.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No employees"
                description="No employees on this team."
              />
            ) : (
              <TeamRosterTable rows={rows} />
            )}
          </div>
        );
      })}
    </div>
  );
}

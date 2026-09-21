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
import { formatMetricValue } from "@/lib/domain/metrics/types";
import type { RosterRow } from "@/components/team-roster-table";
import type { EmployeeMetricRow } from "@/lib/domain/metrics/queries";

// A metric's own resolved target is the natural scale to judge its baseline
// against (rather than a hardcoded per-metric floor, which would violate this
// project's "targets are data-driven" rule). Range targets use their
// midpoint; other target types use whatever bound is set.
function targetScale(target: EmployeeMetricRow["target"]): number | null {
  if (!target) return null;
  if (target.targetType === "range") {
    if (target.targetMin !== null && target.targetMax !== null) {
      return (target.targetMin + target.targetMax) / 2;
    }
    return target.targetMin ?? target.targetMax ?? null;
  }
  return target.targetValue ?? target.targetMin ?? target.targetMax ?? null;
}

// A percent change against a prior value that's small relative to the
// metric's own target scale is mathematically real but practically
// misleading (e.g. hold time going from 0.2s to 1.1s computes as "+450%").
// Below this fraction of the target scale, show the absolute delta instead
// of trusting the percentage.
const MIN_BASELINE_FRACTION_OF_TARGET = 0.1;

function findKeyChange(
  metrics: EmployeeMetricRow[]
): { name: string; pct: number; changeLabel: string; subtitle: string } | null {
  let best: { name: string; pct: number; changeLabel: string; subtitle: string } | null = null;
  for (const m of metrics) {
    if (m.currentValue === null || m.previousValue === null || m.previousValue === 0) continue;
    const pct = ((m.currentValue - m.previousValue) / Math.abs(m.previousValue)) * 100;
    if (best !== null && Math.abs(pct) <= Math.abs(best.pct)) continue;

    const isHigher = m.direction === "higher_is_better";
    const improved = (isHigher && pct > 0) || (!isHigher && pct < 0);
    const subtitle = improved ? "Improving metric" : "Needs attention";

    const scale = targetScale(m.target);
    const pctIsTrustworthy =
      scale === null || Math.abs(m.previousValue) >= scale * MIN_BASELINE_FRACTION_OF_TARGET;
    const changeLabel = pctIsTrustworthy
      ? `${Math.abs(pct).toFixed(0)}%`
      : `${formatMetricValue(Math.abs(m.currentValue - m.previousValue), m.unit, m.valueType)}`;

    best = { name: m.name, pct, changeLabel, subtitle };
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
                changeLabel: keyChangeRaw.changeLabel,
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

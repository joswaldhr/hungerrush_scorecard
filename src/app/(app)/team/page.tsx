import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getManagerContext,
  getAssignedTeams,
  getAssignedEmployees,
} from "@/lib/auth/authorization";
import { getEmployeeMetrics } from "@/lib/domain/metrics/queries";
import { db } from "@/lib/db";
import { syncRuns, dataSources } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { StatusBadge } from "@/components/status-badge";
import { TrendIndicator } from "@/components/trend-indicator";
import { MetricValue } from "@/components/metric-value";
import { DataFreshness } from "@/components/data-freshness";
import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
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
): "on_track" | "mixed" | "needs_attention" {
  const withTargets = metrics.filter((m) => m.status.status !== "no_target");
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

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const ctx = await getManagerContext(session.user.email);
  if (!ctx) {
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

  const employeeData = await Promise.all(
    employees.map(async (emp) => {
      const teamId = emp.primaryTeamId;
      if (!teamId) return { employee: emp, metrics: [], teamId: null };
      const metrics = await getEmployeeMetrics(
        ctx,
        emp.id,
        teamId,
        periodStart,
        previousPeriodStart
      );
      return { employee: emp, metrics, teamId };
    })
  );

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">How is everyone doing?</p>
        <DataFreshness freshnessAt={freshnessAt} now={now} className="mt-2" />
      </header>

      {teams.map((team) => {
        const teamEmps = employeeData.filter((d) => d.teamId === team.id);
        return (
          <section key={team.id} className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{team.name}</h2>
            {teamEmps.length === 0 ? (
              <EmptyState title="No employees" description="No employees on this team." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">{team.name} employee metrics</caption>
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-muted-foreground">Employee</th>
                      <th className="pb-2 font-medium text-muted-foreground">Status</th>
                      <th className="pb-2 font-medium text-muted-foreground">Key change</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">
                        Primary metrics
                      </th>
                      <th className="pb-2 font-medium text-muted-foreground text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {teamEmps.map(({ employee, metrics }) => {
                      const overall = deriveOverallStatus(metrics);
                      const keyChange = findKeyChange(metrics);
                      const primary = metrics.filter((m) => m.isPrimary).slice(0, 3);
                      const isImproved =
                        keyChange &&
                        metrics.some(
                          (m) =>
                            m.name === keyChange.name &&
                            ((m.direction === "higher_is_better" && keyChange.pct > 0) ||
                              (m.direction === "lower_is_better" && keyChange.pct < 0))
                        );

                      return (
                        <tr key={employee.id} className="border-b last:border-0">
                          <td className="py-3">
                            <Link
                              href={`/employee/${employee.id}`}
                              className="flex items-center gap-3 hover:underline"
                            >
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-[10px]">
                                  {initials(employee.displayName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <span className="font-medium text-foreground">
                                  {employee.displayName}
                                </span>
                                {employee.jobTitle && (
                                  <p className="text-xs text-muted-foreground">
                                    {employee.jobTitle}
                                  </p>
                                )}
                              </div>
                            </Link>
                          </td>
                          <td className="py-3">
                            <StatusBadge status={overall} />
                          </td>
                          <td className="py-3">
                            {keyChange ? (
                              <span className="flex items-center gap-1.5 text-sm">
                                <TrendIndicator
                                  direction={
                                    Math.abs(keyChange.pct) < 1
                                      ? "stable"
                                      : isImproved
                                        ? "improved"
                                        : "declined"
                                  }
                                />
                                <span className="text-muted-foreground">
                                  {keyChange.name} {Math.abs(keyChange.pct).toFixed(0)}%
                                </span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex justify-end gap-4">
                              {primary.map((m) => (
                                <span key={m.key} className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">
                                    <MetricValue
                                      value={m.currentValue}
                                      unit={m.unit}
                                      valueType={m.valueType}
                                    />
                                  </span>{" "}
                                  {m.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 text-right">
                            <Link
                              href={`/one-on-ones/${employee.id}`}
                              className="text-xs text-accent hover:underline"
                            >
                              Prep 1:1
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

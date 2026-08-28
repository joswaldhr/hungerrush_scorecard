import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getEffectiveManagerContext,
  getAssignedTeams,
  getAssignedEmployees,
} from "@/lib/auth/authorization";
import { generateTeamBriefing } from "@/lib/domain/briefings/generate";
import { getTeamMetricTrend } from "@/lib/domain/metrics/queries";
import { db } from "@/lib/db";
import { meetingReferences, employees as employeesTable } from "@/lib/db/schema";
import { and, eq, gte, asc, inArray } from "drizzle-orm";
import { TrendIndicator } from "@/components/trend-indicator";
import { TrendSparkline } from "@/components/trend-sparkline";
import { MetricValue } from "@/components/metric-value";
import { DataFreshness } from "@/components/data-freshness";
import { BriefingSection } from "@/components/briefing-section";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

function weekDatesForOffset(weeksAgo: number) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentMonday = new Date(now);
  currentMonday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));

  const monday = new Date(currentMonday);
  monday.setDate(currentMonday.getDate() - weeksAgo * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  return {
    periodStart: monday.toISOString().split("T")[0]!,
    periodEnd: sunday.toISOString().split("T")[0]!,
    previousPeriodStart: prevMonday.toISOString().split("T")[0]!,
    now: now.getTime(),
    hour: now.getHours(),
    isCurrentWeek: weeksAgo === 0,
  };
}

function lastNWeekStarts(periodStart: string, n: number): string[] {
  const base = new Date(`${periodStart}T00:00:00Z`);
  const result: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - i * 7);
    result.push(d.toISOString().split("T")[0]!);
  }
  return result;
}

function pctOfTeam(n: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((n / total) * 100)}% of team`;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function formatWeekRange(periodStart: string, periodEnd: string): string {
  const start = new Date(`${periodStart}T00:00:00Z`);
  const end = new Date(`${periodEnd}T00:00:00Z`);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week: weekParam } = await searchParams;
  const weeksAgo = Math.max(0, Math.min(12, parseInt(weekParam ?? "0", 10) || 0));

  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const { ctx, isPlatformAdmin } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) {
    if (isPlatformAdmin) redirect("/admin");
    return (
      <div className="max-w-3xl">
        <EmptyState
          title="No access"
          description="You are not assigned as a manager for any teams."
        />
      </div>
    );
  }

  const teams = await getAssignedTeams(ctx);
  if (teams.length === 0) {
    return (
      <div className="max-w-3xl">
        <EmptyState
          title="No teams assigned"
          description="Contact your administrator to get team access."
        />
      </div>
    );
  }

  const employees = await getAssignedEmployees(ctx);
  const { periodStart, periodEnd, previousPeriodStart, now, hour, isCurrentWeek } =
    weekDatesForOffset(weeksAgo);

  const briefings = await Promise.all(
    teams.map((team) =>
      generateTeamBriefing(ctx, team.id, team.name, periodStart, periodEnd, previousPeriodStart)
    )
  );

  const trendPeriods = lastNWeekStarts(periodStart, 4);
  const teamTrends = await Promise.all(
    briefings.map(async (briefing, i) => {
      const team = teams[i]!;
      const teamEmployeeIds = employees.filter((e) => e.primaryTeamId === team.id).map((e) => e.id);
      const rows = await Promise.all(
        briefing.teamPerformance.map(async (metric) => ({
          metric,
          trend: await getTeamMetricTrend(teamEmployeeIds, metric.metricDefinitionId, trendPeriods),
        }))
      );
      return { team, briefing, rows };
    })
  );

  const totals = briefings.reduce(
    (acc, b) => ({
      employees: acc.employees + b.employeeCount,
      onTrack: acc.onTrack + b.statusDistribution.onTarget,
      watch: acc.watch + b.statusDistribution.warning,
      attention: acc.attention + b.statusDistribution.offTarget,
      noData: acc.noData + b.statusDistribution.noData,
    }),
    { employees: 0, onTrack: 0, watch: 0, attention: 0, noData: 0 }
  );

  const freshnessDates = briefings
    .map((b) => b.meta.dataFreshnessAt)
    .filter((d): d is string => d !== null)
    .map((d) => new Date(d).getTime());
  const overallFreshness =
    freshnessDates.length > 0 ? new Date(Math.min(...freshnessDates)).toISOString() : null;

  const allNeedsAttention = briefings.flatMap((b) => b.needsAttention);
  const allImprovements = briefings.flatMap((b) => b.notableImprovements);

  const upcomingMeetings =
    ctx.assignedEmployeeIds.length > 0
      ? await db
          .select({
            id: meetingReferences.id,
            employeeId: meetingReferences.employeeId,
            employeeName: employeesTable.displayName,
            scheduledStart: meetingReferences.scheduledStart,
          })
          .from(meetingReferences)
          .innerJoin(employeesTable, eq(meetingReferences.employeeId, employeesTable.id))
          .where(
            and(
              eq(meetingReferences.managerUserId, ctx.userId),
              inArray(meetingReferences.employeeId, ctx.assignedEmployeeIds),
              gte(meetingReferences.scheduledStart, new Date())
            )
          )
          .orderBy(asc(meetingReferences.scheduledStart))
          .limit(5)
      : [];

  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="max-w-6xl space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {greeting}, {session.user.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isCurrentWeek ? "Your weekly manager briefing" : "Historical briefing"}
          </p>
          <DataFreshness freshnessAt={overallFreshness} now={now} className="mt-2" />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={weeksAgo < 12 ? `/?week=${weeksAgo + 1}` : "#"}
            aria-label="Previous week"
            className={`flex h-8 w-8 items-center justify-center rounded-md border border-border ${weeksAgo < 12 ? "text-muted-foreground hover:text-foreground" : "pointer-events-none opacity-30"}`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <span className="min-w-[10rem] text-center text-sm text-foreground">
            {formatWeekRange(periodStart, periodEnd)}
          </span>
          <Link
            href={weeksAgo > 0 ? `/?week=${weeksAgo - 1}` : "#"}
            aria-label="Next week"
            className={`flex h-8 w-8 items-center justify-center rounded-md border border-border ${weeksAgo > 0 ? "text-muted-foreground hover:text-foreground" : "pointer-events-none opacity-30"}`}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={Users}
          iconClassName="bg-accent/10 text-accent"
          value={totals.employees}
          label="Employees"
          detail="100% of team"
        />
        <StatCard
          icon={CheckCircle2}
          iconClassName="bg-status-on-track-bg text-[oklch(var(--status-on-track))]"
          value={totals.onTrack}
          label="On track"
          detail={pctOfTeam(totals.onTrack, totals.employees)}
        />
        <StatCard
          icon={AlertCircle}
          iconClassName="bg-status-watch-bg text-[oklch(var(--status-watch))]"
          value={totals.watch}
          label="To watch"
          detail={pctOfTeam(totals.watch, totals.employees)}
        />
        <StatCard
          icon={AlertTriangle}
          iconClassName="bg-status-attention-bg text-[oklch(var(--status-attention))]"
          value={totals.attention}
          label="Needs attention"
          detail={pctOfTeam(totals.attention, totals.employees)}
        />
      </div>

      {totals.noData > 0 && (
        <p className="text-sm text-muted-foreground">
          {totals.noData} of {totals.employees} employees have no synced metric data yet — run a
          sync from{" "}
          <Link href="/data-health" className="text-accent hover:underline">
            Data Health
          </Link>{" "}
          to populate this.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:col-span-2">
          <BriefingSection title="Needs attention" count={allNeedsAttention.length}>
            {allNeedsAttention.length === 0 ? (
              <EmptyState
                title="Nothing urgent"
                description="No employees need attention this week."
              />
            ) : (
              <div className="space-y-2">
                {allNeedsAttention.slice(0, 5).map((item) => (
                  <Card key={item.employeeId}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                          <AvatarFallback className="text-xs bg-status-attention-bg text-[oklch(var(--status-attention))]">
                            {initials(item.employeeName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Link
                            href={`/employee/${item.employeeId}`}
                            className="text-sm font-medium text-foreground hover:underline"
                          >
                            {item.employeeName}
                          </Link>
                          <ul className="mt-1 space-y-0.5">
                            {item.reasons.map((reason, j) => (
                              <li key={j} className="text-sm text-muted-foreground">
                                {reason.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Link href="/team" className="inline-block text-sm text-accent hover:underline">
                  View all attention items →
                </Link>
              </div>
            )}
          </BriefingSection>

          <BriefingSection title="Notable improvements" count={allImprovements.length}>
            {allImprovements.length === 0 ? (
              <EmptyState
                title="No improvements yet"
                description="Notable improvements will show up here."
              />
            ) : (
              <div className="space-y-2">
                {allImprovements.slice(0, 5).map((item) => (
                  <Card key={item.employeeId}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                          <AvatarFallback className="text-xs bg-status-on-track-bg text-[oklch(var(--status-on-track))]">
                            {initials(item.employeeName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Link
                            href={`/employee/${item.employeeId}`}
                            className="text-sm font-medium text-foreground hover:underline"
                          >
                            {item.employeeName}
                          </Link>
                          <ul className="mt-1 space-y-0.5">
                            {item.achievements.map((a, j) => (
                              <li key={j} className="text-sm text-muted-foreground">
                                {a.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Link href="/team" className="inline-block text-sm text-accent hover:underline">
                  View all improvements →
                </Link>
              </div>
            )}
          </BriefingSection>
        </div>

        <div className="lg:col-span-1">
          <Card className="overflow-hidden">
            <div className="border-b px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your upcoming 1:1s
              </h2>
            </div>
            {upcomingMeetings.length === 0 ? (
              <div className="px-4 py-8">
                <EmptyState
                  title="No 1:1s scheduled"
                  description="Connect a calendar to see upcoming meetings here."
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {upcomingMeetings.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.scheduledStart).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="truncate text-sm font-medium text-foreground">
                        {m.employeeName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.scheduledStart).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Link
                      href={`/one-on-ones/${m.employeeId}`}
                      className="shrink-0 rounded-md border border-accent px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10"
                    >
                      Prepare →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t px-4 py-2.5 text-center">
              <Link href="/one-on-ones" className="text-sm text-accent hover:underline">
                View all 1:1s →
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {teamTrends.map(({ team, briefing, rows }) => (
        <div key={team.id} className="space-y-3">
          <BriefingSection title={`${briefing.teamName} performance`}>
            {rows.length === 0 ? (
              <EmptyState
                title="No metric data yet"
                description="Metric values will appear here once data is available."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">{briefing.teamName} performance metrics</caption>
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-muted-foreground">Metric</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">
                        Team Avg
                      </th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Prev</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Status</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Change</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">
                        Trend (4 weeks)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ metric, trend }) => {
                      const change =
                        metric.teamAverage !== null &&
                        metric.previousTeamAverage !== null &&
                        metric.previousTeamAverage !== 0
                          ? ((metric.teamAverage - metric.previousTeamAverage) /
                              Math.abs(metric.previousTeamAverage)) *
                            100
                          : null;
                      const isImproved =
                        change !== null &&
                        ((metric.direction === "higher_is_better" && change > 0) ||
                          (metric.direction === "lower_is_better" && change < 0));
                      const metricStatus =
                        change === null
                          ? "no_data"
                          : Math.abs(change) < 1
                            ? "on_target"
                            : isImproved
                              ? "on_target"
                              : Math.abs(change) >= 10
                                ? "off_target"
                                : "warning";
                      return (
                        <tr key={metric.metricKey} className="border-b last:border-0">
                          <td className="py-2.5 text-foreground">{metric.metricName}</td>
                          <td className="py-2.5 text-right">
                            <MetricValue
                              value={
                                metric.teamAverage !== null
                                  ? Math.round(metric.teamAverage * 10) / 10
                                  : null
                              }
                              unit={metric.unit}
                              valueType={metric.valueType}
                              className="font-medium"
                            />
                          </td>
                          <td className="py-2.5 text-right text-muted-foreground">
                            <MetricValue
                              value={
                                metric.previousTeamAverage !== null
                                  ? Math.round(metric.previousTeamAverage * 10) / 10
                                  : null
                              }
                              unit={metric.unit}
                              valueType={metric.valueType}
                            />
                          </td>
                          <td className="py-2.5 text-right">
                            <div className="flex justify-end">
                              <StatusBadge status={metricStatus} />
                            </div>
                          </td>
                          <td className="py-2.5 text-right">
                            {change !== null ? (
                              <TrendIndicator
                                direction={
                                  Math.abs(change) < 1
                                    ? "stable"
                                    : isImproved
                                      ? "improved"
                                      : "declined"
                                }
                                value={`${Math.abs(change).toFixed(0)}%`}
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2.5 text-right">
                            <div className="flex justify-end">
                              <TrendSparkline values={trend} direction={metric.direction} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </BriefingSection>
        </div>
      ))}
    </div>
  );
}

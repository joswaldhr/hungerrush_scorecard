import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getEffectiveManagerContext,
  getAssignedTeams,
  getAssignedEmployees,
} from "@/lib/auth/authorization";
import { generateTeamBriefing } from "@/lib/domain/briefings/generate";
import {
  getTeamMetricTrend,
  getMetricHistoryBatch,
  getEmployeeMetricsBatch,
  type EmployeeMetricRow,
} from "@/lib/domain/metrics/queries";
import { evaluateChangeStatus } from "@/lib/domain/metrics/target-resolution";
import { TrendSparkline } from "@/components/trend-sparkline";
import { MetricValue } from "@/components/metric-value";
import { MetricIcon } from "@/components/metric-icon";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertTriangle,
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ShieldAlert,
  TrendingUp,
  Users,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { weekDates, initials } from "@/lib/utils";

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

function formatWeekRange(periodStart: string, periodEnd: string): string {
  const start = new Date(`${periodStart}T00:00:00Z`);
  const end = new Date(`${periodEnd}T00:00:00Z`);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const yearOpts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  };
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", yearOpts)}`;
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
          icon={ShieldAlert}
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
          icon={Users}
          title="No teams assigned"
          description="Contact your administrator to get team access."
        />
      </div>
    );
  }

  const employees = await getAssignedEmployees(ctx);
  const { periodStart, periodEnd, previousPeriodStart, hour, isCurrentWeek } = weekDates(weeksAgo);
  const weekQ = weeksAgo > 0 ? `?week=${weeksAgo}` : "";

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

  const allNeedsAttention = briefings.flatMap((b) => b.needsAttention);
  const allImprovements = briefings.flatMap((b) => b.notableImprovements);

  // Fetch trend history for attention / improvement items
  const highlightEmpIds = [
    ...allNeedsAttention.map((i) => i.employeeId),
    ...allImprovements.map((i) => i.employeeId),
  ];
  const highlightMetrics = await Promise.all(
    teams.map((team) =>
      getEmployeeMetricsBatch(ctx, highlightEmpIds, team.id, periodStart, previousPeriodStart)
    )
  );
  const highlightMetricMap = new Map<string, EmployeeMetricRow[]>();
  for (const batch of highlightMetrics) {
    for (const [empId, metrics] of batch) {
      highlightMetricMap.set(empId, metrics);
    }
  }

  const historyRequests = highlightEmpIds
    .map((empId) => {
      const metrics = highlightMetricMap.get(empId) ?? [];
      const primary = metrics.find((m) => m.isPrimary) ?? metrics[0];
      return primary ? { employeeId: empId, metricDefinitionId: primary.definitionId } : null;
    })
    .filter((r): r is { employeeId: string; metricDefinitionId: string } => r !== null);

  const historyByRequest = await getMetricHistoryBatch(ctx, historyRequests, 4);

  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-foreground tracking-tight">
            {greeting}, {session.user.name?.split(" ")[0] ?? "James"}
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <span>{isCurrentWeek ? "Your weekly manager briefing" : "Historical briefing"}</span>
            <span>•</span>
            <span className="font-semibold text-foreground/80">
              {formatWeekRange(periodStart, periodEnd)}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Week switcher */}
          <div className="flex items-center rounded-lg border border-border/80 bg-card shadow-2xs p-0.5 text-sm">
            {weeksAgo < 12 ? (
              <Link
                href={`/?week=${weeksAgo + 1}`}
                aria-label="Previous week"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
            ) : (
              <span className="flex h-8 w-8 items-center justify-center text-muted-foreground/30">
                <ChevronLeft className="h-4 w-4" />
              </span>
            )}

            <div className="flex items-center gap-2 px-3 text-xs font-semibold text-foreground">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{formatWeekRange(periodStart, periodEnd)}</span>
            </div>

            {weeksAgo > 0 ? (
              <Link
                href={`/?week=${weeksAgo - 1}`}
                aria-label="Next week"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="flex h-8 w-8 items-center justify-center text-muted-foreground/30">
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <RotateCw className="h-3 w-3" />
            <span>Last updated: 8:30 AM</span>
          </div>
        </div>
      </header>

      {/* TEAM AT A GLANCE Stat Cards */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
          Team at a glance
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Users}
            iconClassName="bg-teal-50 text-[#009ca6] dark:bg-teal-950/50 dark:text-teal-400"
            value={totals.employees}
            label="Employees"
            detail="100% of team"
          />
          <StatCard
            icon={CheckCircle2}
            iconClassName="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
            value={totals.onTrack}
            label="On Track"
            detail={pctOfTeam(totals.onTrack, totals.employees)}
            detailClassName="text-emerald-600 dark:text-emerald-400 font-semibold"
          />
          <StatCard
            icon={AlertCircle}
            iconClassName="bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
            value={totals.watch}
            label="To Watch"
            detail={pctOfTeam(totals.watch, totals.employees)}
            detailClassName="text-amber-600 dark:text-amber-400 font-semibold"
          />
          <StatCard
            icon={AlertTriangle}
            iconClassName="bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
            value={totals.attention}
            label="Needs Attention"
            detail={pctOfTeam(totals.attention, totals.employees)}
            detailClassName="text-rose-600 dark:text-rose-400 font-semibold"
          />
        </div>
      </section>

      {/* THIS WEEK: Needs Attention + Notable Improvements */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="overflow-hidden">
          <div className="border-b border-border/80 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              This Week
            </h2>
          </div>
          <CardContent className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-border/80">
            {/* Needs Attention */}
            <div className="space-y-4 md:pr-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Needs Your Attention
              </h3>
              {allNeedsAttention.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto opacity-80" />
                  <p className="mt-2 text-xs font-semibold text-foreground">Nothing urgent</p>
                  <p className="text-xs text-muted-foreground">
                    All employees are performing on target.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allNeedsAttention.slice(0, 3).map((item) => {
                    const metrics = highlightMetricMap.get(item.employeeId) ?? [];
                    const primary = metrics.find((m) => m.isPrimary) ?? metrics[0];
                    const trend = primary
                      ? (historyByRequest.get(`${item.employeeId}:${primary.definitionId}`) ?? [])
                          .slice()
                          .reverse()
                          .map((v) => v.numericValue)
                      : [];
                    return (
                      <Link
                        key={item.employeeId}
                        href={`/one-on-ones/${item.employeeId}`}
                        className="group block rounded-lg border border-border/60 p-3 hover:border-border hover:bg-muted/40 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-7 w-7 ring-1 ring-border">
                              <AvatarFallback className="text-[11px] font-bold bg-rose-50 text-rose-700">
                                {initials(item.employeeName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="text-sm font-semibold text-foreground group-hover:text-[#009ca6] transition-colors">
                                {item.employeeName}
                              </span>
                            </div>
                          </div>
                          <span className="rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                            Watch
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                          {item.reasons[0]?.text ?? "Performance metric requires review."}
                        </p>

                        <div className="mt-2 flex items-center justify-between pt-1">
                          <span className="text-[11px] font-medium text-[#009ca6] group-hover:underline">
                            View details
                          </span>
                          <TrendSparkline
                            values={trend.length > 0 ? trend : [10, 8, 7, 5]}
                            direction="lower_is_better"
                            width={68}
                            height={18}
                          />
                        </div>
                      </Link>
                    );
                  })}
                  <Link
                    href={`/team${weekQ}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#009ca6] hover:underline pt-1"
                  >
                    <span>View all attention items</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </div>

            {/* Notable Improvements */}
            <div className="space-y-4 pt-4 md:pt-0 md:pl-6">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Notable Improvements
              </h3>
              {allImprovements.length === 0 ? (
                <div className="py-8 text-center">
                  <TrendingUp className="h-8 w-8 text-slate-400 mx-auto opacity-80" />
                  <p className="mt-2 text-xs font-semibold text-foreground">
                    No significant changes
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Improvements will appear here as metrics increase.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allImprovements.slice(0, 3).map((item) => {
                    const metrics = highlightMetricMap.get(item.employeeId) ?? [];
                    const primary = metrics.find((m) => m.isPrimary) ?? metrics[0];
                    const trend = primary
                      ? (historyByRequest.get(`${item.employeeId}:${primary.definitionId}`) ?? [])
                          .slice()
                          .reverse()
                          .map((v) => v.numericValue)
                      : [];
                    return (
                      <Link
                        key={item.employeeId}
                        href={`/one-on-ones/${item.employeeId}`}
                        className="group block rounded-lg border border-border/60 p-3 hover:border-border hover:bg-muted/40 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-7 w-7 ring-1 ring-border">
                              <AvatarFallback className="text-[11px] font-bold bg-emerald-50 text-emerald-700">
                                {initials(item.employeeName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="text-sm font-semibold text-foreground group-hover:text-[#009ca6] transition-colors">
                                {item.employeeName}
                              </span>
                            </div>
                          </div>
                          <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                            Improving
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                          {item.achievements[0]?.text ?? "Consecutive weekly metric improvements."}
                        </p>

                        <div className="mt-2 flex items-center justify-between pt-1">
                          <span className="text-[11px] font-medium text-[#009ca6] group-hover:underline">
                            View details
                          </span>
                          <TrendSparkline
                            values={trend.length > 0 ? trend : [5, 7, 8, 10]}
                            direction="higher_is_better"
                            width={68}
                            height={18}
                          />
                        </div>
                      </Link>
                    );
                  })}
                  <Link
                    href={`/team${weekQ}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#009ca6] hover:underline pt-1"
                  >
                    <span>View all improvements</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* TEAM PERFORMANCE Table Card */}
      {teamTrends.map(({ team, briefing, rows }) => (
        <Card key={team.id} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Team Performance
            </h2>
            <Link
              href={`/team${weekQ}`}
              className="text-xs font-semibold text-[#009ca6] hover:underline flex items-center gap-1"
            >
              <span>View full team dashboard</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {rows.length === 0 ? (
            <div className="p-8 text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground/60 mx-auto" />
              <p className="mt-2 text-sm font-semibold text-foreground">No metric data yet</p>
              <p className="text-xs text-muted-foreground">
                Metric values will appear once data is synced.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{briefing.teamName} performance metrics</caption>
                <thead>
                  <tr className="border-b border-border/80 bg-slate-50/30 dark:bg-slate-900/30 text-left text-xs font-semibold text-muted-foreground">
                    <th className="py-3 px-5">Metric</th>
                    <th className="py-3 px-4 text-right">This Week</th>
                    <th className="py-3 px-4 text-right">Change vs Last Week</th>
                    <th className="py-3 px-4 text-right">Change vs 4-Week Avg</th>
                    <th className="py-3 px-4 text-right">Status</th>
                    <th className="py-3 px-5 text-right">Trend (4 Weeks)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rows.map(({ metric, trend }) => {
                    const change =
                      metric.teamAverage !== null &&
                      metric.previousTeamAverage !== null &&
                      metric.previousTeamAverage !== 0
                        ? ((metric.teamAverage - metric.previousTeamAverage) /
                            Math.abs(metric.previousTeamAverage)) *
                          100
                        : null;
                    const { status: metricStatus, isImproved } = evaluateChangeStatus(
                      change,
                      metric.direction
                    );

                    const validTrend = trend.filter((v): v is number => v !== null);
                    const avg4Week =
                      validTrend.length > 0
                        ? validTrend.reduce((a, b) => a + b, 0) / validTrend.length
                        : null;
                    const change4Week =
                      metric.teamAverage !== null && avg4Week !== null && avg4Week !== 0
                        ? ((metric.teamAverage - avg4Week) / Math.abs(avg4Week)) * 100
                        : null;

                    return (
                      <tr key={metric.metricKey} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-5 text-foreground font-semibold">
                          <span className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/60 text-[#009ca6]">
                              <MetricIcon
                                metricKey={metric.metricKey}
                                category={metric.category}
                                className="h-4 w-4"
                              />
                            </span>
                            <span>{metric.metricName}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <MetricValue
                            value={
                              metric.teamAverage !== null
                                ? Math.round(metric.teamAverage * 10) / 10
                                : null
                            }
                            unit={metric.unit}
                            valueType={metric.valueType}
                            className="font-bold text-foreground"
                          />
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium">
                          {change !== null ? (
                            <span
                              className={
                                isImproved
                                  ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                  : Math.abs(change) < 1
                                    ? "text-muted-foreground"
                                    : "text-rose-600 dark:text-rose-400 font-semibold"
                              }
                            >
                              {change > 0 ? "+" : ""}
                              {change.toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium">
                          {change4Week !== null ? (
                            <span
                              className={
                                (metric.direction === "higher_is_better" && change4Week > 0) ||
                                (metric.direction === "lower_is_better" && change4Week < 0)
                                  ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                  : Math.abs(change4Week) < 1
                                    ? "text-muted-foreground"
                                    : "text-amber-600 dark:text-amber-400 font-semibold"
                              }
                            >
                              {change4Week > 0 ? "+" : ""}
                              {change4Week.toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex justify-end">
                            <StatusBadge status={metricStatus} />
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex justify-end">
                            <TrendSparkline
                              values={trend}
                              direction={metric.direction}
                              width={96}
                              height={20}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-5 py-2.5 border-t border-border/60 bg-slate-50/20 text-[11px] text-muted-foreground">
                pp = percentage points
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

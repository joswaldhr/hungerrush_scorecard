import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getEffectiveManagerContext, getAssignedEmployees } from "@/lib/auth/authorization";
import { generateEmployeeSummary } from "@/lib/domain/briefings/generate";
import { getMetricHistory } from "@/lib/domain/metrics/queries";
import { getEmployeeContext } from "@/lib/domain/context/queries";
import { StatusBadge } from "@/components/status-badge";
import { TrendSparkline } from "@/components/trend-sparkline";
import { MetricHistoryChart } from "@/components/metric-history-chart";
import { MetricValue } from "@/components/metric-value";
import { MetricIcon } from "@/components/metric-icon";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContextNoteForm } from "./context-note-form";
import {
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  Calendar,
  MoreHorizontal,
  ChevronRight,
  Users,
  Star,
  FileText,
  RotateCw,
} from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { teams, externalIdentities, dataSources, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cn, initials } from "@/lib/utils";

const PERIODS = [
  { key: "this_week", label: "This Week", weeksAgo: 0, span: 1 },
  { key: "last_week", label: "Last Week", weeksAgo: 1, span: 1 },
  { key: "last_4_weeks", label: "Last 4 Weeks", weeksAgo: 0, span: 4 },
  { key: "last_12_weeks", label: "Last 12 Weeks", weeksAgo: 0, span: 12 },
] as const;

type PeriodKey = (typeof PERIODS)[number]["key"];

function periodDates(key: PeriodKey) {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const currentMonday = new Date(now);
  currentMonday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7));

  const config = PERIODS.find((p) => p.key === key)!;

  const endMonday = new Date(currentMonday);
  endMonday.setUTCDate(currentMonday.getUTCDate() - config.weeksAgo * 7);

  const startMonday = new Date(endMonday);
  startMonday.setUTCDate(endMonday.getUTCDate() - (config.span - 1) * 7);

  const sunday = new Date(endMonday);
  sunday.setUTCDate(endMonday.getUTCDate() + 6);

  const prevStart = new Date(startMonday);
  prevStart.setUTCDate(startMonday.getUTCDate() - config.span * 7);

  return {
    periodStart: startMonday.toISOString().split("T")[0]!,
    periodEnd: sunday.toISOString().split("T")[0]!,
    previousPeriodStart: prevStart.toISOString().split("T")[0]!,
    now: now.getTime(),
  };
}

const CONTEXT_TABS = [
  { key: "overview", label: "Overview" },
  { key: "coaching", label: "Coaching" },
  { key: "quality_review", label: "Quality" },
  { key: "attendance", label: "Attendance" },
  { key: "note", label: "Notes" },
] as const;

export default async function EmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; metric?: string }>;
}) {
  const { id } = await params;
  const { period: periodParam, metric: metricParam } = await searchParams;
  const period: PeriodKey = PERIODS.some((p) => p.key === periodParam)
    ? (periodParam as PeriodKey)
    : "this_week";

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
  const teamName = team?.name ?? "POS Support";

  // Manager details
  const managerUser = ctx.userId
    ? await db
        .select({ displayName: users.displayName, email: users.email })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .then((r) => r[0])
    : null;
  const managerName = managerUser?.displayName ?? session.user.name ?? "James Smith";

  const { periodStart, periodEnd, previousPeriodStart } = periodDates(period);

  const summary = await generateEmployeeSummary(
    ctx,
    employee.id,
    employee.displayName,
    employee.jobTitle,
    teamId,
    teamName,
    periodStart,
    periodEnd,
    previousPeriodStart
  );

  const totalConfiguredMetrics = summary.metricSnapshots.length;
  const metricsOnTarget = summary.metricSnapshots.filter(
    (s) => s.status.status === "on_target"
  ).length;
  const onTargetPct =
    totalConfiguredMetrics > 0 ? Math.round((metricsOnTarget / totalConfiguredMetrics) * 100) : 0;
  const improvingCount = summary.changes.filter((c) => c.changeDirection === "improved").length;
  const decliningSignificantly = summary.changes.filter(
    (c) =>
      c.changeDirection === "declined" &&
      c.changePercent !== null &&
      Math.abs(c.changePercent) >= 10
  ).length;

  const snapshotTrends = await Promise.all(
    summary.metricSnapshots.map(async (snap) => ({
      snap,
      trend: (await getMetricHistory(ctx, employee.id, snap.metricDefinitionId, 4))
        .slice()
        .reverse()
        .map((r) => r.numericValue),
    }))
  );

  const selectedMetricKey = metricParam ?? null;
  const selectedSnapshot = selectedMetricKey
    ? (summary.metricSnapshots.find((s) => s.metricKey === selectedMetricKey) ?? null)
    : null;
  const chartSnapshot =
    selectedSnapshot ??
    summary.metricSnapshots.find((s) => s.isPrimary) ??
    summary.metricSnapshots[0] ??
    null;

  const historyRows = chartSnapshot
    ? await getMetricHistory(ctx, employee.id, chartSnapshot.metricDefinitionId, 12)
    : [];
  const history = historyRows
    .slice()
    .reverse()
    .map((r) => ({ periodStart: r.periodStart, value: r.numericValue }));

  const contextRows = await getEmployeeContext(ctx, employee.id, 20);

  const sourceRows = await db
    .select({ displayName: dataSources.displayName })
    .from(externalIdentities)
    .innerJoin(dataSources, eq(externalIdentities.dataSourceId, dataSources.id))
    .where(eq(externalIdentities.employeeId, employee.id));
  const sourceNames =
    sourceRows.length > 0
      ? [...new Set(sourceRows.map((s) => s.displayName))]
      : ["Zendesk", "Assembled", "Rippling"];

  const weekRangeFormatted = `Week of ${new Date(`${periodStart}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${new Date(`${periodEnd}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Breadcrumb */}
      <div>
        <Link
          href="/team"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Team</span>
        </Link>
      </div>

      {/* Profile Header Card / Row */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        {/* Employee Info */}
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 ring-2 ring-border shadow-xs shrink-0">
            <AvatarFallback className="text-base font-bold bg-slate-100 dark:bg-slate-800 text-foreground">
              {initials(employee.displayName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-[28px] font-bold text-foreground tracking-tight">
                {employee.displayName}
              </h1>
              <StatusBadge status={summary.overallStatus} showDot />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {employee.jobTitle ?? "Support Specialist"} • {teamName}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manager:{" "}
              <span className="font-semibold text-[#009ca6] hover:underline cursor-pointer">
                {managerName}
              </span>
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="flex items-center gap-2">
            {/* Segmented Timeframe Switcher */}
            <div className="flex items-center rounded-lg border border-border/80 bg-card p-1 shadow-2xs text-xs font-semibold">
              {PERIODS.map((p) => {
                const active = period === p.key;
                return (
                  <Link
                    key={p.key}
                    href={`/employee/${employee.id}?period=${p.key}${metricParam ? `&metric=${metricParam}` : ""}`}
                    aria-pressed={active}
                    className={cn(
                      "px-3 py-1.5 rounded-md transition-all",
                      active
                        ? "bg-teal-50 text-[#009ca6] border border-[#009ca6]/40 dark:bg-teal-950/60 shadow-2xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </Link>
                );
              })}
              <div className="pl-1.5 pr-1 border-l border-border/70 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
              </div>
            </div>

            {/* Prepare 1:1 Button */}
            <Link
              href={`/one-on-ones/${employee.id}`}
              className="flex items-center gap-1.5 rounded-lg bg-[#009ca6] px-4 py-2 text-xs font-bold text-white hover:bg-[#008b94] transition-all shadow-xs"
            >
              <span>Prepare for 1:1</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            {/* More Options Button */}
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-card text-muted-foreground hover:bg-muted transition-colors shadow-2xs"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          <div className="text-[11px] font-medium text-muted-foreground self-end sm:self-auto">
            {weekRangeFormatted}
          </div>
        </div>
      </header>

      {/* EXECUTIVE SUMMARY Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Left Summary Paragraph */}
            <div className="flex items-start gap-4 flex-1">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 shadow-2xs mt-0.5">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Executive Summary
                </h3>
                <p className="text-sm text-foreground leading-relaxed">
                  <span className="font-bold">Strong week. </span>
                  {summary.executiveSummary.text}
                </p>
              </div>
            </div>

            {/* Right KPI Columns with Vertical Dividers */}
            <div className="grid grid-cols-3 gap-6 sm:gap-10 border-t lg:border-t-0 lg:border-l border-border/80 pt-4 lg:pt-0 lg:pl-10 shrink-0 w-full lg:w-auto">
              {/* Stat 1: Metrics on target */}
              <div>
                <p className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground leading-none">
                  {metricsOnTarget} / {totalConfiguredMetrics}
                </p>
                <p className="text-xs font-medium text-muted-foreground mt-1.5">
                  Metrics on target
                </p>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {onTargetPct}%
                </p>
              </div>

              {/* Stat 2: Improving */}
              <div>
                <p className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground leading-none">
                  {improvingCount}
                </p>
                <p className="text-xs font-medium text-muted-foreground mt-1.5">Improving</p>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  vs last week
                </p>
              </div>

              {/* Stat 3: Declining */}
              <div>
                <p className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground leading-none">
                  {decliningSignificantly}
                </p>
                <p className="text-xs font-medium text-muted-foreground mt-1.5">Declining</p>
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                  significantly
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2x2 Grid of Main Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top-Left: WHAT'S CHANGED THIS WEEK */}
        <Card className="flex flex-col justify-between overflow-hidden">
          <div>
            <div className="border-b border-border/80 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                What&apos;s Changed This Week
              </h2>
            </div>
            <CardContent className="p-5 space-y-3.5">
              {summary.changes.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No metric changes recorded this week.
                </p>
              ) : (
                summary.changes.map((change) => {
                  const pct =
                    change.changePercent !== null
                      ? Math.abs(change.changePercent).toFixed(0)
                      : null;
                  const isImproved = change.changeDirection === "improved";
                  const isDeclined = change.changeDirection === "declined";
                  return (
                    <div
                      key={change.metricKey}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            isImproved
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60"
                              : isDeclined
                                ? "bg-amber-50 text-amber-600 dark:bg-amber-950/60"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800"
                          )}
                        >
                          <MetricIcon
                            metricKey={change.metricKey}
                            category={change.category}
                            className="h-4 w-4"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">
                            {change.metricName}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {isImproved
                              ? "Continuous week-over-week improvement"
                              : isDeclined
                                ? "Metric requires review"
                                : "No significant change"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center justify-end gap-1.5 text-xs font-semibold text-foreground">
                          <MetricValue
                            value={change.previousValue}
                            unit={change.unit}
                            valueType={change.valueType}
                            className="text-muted-foreground"
                          />
                          <span className="text-muted-foreground">→</span>
                          <MetricValue
                            value={change.currentValue}
                            unit={change.unit}
                            valueType={change.valueType}
                            className="font-bold text-foreground"
                          />
                        </div>
                        {pct && (
                          <span
                            className={cn(
                              "text-[10px] font-bold mt-0.5 inline-block",
                              isImproved
                                ? "text-emerald-600 dark:text-emerald-400"
                                : isDeclined
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-muted-foreground"
                            )}
                          >
                            {isImproved ? `↑ ${pct}%` : isDeclined ? `↓ ${pct}%` : `→ 0%`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </div>
          <div className="border-t border-border/80 px-5 py-3 bg-slate-50/30 dark:bg-slate-900/30">
            <Link
              href={`/employee/${employee.id}?period=${period}`}
              className="text-xs font-semibold text-[#009ca6] hover:underline flex items-center gap-1"
            >
              <span>View all changes</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>

        {/* Top-Right: PERFORMANCE METRICS */}
        <Card className="flex flex-col justify-between overflow-hidden">
          <div>
            <div className="border-b border-border/80 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Performance Metrics
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/80 bg-slate-50/30 dark:bg-slate-900/30 text-left font-semibold text-muted-foreground">
                    <th className="py-2.5 px-4">Metric</th>
                    <th className="py-2.5 px-3 text-right">This Week</th>
                    <th className="py-2.5 px-3 text-right">Last Week</th>
                    <th className="py-2.5 px-3 text-right">Target</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                    <th className="py-2.5 px-4 text-right">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {snapshotTrends.map(({ snap, trend }) => (
                    <tr key={snap.metricKey} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">
                        <Link
                          href={`/employee/${employee.id}?period=${period}&metric=${snap.metricKey}`}
                          className="flex items-center gap-2 hover:text-[#009ca6] transition-colors"
                        >
                          <MetricIcon
                            metricKey={snap.metricKey}
                            category={snap.category}
                            className="h-3.5 w-3.5 text-[#009ca6]"
                          />
                          <span>{snap.metricName}</span>
                        </Link>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-foreground">
                        <MetricValue
                          value={snap.currentValue}
                          unit={snap.unit}
                          valueType={snap.valueType}
                        />
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground">
                        <MetricValue
                          value={snap.previousValue}
                          unit={snap.unit}
                          valueType={snap.valueType}
                        />
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground">
                        {snap.target ? (
                          <MetricValue
                            value={snap.target.targetValue}
                            unit={snap.unit}
                            valueType={snap.valueType}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex justify-end">
                          <StatusBadge status={snap.status.status} />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end">
                          <TrendSparkline
                            values={trend}
                            direction={snap.direction}
                            width={64}
                            height={18}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="border-t border-border/80 px-5 py-3 bg-slate-50/30 dark:bg-slate-900/30">
            <Link
              href={`/employee/${employee.id}?period=${period}`}
              className="text-xs font-semibold text-[#009ca6] hover:underline flex items-center gap-1"
            >
              <span>View all metrics</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>

        {/* Bottom-Left: HISTORICAL PERFORMANCE */}
        <Card className="flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex items-center justify-between border-b border-border/80 px-5 py-3 bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Historical Performance
              </h2>
              {/* Metric links pill group */}
              <div className="flex items-center gap-1.5">
                {summary.metricSnapshots.length > 1 && (
                  <div className="flex items-center gap-1 rounded-md border border-border/80 p-0.5 text-xs bg-card">
                    {summary.metricSnapshots.map((snap) => {
                      const isActive = (chartSnapshot?.metricKey ?? "") === snap.metricKey;
                      return (
                        <Link
                          key={snap.metricKey}
                          href={`/employee/${employee.id}?period=${period}&metric=${snap.metricKey}`}
                          className={cn(
                            "px-2 py-0.5 rounded text-[11px] font-semibold transition-colors",
                            isActive
                              ? "bg-teal-50 text-[#009ca6] dark:bg-teal-950/60 font-bold"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {snap.metricName}
                        </Link>
                      );
                    })}
                  </div>
                )}
                <span className="text-[11px] text-muted-foreground font-medium">Last 12 Weeks</span>
              </div>
            </div>
            <CardContent className="p-5">
              {chartSnapshot && (
                <MetricHistoryChart
                  history={history}
                  target={chartSnapshot.target?.targetValue ?? null}
                  unit={chartSnapshot.unit}
                  valueType={chartSnapshot.valueType}
                />
              )}
            </CardContent>
          </div>
          <div className="border-t border-border/80 px-5 py-3 bg-slate-50/30 dark:bg-slate-900/30">
            <Link
              href={`/employee/${employee.id}?period=${period}`}
              className="text-xs font-semibold text-[#009ca6] hover:underline flex items-center gap-1"
            >
              <span>View full history</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>

        {/* Bottom-Right: CONTEXT */}
        <Card className="flex flex-col justify-between overflow-hidden">
          <div>
            <div className="border-b border-border/80 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Context
              </h2>
            </div>
            <CardContent className="p-5 space-y-4">
              <ContextNoteForm employeeId={employee.id} />
              <Tabs defaultValue="overview">
                <TabsList className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                  {CONTEXT_TABS.map((tab) => (
                    <TabsTrigger
                      key={tab.key}
                      value={tab.key}
                      className="text-xs font-semibold px-2.5 py-1 rounded-md"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="overview" className="pt-3">
                  <ContextList items={contextRows.slice(0, 4)} />
                </TabsContent>
                {CONTEXT_TABS.filter((t) => t.key !== "overview").map((tab) => (
                  <TabsContent key={tab.key} value={tab.key} className="pt-3">
                    <ContextList items={contextRows.filter((c) => c.contextType === tab.key)} />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </div>
        </Card>
      </div>

      {/* Provenance Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border/80 pt-5 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>
            Employee ID: <span className="font-semibold text-foreground">10234</span>
          </span>
          <span>•</span>
          <span>
            Hire Date: <span className="font-semibold text-foreground">Feb 14, 2023</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>
            Data sources:{" "}
            <span className="font-semibold text-foreground">{sourceNames.join(", ")}</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <span>Last updated: 8:30 AM today</span>
            <RotateCw className="h-3 w-3" />
          </span>
        </div>
      </footer>
    </div>
  );
}

function ContextList({
  items,
}: {
  items: Array<{
    id: string;
    title: string;
    summary: string | null;
    occurredAt: Date;
    contextType?: string;
  }>;
}) {
  if (items.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground">
        <FileText className="h-6 w-6 mx-auto mb-1.5 opacity-60" />
        <p>Nothing recorded yet in this category.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-[#009ca6] dark:bg-teal-950/60 mt-0.5">
              <Star className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground">{item.title}</p>
              {item.summary && (
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  {item.summary}
                </p>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </li>
      ))}
    </ul>
  );
}

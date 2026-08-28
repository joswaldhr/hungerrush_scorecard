import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getEffectiveManagerContext, getAssignedEmployees } from "@/lib/auth/authorization";
import { generateEmployeeSummary } from "@/lib/domain/briefings/generate";
import { getMetricHistory } from "@/lib/domain/metrics/queries";
import { getEmployeeContext } from "@/lib/domain/context/queries";
import { StatusBadge } from "@/components/status-badge";
import { TrendIndicator } from "@/components/trend-indicator";
import { TrendSparkline } from "@/components/trend-sparkline";
import { MetricHistoryChart } from "@/components/metric-history-chart";
import { MetricValue } from "@/components/metric-value";
import { DataFreshness } from "@/components/data-freshness";
import { BriefingSection } from "@/components/briefing-section";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, BarChart3, FileText, Users } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { teams, externalIdentities, dataSources } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cn, initials } from "@/lib/utils";

const PERIODS = [
  { key: "this_week", label: "This Week", weeksAgo: 0, span: 1 },
  { key: "last_week", label: "Last Week", weeksAgo: 1, span: 1 },
  { key: "last_4_weeks", label: "4 Weeks", weeksAgo: 0, span: 4 },
  { key: "last_12_weeks", label: "12 Weeks", weeksAgo: 0, span: 12 },
] as const;

type PeriodKey = (typeof PERIODS)[number]["key"];

function periodDates(key: PeriodKey) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentMonday = new Date(now);
  currentMonday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));

  const config = PERIODS.find((p) => p.key === key)!;

  const endMonday = new Date(currentMonday);
  endMonday.setDate(currentMonday.getDate() - config.weeksAgo * 7);

  const startMonday = new Date(endMonday);
  startMonday.setDate(endMonday.getDate() - (config.span - 1) * 7);

  const sunday = new Date(endMonday);
  sunday.setDate(endMonday.getDate() + 6);

  const prevStart = new Date(startMonday);
  prevStart.setDate(startMonday.getDate() - config.span * 7);

  return {
    periodStart: startMonday.toISOString().split("T")[0]!,
    periodEnd: sunday.toISOString().split("T")[0]!,
    previousPeriodStart: prevStart.toISOString().split("T")[0]!,
    now: now.getTime(),
  };
}

const CONTEXT_TABS = [
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
    return <EmptyState icon={Users} title="No team" description="This employee is not assigned to a team." />;
  }

  const team = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .then((r) => r[0]);
  const teamName = team?.name ?? "Unknown Team";

  const { periodStart, periodEnd, previousPeriodStart, now } = periodDates(period);

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

  const metricsOnTarget = summary.metricSnapshots.filter(
    (s) => s.status.status === "on_target"
  ).length;
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
  const sourceNames = [...new Set(sourceRows.map((s) => s.displayName))];

  return (
    <div className="max-w-5xl space-y-6">
      {/* Back nav */}
      <div>
        <Link href="/team" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to team
        </Link>
      </div>

      {/* Identity */}
      <header className="flex flex-wrap items-start gap-4">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="text-sm">{initials(employee.displayName)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">{employee.displayName}</h1>
            <StatusBadge status={summary.overallStatus} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {employee.jobTitle && `${employee.jobTitle} · `}
            {teamName}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5 text-xs">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/employee/${employee.id}?period=${p.key}${metricParam ? `&metric=${metricParam}` : ""}`}
              aria-pressed={period === p.key}
              className={cn(
                "rounded px-2.5 py-1",
                period === p.key
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <Link
          href={`/one-on-ones/${employee.id}`}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Prepare 1:1
        </Link>
      </header>

      <Separator />

      {/* Executive Summary */}
      <Card>
        <CardContent className="py-4 px-5">
          <p className="text-sm text-foreground leading-relaxed">{summary.executiveSummary.text}</p>
          <div className="mt-3 flex flex-wrap gap-6 text-xs text-muted-foreground">
            <span>
              <span className="text-lg font-semibold text-foreground">{metricsOnTarget}</span> /{" "}
              {summary.metricSnapshots.length} on target
            </span>
            <span>
              <span className="text-lg font-semibold text-status-on-track">{improvingCount}</span>{" "}
              improving
            </span>
            <span>
              <span className="text-lg font-semibold text-status-attention">
                {decliningSignificantly}
              </span>{" "}
              declining significantly
            </span>
          </div>
          <DataFreshness freshnessAt={summary.meta.dataFreshnessAt} now={now} className="mt-2" />
        </CardContent>
      </Card>

      {summary.changes.length === 0 && summary.metricSnapshots.length === 0 && (
        <EmptyState
          icon={BarChart3}
          title="No metric data"
          description="No metrics are configured for this employee's team."
        />
      )}

      {/* Two-column layout at lg */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* What Changed */}
          {summary.changes.length > 0 && (
            <BriefingSection title="What changed this week">
              <div className="space-y-1.5">
                {summary.changes.map((change) => {
                  const pct =
                    change.changePercent !== null
                      ? Math.abs(change.changePercent).toFixed(0)
                      : null;
                  return (
                    <div
                      key={change.metricKey}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-sm text-foreground">{change.metricName}</span>
                      <div className="flex items-center gap-2">
                        <MetricValue
                          value={change.previousValue}
                          unit={change.unit}
                          valueType={change.valueType}
                          className="text-sm text-muted-foreground"
                        />
                        <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                        <MetricValue
                          value={change.currentValue}
                          unit={change.unit}
                          valueType={change.valueType}
                          className="text-sm font-medium"
                        />
                        {change.changeDirection !== "new" &&
                          change.changeDirection !== "stable" &&
                          pct && (
                            <TrendIndicator direction={change.changeDirection} value={`${pct}%`} />
                          )}
                        {change.changeDirection === "stable" && (
                          <TrendIndicator direction="stable" value="stable" />
                        )}
                        {change.changeDirection === "new" && (
                          <span className="text-xs text-muted-foreground">new</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </BriefingSection>
          )}

          {/* Historical Performance */}
          {chartSnapshot && (
            <BriefingSection title="Historical performance">
              {summary.metricSnapshots.length > 1 && (
                <div className="flex items-center gap-1 rounded-md border border-border p-0.5 text-xs">
                  {summary.metricSnapshots.map((snap) => (
                    <Link
                      key={snap.metricKey}
                      href={`/employee/${employee.id}?period=${period}&metric=${snap.metricKey}`}
                      aria-pressed={chartSnapshot.metricKey === snap.metricKey}
                      className={cn(
                        "rounded px-2 py-1",
                        chartSnapshot.metricKey === snap.metricKey
                          ? "bg-accent/10 text-accent"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {snap.metricName}
                    </Link>
                  ))}
                </div>
              )}
              <Card>
                <CardContent className="py-4 px-5">
                  <MetricHistoryChart
                    history={history}
                    target={chartSnapshot.target?.targetValue ?? null}
                    unit={chartSnapshot.unit}
                    valueType={chartSnapshot.valueType}
                  />
                </CardContent>
              </Card>
            </BriefingSection>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Performance Metrics */}
          {summary.metricSnapshots.length > 0 && (
            <BriefingSection title="Performance metrics">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Employee performance metrics</caption>
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-muted-foreground">Metric</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Current</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">
                        Previous
                      </th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Target</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Status</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshotTrends.map(({ snap, trend }) => (
                      <tr key={snap.metricKey} className="border-b last:border-0">
                        <td className="py-2.5">
                          <span className="text-foreground">{snap.metricName}</span>
                          {snap.qualityStatus !== "complete" && (
                            <span className="ml-1.5 text-xs text-status-watch">
                              ({snap.qualityStatus})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          <MetricValue
                            value={snap.currentValue}
                            unit={snap.unit}
                            valueType={snap.valueType}
                            className="font-medium"
                          />
                        </td>
                        <td className="py-2.5 text-right text-muted-foreground">
                          <MetricValue
                            value={snap.previousValue}
                            unit={snap.unit}
                            valueType={snap.valueType}
                          />
                        </td>
                        <td className="py-2.5 text-right text-muted-foreground">
                          {snap.target ? (
                            <MetricValue
                              value={snap.target.targetValue}
                              unit={snap.unit}
                              valueType={snap.valueType}
                            />
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          <StatusBadge status={snap.status.status} />
                        </td>
                        <td className="py-2.5 text-right">
                          <div className="flex justify-end">
                            <TrendSparkline values={trend} direction={snap.direction} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </BriefingSection>
          )}

          {/* Context */}
          <BriefingSection title="Context">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                {CONTEXT_TABS.map((tab) => (
                  <TabsTrigger key={tab.key} value={tab.key}>
                    {tab.label} ({contextRows.filter((c) => c.contextType === tab.key).length})
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview">
                <ContextList items={contextRows.slice(0, 5)} />
              </TabsContent>
              {CONTEXT_TABS.map((tab) => (
                <TabsContent key={tab.key} value={tab.key}>
                  <ContextList items={contextRows.filter((c) => c.contextType === tab.key)} />
                </TabsContent>
              ))}
            </Tabs>
          </BriefingSection>
        </div>
      </div>

      {/* Provenance footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
        <span>
          Data sources: {sourceNames.length > 0 ? sourceNames.join(", ") : "None connected"}
        </span>
        <DataFreshness freshnessAt={summary.meta.dataFreshnessAt} now={now} />
      </div>
    </div>
  );
}

function ContextList({
  items,
}: {
  items: Array<{ id: string; title: string; summary: string | null; occurredAt: Date }>;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Nothing recorded yet"
        description="Context will appear here once it's available."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="text-sm">
          <p className="font-medium text-foreground">{item.title}</p>
          {item.summary && <p className="text-muted-foreground">{item.summary}</p>}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.occurredAt.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </li>
      ))}
    </ul>
  );
}

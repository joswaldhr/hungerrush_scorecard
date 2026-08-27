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
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { teams, externalIdentities, dataSources } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cn } from "@/lib/utils";

function weekDates(weeksAgo: number) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) - weeksAgo * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  return {
    periodStart: monday.toISOString().split("T")[0]!,
    periodEnd: sunday.toISOString().split("T")[0]!,
    previousPeriodStart: prevMonday.toISOString().split("T")[0]!,
    now: now.getTime(),
  };
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// Context items are a free-text `context_type` column (no DB-level enum).
// This is the taxonomy the manager-facing Context panel groups by; a future
// connector or manual-entry feature should write one of these values.
//
// The peer/peer-checked class names below must appear as literal strings —
// Tailwind's build-time scanner greps source text for class tokens and can't
// see dynamically interpolated ones (`peer/${key}`), so each tab is spelled
// out rather than templated.
const CONTEXT_TABS = [
  {
    key: "coaching",
    label: "Coaching",
    peer: "peer/coaching sr-only",
    label_cls:
      "cursor-pointer border-b-2 border-transparent pb-1 text-muted-foreground peer-checked/coaching:border-accent peer-checked/coaching:text-foreground",
    panel_cls: "order-2 hidden w-full pt-3 peer-checked/coaching:block",
  },
  {
    key: "quality_review",
    label: "Quality",
    peer: "peer/quality sr-only",
    label_cls:
      "cursor-pointer border-b-2 border-transparent pb-1 text-muted-foreground peer-checked/quality:border-accent peer-checked/quality:text-foreground",
    panel_cls: "order-2 hidden w-full pt-3 peer-checked/quality:block",
  },
  {
    key: "attendance",
    label: "Attendance",
    peer: "peer/attendance sr-only",
    label_cls:
      "cursor-pointer border-b-2 border-transparent pb-1 text-muted-foreground peer-checked/attendance:border-accent peer-checked/attendance:text-foreground",
    panel_cls: "order-2 hidden w-full pt-3 peer-checked/attendance:block",
  },
  {
    key: "note",
    label: "Notes",
    peer: "peer/notes sr-only",
    label_cls:
      "cursor-pointer border-b-2 border-transparent pb-1 text-muted-foreground peer-checked/notes:border-accent peer-checked/notes:text-foreground",
    panel_cls: "order-2 hidden w-full pt-3 peer-checked/notes:block",
  },
] as const;

export default async function EmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { id } = await params;
  const { period: periodParam } = await searchParams;
  const period = periodParam === "last_week" ? "last_week" : "this_week";

  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const { ctx, isPlatformAdmin } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) redirect(isPlatformAdmin ? "/admin" : "/");

  const employees = await getAssignedEmployees(ctx);
  const employee = employees.find((e) => e.id === id);
  if (!employee) notFound();

  const teamId = employee.primaryTeamId;
  if (!teamId) {
    return <EmptyState title="No team" description="This employee is not assigned to a team." />;
  }

  const team = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .then((r) => r[0]);
  const teamName = team?.name ?? "Unknown Team";

  const { periodStart, periodEnd, previousPeriodStart, now } = weekDates(
    period === "last_week" ? 1 : 0
  );

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

  const primarySnapshot =
    summary.metricSnapshots.find((s) => s.isPrimary) ?? summary.metricSnapshots[0] ?? null;
  const historyRows = primarySnapshot
    ? await getMetricHistory(ctx, employee.id, primarySnapshot.metricDefinitionId, 12)
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
    <div className="max-w-3xl space-y-6">
      {/* Identity */}
      <header className="flex items-start gap-4">
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
          <Link
            href={`/employee/${employee.id}?period=this_week`}
            className={cn(
              "rounded px-2.5 py-1",
              period === "this_week"
                ? "bg-accent/10 text-accent"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            This Week
          </Link>
          <Link
            href={`/employee/${employee.id}?period=last_week`}
            className={cn(
              "rounded px-2.5 py-1",
              period === "last_week"
                ? "bg-accent/10 text-accent"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Last Week
          </Link>
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
              <span className="text-lg font-semibold text-[oklch(var(--status-on-track))]">
                {improvingCount}
              </span>{" "}
              improving
            </span>
            <span>
              <span className="text-lg font-semibold text-[oklch(var(--status-attention))]">
                {decliningSignificantly}
              </span>{" "}
              declining significantly
            </span>
          </div>
          <DataFreshness freshnessAt={summary.meta.dataFreshnessAt} now={now} className="mt-2" />
        </CardContent>
      </Card>

      {/* What Changed */}
      {summary.changes.length > 0 && (
        <BriefingSection title="What changed this week">
          <div className="space-y-1.5">
            {summary.changes.map((change) => {
              const pct =
                change.changePercent !== null ? Math.abs(change.changePercent).toFixed(0) : null;
              return (
                <div key={change.metricKey} className="flex items-center justify-between py-1.5">
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
                  <th className="pb-2 font-medium text-muted-foreground text-right">Previous</th>
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
                        <span className="ml-1.5 text-xs text-[oklch(var(--status-watch))]">
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

      {summary.changes.length === 0 && summary.metricSnapshots.length === 0 && (
        <EmptyState
          title="No metric data"
          description="No metrics are configured for this employee's team."
        />
      )}

      {/* Historical Performance */}
      {primarySnapshot && (
        <BriefingSection title={`Historical performance — ${primarySnapshot.metricName}`}>
          <Card>
            <CardContent className="py-4 px-5">
              <MetricHistoryChart
                history={history}
                target={primarySnapshot.target?.targetValue ?? null}
                unit={primarySnapshot.unit}
                valueType={primarySnapshot.valueType}
              />
            </CardContent>
          </Card>
        </BriefingSection>
      )}

      {/* Context */}
      <BriefingSection title="Context">
        <div className="flex flex-wrap rounded-lg border p-4">
          <input
            type="radio"
            name="context-tab"
            id="ctx-overview"
            className="peer/overview sr-only"
            defaultChecked
          />
          {CONTEXT_TABS.map((tab) => (
            <input
              key={tab.key}
              type="radio"
              name="context-tab"
              id={`ctx-${tab.key}`}
              className={tab.peer}
            />
          ))}

          <div className="order-1 flex w-full flex-wrap gap-4 border-b pb-2 text-sm">
            <label
              htmlFor="ctx-overview"
              className="cursor-pointer border-b-2 border-transparent pb-1 text-muted-foreground peer-checked/overview:border-accent peer-checked/overview:text-foreground"
            >
              Overview
            </label>
            {CONTEXT_TABS.map((tab) => (
              <label key={tab.key} htmlFor={`ctx-${tab.key}`} className={tab.label_cls}>
                {tab.label} ({contextRows.filter((c) => c.contextType === tab.key).length})
              </label>
            ))}
          </div>

          <div className="order-2 hidden w-full pt-3 peer-checked/overview:block">
            <ContextList items={contextRows.slice(0, 5)} />
          </div>
          {CONTEXT_TABS.map((tab) => (
            <div key={tab.key} className={tab.panel_cls}>
              <ContextList items={contextRows.filter((c) => c.contextType === tab.key)} />
            </div>
          ))}
        </div>
      </BriefingSection>

      {/* Provenance footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
        <span>
          Data sources: {sourceNames.length > 0 ? sourceNames.join(", ") : "None connected"}
        </span>
        <DataFreshness freshnessAt={summary.meta.dataFreshnessAt} now={now} />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Link href="/team" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to team
        </Link>
        <Link href={`/one-on-ones/${employee.id}`} className="text-sm text-accent hover:underline">
          Prepare 1:1 →
        </Link>
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
            {item.occurredAt.toLocaleDateString(undefined, {
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

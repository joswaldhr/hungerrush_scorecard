import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getManagerContext, getAssignedEmployees } from "@/lib/auth/authorization";
import { generateEmployeeSummary } from "@/lib/domain/briefings/generate";
import { StatusBadge } from "@/components/status-badge";
import { TrendIndicator } from "@/components/trend-indicator";
import { MetricValue } from "@/components/metric-value";
import { DataFreshness } from "@/components/data-freshness";
import { BriefingSection } from "@/components/briefing-section";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function weekDates() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
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

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const ctx = await getManagerContext(session.user.email);
  if (!ctx) redirect("/");

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

  const { periodStart, periodEnd, previousPeriodStart, now } = weekDates();

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
                  <div className="flex items-center gap-3">
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
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-muted-foreground">Metric</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Current</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Previous</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Target</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.metricSnapshots.map((snap) => (
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

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
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

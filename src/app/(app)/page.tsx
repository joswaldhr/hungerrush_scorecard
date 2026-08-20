import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getManagerContext, getAssignedTeams } from "@/lib/auth/authorization";
import { generateTeamBriefing } from "@/lib/domain/briefings/generate";
import { StatusBadge } from "@/components/status-badge";
import { TrendIndicator } from "@/components/trend-indicator";
import { MetricValue } from "@/components/metric-value";
import { DataFreshness } from "@/components/data-freshness";
import { BriefingSection } from "@/components/briefing-section";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, Users } from "lucide-react";
import Link from "next/link";

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
    hour: now.getHours(),
  };
}

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const ctx = await getManagerContext(session.user.email);
  if (!ctx) {
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

  const { periodStart, periodEnd, previousPeriodStart, now, hour } = weekDates();

  const briefings = await Promise.all(
    teams.map((team) =>
      generateTeamBriefing(ctx, team.id, team.name, periodStart, periodEnd, previousPeriodStart)
    )
  );

  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">
          {greeting}, {session.user.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Your weekly manager briefing</p>
      </header>

      {briefings.map((briefing, i) => {
        const team = teams[i]!;
        return (
          <div key={team.id} className="space-y-6">
            <BriefingSection title={briefing.teamName}>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  {briefing.employeeCount} employees
                </span>
                <div className="flex gap-2">
                  {briefing.statusDistribution.onTarget > 0 && <StatusBadge status="on_track" />}
                  {briefing.statusDistribution.warning > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {briefing.statusDistribution.warning} watch
                    </span>
                  )}
                  {briefing.statusDistribution.offTarget > 0 && (
                    <span className="text-xs text-[oklch(var(--status-attention))]">
                      {briefing.statusDistribution.offTarget} need attention
                    </span>
                  )}
                </div>
                <DataFreshness freshnessAt={briefing.meta.dataFreshnessAt} now={now} />
              </div>
            </BriefingSection>

            {briefing.needsAttention.length > 0 && (
              <BriefingSection title="Needs attention" count={briefing.needsAttention.length}>
                <div className="space-y-2">
                  {briefing.needsAttention.map((item) => (
                    <Card key={item.employeeId}>
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle
                            className="h-4 w-4 mt-0.5 text-[oklch(var(--status-attention))] shrink-0"
                            aria-hidden="true"
                          />
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
                </div>
              </BriefingSection>
            )}

            {briefing.notableImprovements.length > 0 && (
              <BriefingSection
                title="Notable improvements"
                count={briefing.notableImprovements.length}
              >
                <div className="space-y-2">
                  {briefing.notableImprovements.map((item) => (
                    <Card key={item.employeeId}>
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start gap-3">
                          <TrendingUp
                            className="h-4 w-4 mt-0.5 text-[oklch(var(--status-on-track))] shrink-0"
                            aria-hidden="true"
                          />
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
                </div>
              </BriefingSection>
            )}

            {briefing.teamPerformance.length > 0 && (
              <BriefingSection title="Team performance">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Team performance metrics</caption>
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium text-muted-foreground">Metric</th>
                        <th className="pb-2 font-medium text-muted-foreground text-right">
                          Team Avg
                        </th>
                        <th className="pb-2 font-medium text-muted-foreground text-right">Prev</th>
                        <th className="pb-2 font-medium text-muted-foreground text-right">
                          Change
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {briefing.teamPerformance.map((metric) => {
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </BriefingSection>
            )}

            {briefing.needsAttention.length === 0 &&
              briefing.notableImprovements.length === 0 &&
              briefing.teamPerformance.length === 0 && (
                <EmptyState
                  title="No metric data yet"
                  description="Metric values will appear here once data is available."
                />
              )}
          </div>
        );
      })}
    </div>
  );
}

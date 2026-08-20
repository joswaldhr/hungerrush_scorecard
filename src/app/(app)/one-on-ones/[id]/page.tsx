import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getManagerContext, getAssignedEmployees } from "@/lib/auth/authorization";
import { generateOneOnOne } from "@/lib/domain/briefings/generate";
import { TrendIndicator } from "@/components/trend-indicator";
import { MetricValue } from "@/components/metric-value";
import { DataFreshness } from "@/components/data-freshness";
import { BriefingSection } from "@/components/briefing-section";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, Star, HelpCircle } from "lucide-react";
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

export default async function OneOnOnePage({ params }: { params: Promise<{ id: string }> }) {
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

  const prep = await generateOneOnOne(
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
    <div className="max-w-2xl space-y-6">
      {/* Meeting Header */}
      <header className="flex items-start gap-4">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="text-sm">{initials(employee.displayName)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-foreground">1:1 with {employee.displayName}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {employee.jobTitle && `${employee.jobTitle} · `}
            {teamName}
          </p>
        </div>
      </header>

      <Separator />

      {/* At-a-glance Takeaway */}
      <Card>
        <CardContent className="py-4 px-5">
          <p className="text-sm text-foreground leading-relaxed">{prep.takeaway.text}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{prep.atAGlance.metricsOnTarget}</span>{" "}
              on target
            </span>
            <span>
              <span className="font-medium text-[oklch(var(--status-on-track))]">
                {prep.atAGlance.metricsImproving}
              </span>{" "}
              improving
            </span>
            <span>
              <span className="font-medium text-[oklch(var(--status-attention))]">
                {prep.atAGlance.metricsDeclining}
              </span>{" "}
              declining
            </span>
            <span>of {prep.atAGlance.totalMetrics} total</span>
          </div>
          <DataFreshness freshnessAt={prep.meta.dataFreshnessAt} now={now} className="mt-2" />
        </CardContent>
      </Card>

      {/* What Changed */}
      {prep.whatChanged.length > 0 && (
        <BriefingSection title="What changed this week">
          <div className="space-y-1">
            {prep.whatChanged.map((change) => {
              const pct =
                change.changePercent !== null ? Math.abs(change.changePercent).toFixed(0) : null;
              return (
                <div
                  key={change.metricKey}
                  className="flex items-center justify-between py-1.5 text-sm"
                >
                  <span className="text-foreground">{change.metricName}</span>
                  <div className="flex items-center gap-3">
                    <MetricValue
                      value={change.currentValue}
                      unit={change.unit}
                      valueType={change.valueType}
                      className="font-medium"
                    />
                    {change.changeDirection !== "new" &&
                      change.changeDirection !== "stable" &&
                      pct && (
                        <TrendIndicator direction={change.changeDirection} value={`${pct}%`} />
                      )}
                    {change.changeDirection === "stable" && <TrendIndicator direction="stable" />}
                  </div>
                </div>
              );
            })}
          </div>
        </BriefingSection>
      )}

      {/* What to Recognize */}
      {prep.whatToRecognize.length > 0 && (
        <BriefingSection title="What to recognize">
          <div className="space-y-2">
            {prep.whatToRecognize.map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <Star
                  className="h-4 w-4 mt-0.5 text-[oklch(var(--status-on-track))] shrink-0"
                  aria-hidden="true"
                />
                <span className="text-foreground">{item.text}</span>
              </div>
            ))}
          </div>
        </BriefingSection>
      )}

      {/* What to Discuss */}
      {prep.whatToDiscuss.length > 0 && (
        <BriefingSection title="What to discuss">
          <div className="space-y-2">
            {prep.whatToDiscuss.map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <MessageCircle
                  className="h-4 w-4 mt-0.5 text-[oklch(var(--status-watch))] shrink-0"
                  aria-hidden="true"
                />
                <span className="text-foreground">{item.text}</span>
              </div>
            ))}
          </div>
        </BriefingSection>
      )}

      {/* Suggested Questions */}
      {prep.suggestedQuestions.length > 0 && (
        <BriefingSection title="Suggested questions">
          <div className="space-y-2">
            {prep.suggestedQuestions.map((q, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <HelpCircle
                  className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0"
                  aria-hidden="true"
                />
                <span className="text-muted-foreground italic">{q}</span>
              </div>
            ))}
          </div>
        </BriefingSection>
      )}

      {prep.whatChanged.length === 0 &&
        prep.whatToRecognize.length === 0 &&
        prep.whatToDiscuss.length === 0 && (
          <EmptyState
            title="No data for this period"
            description="Metric data will appear here once available."
          />
        )}

      {/* Navigation */}
      <Separator />
      <div className="flex items-center justify-between">
        <Link
          href={`/employee/${employee.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Full profile
        </Link>
        <Link href="/team" className="text-sm text-muted-foreground hover:text-foreground">
          Back to team
        </Link>
      </div>
    </div>
  );
}

import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getEffectiveManagerContext, getAssignedEmployees } from "@/lib/auth/authorization";
import { generateOneOnOne } from "@/lib/domain/briefings/generate";
import { getEmployeeContext } from "@/lib/domain/context/queries";
import { TrendIndicator } from "@/components/trend-indicator";
import { MetricValue } from "@/components/metric-value";
import { DataFreshness } from "@/components/data-freshness";
import { BriefingSection } from "@/components/briefing-section";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  MessageCircle,
  Star,
  HelpCircle,
  Calendar,
  Clock,
  Users,
  CheckSquare,
  FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { teams, meetingReferences } from "@/lib/db/schema";
import { eq, and, gte, asc } from "drizzle-orm";
import { env } from "@/lib/env";
import { ExternalLink } from "lucide-react";

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

const CONTEXT_ICONS: Record<string, LucideIcon> = {
  coaching: Users,
  quality_review: Star,
  attendance: Clock,
  one_on_one: Calendar,
  action_item: CheckSquare,
  note: FileText,
};

export default async function OneOnOnePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const [nextMeeting] = await db
    .select({
      scheduledStart: meetingReferences.scheduledStart,
      scheduledEnd: meetingReferences.scheduledEnd,
    })
    .from(meetingReferences)
    .where(
      and(
        eq(meetingReferences.employeeId, employee.id),
        eq(meetingReferences.managerUserId, ctx.userId),
        gte(meetingReferences.scheduledStart, new Date())
      )
    )
    .orderBy(asc(meetingReferences.scheduledStart))
    .limit(1);

  const previousContext = await getEmployeeContext(ctx, employee.id, 6);

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
        <div className="shrink-0 rounded-md border border-border px-3 py-2 text-right text-xs">
          {nextMeeting ? (
            <>
              <p className="flex items-center justify-end gap-1.5 font-medium text-foreground">
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                {nextMeeting.scheduledStart.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p className="mt-0.5 flex items-center justify-end gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {nextMeeting.scheduledStart.toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {nextMeeting.scheduledEnd &&
                  ` – ${nextMeeting.scheduledEnd.toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}`}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">No meeting scheduled</p>
          )}
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-6">
          {/* What Changed */}
          {prep.whatChanged.length > 0 && (
            <BriefingSection title="What changed this week">
              <div className="space-y-1">
                {prep.whatChanged.map((change) => {
                  const pct =
                    change.changePercent !== null
                      ? Math.abs(change.changePercent).toFixed(0)
                      : null;
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
                        {change.changeDirection === "stable" && (
                          <TrendIndicator direction="stable" />
                        )}
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
        </div>

        <div className="space-y-6">
          {/* Previous Context */}
          <BriefingSection title="Previous context">
            {previousContext.length === 0 ? (
              <EmptyState
                title="Nothing recorded yet"
                description="Coaching notes, quality reviews, and past 1:1s will show up here."
              />
            ) : (
              <ol className="space-y-3 border-l border-border pl-4">
                {previousContext.map((item) => {
                  const Icon = CONTEXT_ICONS[item.contextType] ?? FileText;
                  return (
                    <li key={item.id} className="relative">
                      <span className="absolute -left-[21px] flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Icon className="h-3 w-3" aria-hidden="true" />
                      </span>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      {item.summary && (
                        <p className="text-sm text-muted-foreground">{item.summary}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {item.occurredAt.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </BriefingSection>

          {/* Meeting Prep Checklist */}
          <BriefingSection title="Meeting prep checklist">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked
                  disabled
                  className="h-4 w-4 rounded border-border"
                  aria-label="Review performance summary — shown above"
                />
                <span className="text-foreground">Review performance summary</span>
              </li>
              <li className="flex items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked={previousContext.length > 0}
                  disabled={previousContext.length === 0}
                  className="h-4 w-4 rounded border-border"
                  aria-label="Review previous context — shown to the left"
                />
                <span className="text-foreground">Review previous context</span>
              </li>
              <li className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 rounded border-border" />
                <span className="text-foreground">Add your own talking points</span>
              </li>
            </ul>
          </BriefingSection>
        </div>
      </div>

      {/* Navigation */}
      <Separator />
      <div className="flex items-center justify-between">
        <Link
          href={`/employee/${employee.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Full profile
        </Link>
        <div className="flex items-center gap-4">
          {env.RIPPLING_MANAGER_URL && (
            <a
              href={env.RIPPLING_MANAGER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-accent hover:underline"
            >
              Open Rippling
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
          <Link href="/team" className="text-sm text-muted-foreground hover:text-foreground">
            Back to team
          </Link>
        </div>
      </div>
    </div>
  );
}

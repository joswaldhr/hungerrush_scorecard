import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getEffectiveManagerContext, getAssignedEmployees } from "@/lib/auth/authorization";
import { generateOneOnOne } from "@/lib/domain/briefings/generate";
import { getEmployeeMetrics } from "@/lib/domain/metrics/queries";
import { getDiscussionTopics } from "@/lib/domain/discussion-topics/queries";
import { getCoachingRecords } from "@/lib/domain/coaching/queries";
import { getTicketReviews } from "@/lib/domain/ticket-reviews/queries";
import { getMeetingHistory } from "@/lib/domain/meetings/queries";
import { getAttendanceSummary } from "@/lib/domain/attendance/queries";
import { MetricValue } from "@/components/metric-value";
import { MetricIcon } from "@/components/metric-icon";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { SectionNav } from "./section-nav";
import { ScorecardSection } from "./scorecard-section";
import { AttendanceSection } from "./attendance-section";
import { MeetingNotesForm } from "./meeting-notes-form";
import { ActionItemsPanel } from "./action-items-panel";
import { DiscussionTopicsPanel } from "./discussion-topics-panel";
import { CoachingPanel } from "./coaching-panel";
import { TicketReviewPanel } from "./ticket-review-panel";
import { MeetingHistory } from "./meeting-history";
import {
  MessageCircle,
  Star,
  TrendingUp,
  ArrowLeft,
  ExternalLink,
  Calendar,
  Users,
  Target,
  Ticket,
  FileText,
  History,
  CheckSquare,
  ClipboardList,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  teams,
  meetingReferences,
  meetingNotes,
  actionItems,
  metricDefinitions,
} from "@/lib/db/schema";
import { eq, and, gte, asc, desc } from "drizzle-orm";
import { env } from "@/lib/env";
import { weekDates, cn } from "@/lib/utils";

export default async function OneOnOnePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { id } = await params;
  const { week: weekParam } = await searchParams;
  const weeksAgo = Math.max(0, Math.min(12, parseInt(weekParam ?? "0", 10) || 0));
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
  const teamName = team?.name ?? "Unknown Team";

  const { periodStart, periodEnd, previousPeriodStart } = weekDates(weeksAgo);

  const [
    prep,
    metricsResult,
    nextMeetingResult,
    existingNoteResult,
    openActionsResult,
    discussionTopicsResult,
    coachingRecordsResult,
    ticketReviewsResult,
    meetingHistoryResult,
    metricDefsResult,
    attendanceSummary,
  ] = await Promise.all([
    generateOneOnOne(
      ctx,
      employee.id,
      employee.displayName,
      employee.jobTitle,
      teamId,
      teamName,
      periodStart,
      periodEnd,
      previousPeriodStart
    ),
    getEmployeeMetrics(ctx, employee.id, teamId, periodStart, previousPeriodStart),
    db
      .select({
        id: meetingReferences.id,
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
      .limit(1),
    db
      .select({
        id: meetingNotes.id,
        outcome: meetingNotes.outcome,
        body: meetingNotes.body,
        lifeCheckIn: meetingNotes.lifeCheckIn,
      })
      .from(meetingNotes)
      .where(
        and(eq(meetingNotes.employeeId, employee.id), eq(meetingNotes.managerUserId, ctx.userId))
      )
      .orderBy(desc(meetingNotes.updatedAt))
      .limit(1),
    db
      .select({
        id: actionItems.id,
        title: actionItems.title,
        status: actionItems.status,
        owner: actionItems.owner,
        priority: actionItems.priority,
        dueDate: actionItems.dueDate,
        completedAt: actionItems.completedAt,
      })
      .from(actionItems)
      .where(
        and(eq(actionItems.employeeId, employee.id), eq(actionItems.managerUserId, ctx.userId))
      )
      .orderBy(asc(actionItems.createdAt))
      .limit(30),
    getDiscussionTopics(ctx, employee.id),
    getCoachingRecords(ctx, employee.id),
    getTicketReviews(ctx, employee.id, 10),
    getMeetingHistory(ctx, employee.id, 8),
    db
      .select({ id: metricDefinitions.id, name: metricDefinitions.name })
      .from(metricDefinitions)
      .where(eq(metricDefinitions.organizationId, ctx.organizationId)),
    getAttendanceSummary(ctx, employee.id),
  ]);

  const nextMeeting = nextMeetingResult[0] ?? null;
  const existingNote = existingNoteResult[0] ?? null;

  const totalMetrics = prep.atAGlance.totalMetrics;
  const onTargetPct =
    totalMetrics > 0 ? Math.round((prep.atAGlance.metricsOnTarget / totalMetrics) * 100) : 0;

  const openActionCount = openActionsResult.filter((i) => i.status === "open").length;
  const pendingTopicCount = discussionTopicsResult.filter((t) => t.status === "pending").length;
  const openCoachingCount = coachingRecordsResult.filter((r) => !r.closedAt).length;

  const hasAttendanceData = attendanceSummary.totalEvents > 0;

  const periodEndDate = new Date(periodEnd + "T00:00:00Z");
  const periodLabel = periodEndDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const sections = [
    { id: "summary", label: "Summary" },
    { id: "scorecard", label: "Scorecard" },
    { id: "discussion", label: "Discussion" },
    { id: "attendance", label: "Attendance", hidden: !hasAttendanceData },
    { id: "tickets", label: "Tickets" },
    { id: "coaching", label: "Coaching" },
    { id: "actions", label: "Actions" },
    { id: "notes", label: "Notes" },
    { id: "history", label: "History" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-0 pb-12">
      {/* Back nav */}
      <div className="mb-4">
        <Link
          href={`/employee/${employee.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Employee Profile</span>
        </Link>
      </div>

      {/* ── Header ────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-foreground tracking-tight">
            1:1 with {employee.displayName}
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-medium text-muted-foreground flex flex-wrap items-center gap-2">
            {employee.jobTitle && <span>{employee.jobTitle}</span>}
            {employee.jobTitle && <span>·</span>}
            <span>{teamName}</span>
            <span>·</span>
            <span>Week ending {periodLabel}</span>
            {nextMeeting && (
              <>
                <span>·</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    Next:{" "}
                    {nextMeeting.scheduledStart.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    at{" "}
                    {nextMeeting.scheduledStart.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/employee/${employee.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3.5 py-1.5 text-xs font-bold text-foreground hover:bg-muted transition-colors shadow-2xs"
          >
            <span>Employee Profile</span>
          </Link>
          {env.RIPPLING_MANAGER_URL && (
            <a
              href={env.RIPPLING_MANAGER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3.5 py-1.5 text-xs font-bold text-foreground hover:bg-muted transition-colors shadow-2xs"
            >
              <span>Open in Rippling</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          )}
        </div>
      </header>

      {/* ── Sticky Section Nav ────────────────────────── */}
      <SectionNav sections={sections} />

      <div className="space-y-8 pt-6">
        {/* ── 1. Weekly Summary ──────────────────────── */}
        <section id="summary">
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="flex items-start gap-4 flex-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 shadow-2xs mt-0.5">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Weekly Summary
                    </h3>
                    <p className="text-sm text-foreground leading-relaxed">{prep.takeaway.text}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Based on this week&apos;s data
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-6 sm:gap-10 border-t lg:border-t-0 lg:border-l border-border/80 pt-4 lg:pt-0 lg:pl-10 shrink-0 w-full lg:w-auto">
                  <div>
                    <p className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground leading-none tabular-nums">
                      {prep.atAGlance.metricsOnTarget} / {totalMetrics}
                    </p>
                    <p className="text-xs font-medium text-muted-foreground mt-1.5">On target</p>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                      {onTargetPct}%
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground leading-none tabular-nums">
                      {prep.atAGlance.metricsImproving}
                    </p>
                    <p className="text-xs font-medium text-muted-foreground mt-1.5">Improving</p>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      vs last week
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground leading-none tabular-nums">
                      {prep.atAGlance.metricsDeclining}
                    </p>
                    <p className="text-xs font-medium text-muted-foreground mt-1.5">Declining</p>
                    {prep.atAGlance.metricsDeclining > 0 && (
                      <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                        significantly
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What Changed / Recognize / Discuss */}
          {(prep.whatChanged.length > 0 ||
            prep.whatToRecognize.length > 0 ||
            prep.whatToDiscuss.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {/* What Changed */}
              {prep.whatChanged.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border/80 px-5 py-3 bg-slate-50/50 dark:bg-slate-900/50">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      What Changed
                    </h3>
                    <span className="text-[11px] font-bold text-[#009ca6] bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-900 tabular-nums">
                      {prep.whatChanged.length}
                    </span>
                  </div>
                  <CardContent className="p-4 space-y-2">
                    {prep.whatChanged.map((change) => {
                      const pct =
                        change.changePercent !== null
                          ? Math.abs(change.changePercent).toFixed(0)
                          : null;
                      const isImproved = change.changeDirection === "improved";
                      const isDeclined = change.changeDirection === "declined";
                      return (
                        <div
                          key={change.metricKey}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border/40"
                        >
                          <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                            <MetricIcon
                              metricKey={change.metricKey}
                              category={change.category}
                              className="h-3.5 w-3.5 text-[#009ca6]"
                            />
                            {change.metricName}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">
                              <MetricValue
                                value={change.currentValue}
                                unit={change.unit}
                                valueType={change.valueType}
                              />
                            </span>
                            {pct && (
                              <span
                                className={cn(
                                  "text-xs font-bold tabular-nums",
                                  isImproved
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : isDeclined
                                      ? "text-rose-600 dark:text-rose-400"
                                      : "text-muted-foreground"
                                )}
                              >
                                {isImproved ? `↑${pct}%` : isDeclined ? `↓${pct}%` : `→`}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Recognize */}
              {prep.whatToRecognize.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="border-b border-border/80 px-5 py-3 bg-slate-50/50 dark:bg-slate-900/50">
                    <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      <Star className="h-3.5 w-3.5 fill-emerald-500/20" />
                      Recognize
                    </h3>
                  </div>
                  <CardContent className="p-4 space-y-2">
                    {prep.whatToRecognize.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/60"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <p className="text-xs text-foreground leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Discuss */}
              {prep.whatToDiscuss.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="border-b border-border/80 px-5 py-3 bg-slate-50/50 dark:bg-slate-900/50">
                    <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      <MessageCircle className="h-3.5 w-3.5" />
                      Discuss
                    </h3>
                  </div>
                  <CardContent className="p-4 space-y-2">
                    {prep.whatToDiscuss.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/60"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <p className="text-xs text-foreground leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </section>

        {/* ── 2. Scorecard ───────────────────────────── */}
        <section id="scorecard">
          <SectionHeader icon={ClipboardList} title="Scorecard" />
          <ScorecardSection metrics={metricsResult} />
        </section>

        {/* ── 3. Discussion & Check-In ───────────────── */}
        <section id="discussion">
          <SectionHeader
            icon={MessageCircle}
            title="Discussion Topics"
            badge={pendingTopicCount > 0 ? `${pendingTopicCount} pending` : undefined}
            badgeVariant="teal"
          />
          <Card className="overflow-hidden">
            <CardContent className="p-5">
              <DiscussionTopicsPanel employeeId={employee.id} topics={discussionTopicsResult} />
            </CardContent>
          </Card>
          {prep.suggestedQuestions.length > 0 && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              {prep.suggestedQuestions.map((question, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg border border-border/60 bg-slate-50/40 dark:bg-slate-900/40 text-xs text-muted-foreground italic leading-relaxed"
                >
                  &ldquo;{question}&rdquo;
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 4. Attendance & Reliability ─────────────── */}
        {hasAttendanceData && (
          <section id="attendance">
            <SectionHeader icon={Shield} title="Attendance & Reliability" />
            <Card className="overflow-hidden">
              <CardContent className="p-5">
                <AttendanceSection employeeId={employee.id} summary={attendanceSummary} />
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── 5. Ticket / Quality Review ──────────────── */}
        <section id="tickets">
          <SectionHeader
            icon={Ticket}
            title="Ticket Reviews"
            badge={
              ticketReviewsResult.length > 0 ? `${ticketReviewsResult.length} logged` : undefined
            }
            badgeVariant="muted"
          />
          <Card className="overflow-hidden">
            <CardContent className="p-5">
              <TicketReviewPanel employeeId={employee.id} reviews={ticketReviewsResult} />
            </CardContent>
          </Card>
        </section>

        {/* ── 6. Coaching ─────────────────────────────── */}
        <section id="coaching">
          <SectionHeader
            icon={Target}
            title="Coaching"
            badge={openCoachingCount > 0 ? `${openCoachingCount} active` : undefined}
            badgeVariant="amber"
          />
          <Card className="overflow-hidden">
            <CardContent className="p-5">
              <CoachingPanel
                employeeId={employee.id}
                records={coachingRecordsResult}
                metrics={metricDefsResult}
              />
            </CardContent>
          </Card>
        </section>

        {/* ── 7. Action Items ─────────────────────────── */}
        <section id="actions">
          <SectionHeader
            icon={CheckSquare}
            title="Action Items"
            badge={openActionCount > 0 ? `${openActionCount} open` : undefined}
            badgeVariant="teal"
          />
          <Card className="overflow-hidden">
            <CardContent className="p-5">
              <ActionItemsPanel employeeId={employee.id} items={openActionsResult} />
            </CardContent>
          </Card>
        </section>

        {/* ── 8. Meeting Notes ────────────────────────── */}
        <section id="notes">
          <SectionHeader icon={FileText} title="Meeting Notes" />
          <Card className="overflow-hidden">
            <CardContent className="p-5">
              <MeetingNotesForm
                employeeId={employee.id}
                meetingReferenceId={nextMeeting?.id ?? null}
                existing={existingNote}
              />
            </CardContent>
          </Card>
        </section>

        {/* ── 9. Meeting History ──────────────────────── */}
        <section id="history">
          <SectionHeader
            icon={History}
            title="Meeting History"
            badge={meetingHistoryResult.length > 0 ? `${meetingHistoryResult.length}` : undefined}
            badgeVariant="muted"
          />
          <Card className="overflow-hidden">
            <CardContent className="p-5">
              <MeetingHistory entries={meetingHistoryResult} />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  badge,
  badgeVariant = "teal",
}: {
  icon: React.FC<{ className?: string }>;
  title: string;
  badge?: string;
  badgeVariant?: "teal" | "amber" | "muted";
}) {
  const badgeStyles = {
    teal: "text-[#009ca6] bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-900",
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900",
    muted: "text-muted-foreground bg-muted/60 border-border",
  };

  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </h2>
      {badge && (
        <span
          className={cn(
            "text-[11px] font-bold px-2 py-0.5 rounded-full border",
            badgeStyles[badgeVariant]
          )}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

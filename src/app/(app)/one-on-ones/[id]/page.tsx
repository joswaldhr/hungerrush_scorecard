import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getEffectiveManagerContext, getAssignedEmployees } from "@/lib/auth/authorization";
import { generateOneOnOne } from "@/lib/domain/briefings/generate";
import { getEmployeeContext } from "@/lib/domain/context/queries";
import { getDiscussionTopics } from "@/lib/domain/discussion-topics/queries";
import { getCoachingRecords } from "@/lib/domain/coaching/queries";
import { getTicketReviews } from "@/lib/domain/ticket-reviews/queries";
import { getMeetingHistory } from "@/lib/domain/meetings/queries";
import { MetricValue } from "@/components/metric-value";
import { MetricIcon } from "@/components/metric-icon";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { MeetingNotesForm } from "./meeting-notes-form";
import { ActionItemsPanel } from "./action-items-panel";
import { DiscussionTopicsPanel } from "./discussion-topics-panel";
import { CoachingPanel } from "./coaching-panel";
import { TicketReviewPanel } from "./ticket-review-panel";
import { MeetingHistory } from "./meeting-history";
import { OneOnOneTabs } from "./tabs-wrapper";
import {
  MessageCircle,
  Star,
  Sparkles,
  Calendar,
  Clock,
  Users,
  CheckSquare,
  FileText,
  TrendingUp,
  ArrowLeft,
  ExternalLink,
  Quote,
  Target,
  Ticket,
  History,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

const CONTEXT_ICONS: Record<string, LucideIcon> = {
  coaching: Users,
  quality_review: Star,
  attendance: Clock,
  one_on_one: Calendar,
  action_item: CheckSquare,
  note: FileText,
};

export default async function OneOnOnePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { week: weekParam, tab: initialTab } = await searchParams;
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
  const teamName = team?.name ?? "POS Support";

  const { periodStart, periodEnd, previousPeriodStart } = weekDates(weeksAgo);

  // Parallel data fetching
  const [
    prep,
    nextMeetingResult,
    previousContext,
    existingNoteResult,
    openActionsResult,
    discussionTopicsResult,
    coachingRecordsResult,
    ticketReviewsResult,
    meetingHistoryResult,
    metricDefsResult,
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
    getEmployeeContext(ctx, employee.id, 6),
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
  ]);

  const nextMeeting = nextMeetingResult[0] ?? null;
  const existingNote = existingNoteResult[0] ?? null;

  const totalMetrics = prep.atAGlance.totalMetrics;
  const onTargetPct =
    totalMetrics > 0 ? Math.round((prep.atAGlance.metricsOnTarget / totalMetrics) * 100) : 0;

  const openActionCount = openActionsResult.filter((i) => i.status === "open").length;
  const pendingTopicCount = discussionTopicsResult.filter((t) => t.status === "pending").length;
  const openCoachingCount = coachingRecordsResult.filter((r) => !r.closedAt).length;

  // ── Render Sections ──────────────────────────────────────

  const prepareContent = (
    <div className="space-y-6">
      {/* AT A GLANCE */}
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4 flex-1">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 shadow-2xs mt-0.5">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  At a Glance
                </h3>
                <p className="text-sm text-foreground leading-relaxed">{prep.takeaway.text}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6 sm:gap-10 border-t lg:border-t-0 lg:border-l border-border/80 pt-4 lg:pt-0 lg:pl-10 shrink-0 w-full lg:w-auto">
              <div>
                <p className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground leading-none">
                  {prep.atAGlance.metricsOnTarget} / {totalMetrics}
                </p>
                <p className="text-xs font-medium text-muted-foreground mt-1.5">
                  Metrics on target
                </p>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {onTargetPct}%
                </p>
              </div>
              <div>
                <p className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground leading-none">
                  {prep.atAGlance.metricsImproving}
                </p>
                <p className="text-xs font-medium text-muted-foreground mt-1.5">Improving</p>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  vs last week
                </p>
              </div>
              <div>
                <p className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground leading-none">
                  {prep.atAGlance.metricsDeclining}
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

      {/* 3-Column: What Changed, Recognize/Discuss, Context */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* WHAT CHANGED */}
        <Card className="flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                What Changed
              </h2>
              <span className="text-[11px] font-bold text-[#009ca6] bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-900">
                {prep.whatChanged.length}
              </span>
            </div>
            <CardContent className="p-5 space-y-3">
              {prep.whatChanged.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No metric changes recorded.
                </p>
              ) : (
                prep.whatChanged.map((change) => {
                  const pct =
                    change.changePercent !== null
                      ? Math.abs(change.changePercent).toFixed(0)
                      : null;
                  const isImproved = change.changeDirection === "improved";
                  const isDeclined = change.changeDirection === "declined";
                  return (
                    <div
                      key={change.metricKey}
                      className="p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-xs font-bold text-foreground">
                          <MetricIcon
                            metricKey={change.metricKey}
                            category={change.category}
                            className="h-3.5 w-3.5 text-[#009ca6]"
                          />
                          <span>
                            {change.metricName}{" "}
                            {isImproved ? "improved" : isDeclined ? "declined" : "steady"}
                          </span>
                        </span>
                        {pct && (
                          <span
                            className={cn(
                              "text-xs font-bold",
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
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Now at{" "}
                        <span className="font-semibold text-foreground">
                          <MetricValue
                            value={change.currentValue}
                            unit={change.unit}
                            valueType={change.valueType}
                          />
                        </span>
                      </p>
                    </div>
                  );
                })
              )}
            </CardContent>
          </div>
        </Card>

        {/* RECOGNIZE & DISCUSS */}
        <Card className="flex flex-col justify-between overflow-hidden">
          <div>
            <div className="border-b border-border/80 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                What to Recognize & Discuss
              </h2>
            </div>
            <CardContent className="p-5 space-y-5">
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <Star className="h-3.5 w-3.5 fill-emerald-500/20" />
                  <span className="uppercase tracking-wider">What to Recognize</span>
                </div>
                <div className="space-y-2">
                  {prep.whatToRecognize.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No specific highlights this week.
                    </p>
                  ) : (
                    prep.whatToRecognize.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/60"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <p className="text-xs text-foreground leading-relaxed">{item.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span className="uppercase tracking-wider">What to Discuss</span>
                </div>
                <div className="space-y-2">
                  {prep.whatToDiscuss.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No priority discussion topics.</p>
                  ) : (
                    prep.whatToDiscuss.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/60"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <p className="text-xs text-foreground leading-relaxed">{item.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </div>
        </Card>

        {/* PREVIOUS CONTEXT */}
        <Card className="flex flex-col justify-between overflow-hidden">
          <div>
            <div className="border-b border-border/80 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Previous Context
              </h2>
            </div>
            <CardContent className="p-5 space-y-3.5">
              {previousContext.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No prior context notes available.
                </p>
              ) : (
                previousContext.slice(0, 3).map((item) => {
                  const Icon = CONTEXT_ICONS[item.contextType] ?? FileText;
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                          <Icon className="h-3.5 w-3.5 text-[#009ca6]" />
                          <span>{item.title}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {item.occurredAt.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      {item.summary && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                          {item.summary}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </div>
        </Card>
      </div>

      {/* SUGGESTED QUESTIONS */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Suggested Questions
          </h2>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#009ca6] bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-900">
            <Sparkles className="h-3 w-3" />
            <span>AI-Powered</span>
          </span>
        </div>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {prep.suggestedQuestions.map((question, i) => (
              <div
                key={i}
                className="relative flex flex-col justify-between p-4 rounded-xl border border-border/80 bg-slate-50/40 dark:bg-slate-900/40 hover:border-[#009ca6]/40 transition-colors"
              >
                <div className="space-y-2">
                  <Quote className="h-5 w-5 text-[#009ca6] opacity-70" />
                  <p className="text-xs font-semibold text-foreground leading-relaxed italic">
                    &ldquo;{question}&rdquo;
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const duringContent = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Discussion Topics */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Discussion Topics
            </h2>
            {pendingTopicCount > 0 && (
              <span className="text-[11px] font-bold text-[#009ca6] bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-900">
                {pendingTopicCount} pending
              </span>
            )}
          </div>
          <CardContent className="p-5">
            <DiscussionTopicsPanel employeeId={employee.id} topics={discussionTopicsResult} />
          </CardContent>
        </Card>

        {/* Action Items */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Action Items
            </h2>
            {openActionCount > 0 && (
              <span className="text-[11px] font-bold text-[#009ca6] bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-900">
                {openActionCount} open
              </span>
            )}
          </div>
          <CardContent className="p-5">
            <ActionItemsPanel employeeId={employee.id} items={openActionsResult} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coaching */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" />
              Coaching
            </h2>
            {openCoachingCount > 0 && (
              <span className="text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900">
                {openCoachingCount} active
              </span>
            )}
          </div>
          <CardContent className="p-5">
            <CoachingPanel
              employeeId={employee.id}
              records={coachingRecordsResult}
              metrics={metricDefsResult}
            />
          </CardContent>
        </Card>

        {/* Ticket Reviews */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Ticket className="h-3.5 w-3.5" />
              Ticket Reviews
            </h2>
            {ticketReviewsResult.length > 0 && (
              <span className="text-[11px] font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full border border-border">
                {ticketReviewsResult.length} logged
              </span>
            )}
          </div>
          <CardContent className="p-5">
            <TicketReviewPanel employeeId={employee.id} reviews={ticketReviewsResult} />
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const afterContent = (
    <div className="space-y-6">
      {/* Meeting Notes */}
      <Card className="overflow-hidden">
        <div className="border-b border-border/80 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Meeting Notes
          </h2>
        </div>
        <CardContent className="p-5">
          <MeetingNotesForm
            employeeId={employee.id}
            meetingReferenceId={nextMeeting?.id ?? null}
            existing={existingNote}
          />
        </CardContent>
      </Card>

      {/* Meeting History */}
      <Card className="overflow-hidden">
        <div className="border-b border-border/80 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" />
            Meeting History
          </h2>
        </div>
        <CardContent className="p-5">
          <MeetingHistory entries={meetingHistoryResult} />
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Back nav */}
      <div>
        <Link
          href={`/employee/${employee.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Employee Profile</span>
        </Link>
      </div>

      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-foreground tracking-tight">
            1:1 with {employee.displayName}
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-medium text-muted-foreground flex flex-wrap items-center gap-2">
            <span>{employee.jobTitle ?? "Support Specialist"}</span>
            <span>•</span>
            <span>{teamName}</span>
            {nextMeeting && (
              <>
                <span>•</span>
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

      {/* Tabbed Workflow */}
      <OneOnOneTabs
        defaultTab={initialTab}
        prepareContent={prepareContent}
        duringContent={duringContent}
        afterContent={afterContent}
        badges={{
          prepare: prep.whatChanged.length,
          during: openActionCount + pendingTopicCount,
          after: meetingHistoryResult.length,
        }}
      />

      {/* Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border/80 pt-5">
        <Link
          href={`/employee/${employee.id}`}
          className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors shadow-2xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Open Employee Profile</span>
        </Link>
        {env.RIPPLING_MANAGER_URL && (
          <a
            href={env.RIPPLING_MANAGER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-[#009ca6] px-4 py-2 text-xs font-bold text-white hover:bg-[#008b94] transition-all shadow-xs"
          >
            <span>Open in Rippling</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </footer>
    </div>
  );
}

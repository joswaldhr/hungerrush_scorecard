import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getEffectiveManagerContext, getAssignedEmployees } from "@/lib/auth/authorization";
import { getEmployeeMetrics, getMetricHistoryBatch } from "@/lib/domain/metrics/queries";
import { formatCategoryLabel } from "@/lib/domain/metrics/category-labels";
import { StatusBadge } from "@/components/status-badge";
import { MetricCategoryTable } from "@/components/metric-category-table";
import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { deriveOverallStatus } from "@/lib/domain/briefings/generate";
import { ArrowLeft, Calendar, Users } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { teams, users } from "@/lib/db/schema";
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
  };
}

export default async function OneOnOnePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { id } = await params;
  const { period: periodParam } = await searchParams;
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

  const team = await db.select().from(teams).where(eq(teams.id, teamId)).then((r) => r[0]);
  const managerUser = ctx.userId
    ? await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .then((r) => r[0])
    : null;

  const { periodStart, periodEnd, previousPeriodStart } = periodDates(period);

  const rows = await getEmployeeMetrics(ctx, employee.id, teamId, periodStart, previousPeriodStart);
  const overallStatus = deriveOverallStatus(rows);

  const trendByDefinitionId = await getMetricHistoryBatch(
    ctx,
    rows.map((r) => ({ employeeId: employee.id, metricDefinitionId: r.definitionId })),
    4
  ).then((batch) => {
    const result = new Map<string, Array<number | null>>();
    for (const row of rows) {
      const history = batch.get(`${employee.id}:${row.definitionId}`) ?? [];
      result.set(
        row.definitionId,
        history
          .slice()
          .reverse()
          .map((h) => h.numericValue)
      );
    }
    return result;
  });

  const categories = new Map<string | null, typeof rows>();
  for (const row of rows) {
    const forCategory = categories.get(row.category) ?? [];
    forCategory.push(row);
    categories.set(row.category, forCategory);
  }

  const weekRangeFormatted = `Week of ${new Date(`${periodStart}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${new Date(`${periodEnd}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div>
        <Link
          href="/one-on-ones"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to 1:1s</span>
        </Link>
      </div>

      <header className="flex flex-wrap items-center justify-between gap-4">
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
              <StatusBadge status={overallStatus} showDot />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {employee.jobTitle ?? "Support Specialist"} • {team?.name ?? "Team"}
              {managerUser?.displayName ? ` • Manager: ${managerUser.displayName}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center rounded-lg border border-border/80 bg-card p-1 shadow-2xs text-xs font-semibold">
            {PERIODS.map((p) => {
              const active = period === p.key;
              return (
                <Link
                  key={p.key}
                  href={`/one-on-ones/${employee.id}?period=${p.key}`}
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
          <div className="text-[11px] font-medium text-muted-foreground">{weekRangeFormatted}</div>
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No metrics assigned"
          description="This team doesn't have any metrics configured yet."
        />
      ) : (
        <div className="space-y-6">
          {Array.from(categories.entries()).map(([category, categoryRows]) => (
            <MetricCategoryTable
              key={category ?? "uncategorized"}
              title={formatCategoryLabel(category)}
              rows={categoryRows}
              trendByDefinitionId={trendByDefinitionId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

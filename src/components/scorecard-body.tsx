"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge, getStatusLabel } from "@/components/status-badge";
import { MetricCategoryTable } from "@/components/metric-category-table";
import { ScorecardExport, SCORECARD_CAPTURE_ID } from "@/components/scorecard-export";
import type { ScorecardMetric } from "@/components/scorecard-export";
import { WeekNavigator } from "@/components/week-navigator";
import { formatCategoryLabel } from "@/lib/domain/metrics/category-labels";
import { deriveOverallStatus } from "@/lib/domain/metrics/status";
import type { EmployeeMetricRow } from "@/lib/domain/metrics/queries";
import {
  cn,
  initials,
  shiftWeekStart,
  weekBoundsForDate,
  weekDates,
  weeksAgoFor,
  formatWeekRangeShort,
  formatWeekRangeLong,
} from "@/lib/utils";
import { getWeekMetrics } from "@/app/(app)/one-on-ones/[id]/actions";

interface ScorecardBodyProps {
  employeeId: string;
  employeeName: string;
  employeeJobTitle: string | null;
  teamName: string;
  managerName: string | null;
  initialPeriodStart: string;
  initialRows: EmployeeMetricRow[];
}

// The 4 weeks the old tab UI exposed directly -- kept warm in cache so
// jumping between recent weeks is instant even before the user touches
// the navigator.
const CANONICAL_WEEKS_AGO = [0, 1, 2, 3];

export function ScorecardBody({
  employeeId,
  employeeName,
  employeeJobTitle,
  teamName,
  managerName,
  initialPeriodStart,
  initialRows,
}: ScorecardBodyProps) {
  const [periodStart, setPeriodStart] = useState(initialPeriodStart);
  const [rowsByWeek, setRowsByWeek] = useState<Record<string, EmployeeMetricRow[]>>({
    [initialPeriodStart]: initialRows,
  });
  const [loading, setLoading] = useState(false);

  // Weeks we've already fetched (or are fetching), tracked outside state so
  // fetchWeek can check it without a stale closure over rowsByWeek -- only
  // ever mutated from inside fetchWeek's own body (in response to a real
  // request starting/finishing), never during render.
  const knownWeeksRef = useRef<Set<string>>(new Set([initialPeriodStart]));
  const inFlightRef = useRef<Set<string>>(new Set());
  // Tracks the most recent week that actually finished loading, so a
  // navigation to an uncached week can keep showing real data instead of
  // blanking the page while it fetches.
  const [lastLoadedPeriod, setLastLoadedPeriod] = useState(initialPeriodStart);

  const fetchWeek = useCallback(
    async (ps: string, opts: { markLoading: boolean }) => {
      if (knownWeeksRef.current.has(ps) || inFlightRef.current.has(ps)) return;
      inFlightRef.current.add(ps);
      if (opts.markLoading) setLoading(true);
      try {
        const result = await getWeekMetrics(employeeId, ps, shiftWeekStart(ps, -1));
        knownWeeksRef.current.add(ps);
        setRowsByWeek((prev) => ({ ...prev, [ps]: result }));
        setLastLoadedPeriod(ps);
      } finally {
        inFlightRef.current.delete(ps);
        if (opts.markLoading) setLoading(false);
      }
    },
    [employeeId]
  );

  // Prefetch the 4 canonical weeks once on mount, silently -- these don't
  // set the loading indicator since the user hasn't asked for them yet.
  useEffect(() => {
    async function prefetchCanonicalWeeks() {
      for (const weeksAgo of CANONICAL_WEEKS_AGO) {
        const { periodStart: ps } = weekDates(weeksAgo);
        await fetchWeek(ps, { markLoading: false });
      }
    }
    void prefetchCanonicalWeeks();
  }, [fetchWeek]);

  // Browser Back/Forward: history.pushState below doesn't reload the page,
  // so we need our own popstate handling to stay in sync with it.
  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      const week = params.get("week");
      if (week) {
        setPeriodStart(week);
        void fetchWeek(week, { markLoading: true });
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [fetchWeek]);

  const navigate = useCallback(
    (ps: string) => {
      setPeriodStart(ps);
      const url = new URL(window.location.href);
      url.searchParams.set("week", ps);
      window.history.pushState(null, "", url.toString());
      void fetchWeek(ps, { markLoading: true });
      void fetchWeek(shiftWeekStart(ps, -1), { markLoading: false });
      void fetchWeek(shiftWeekStart(ps, 1), { markLoading: false });
    },
    [fetchWeek]
  );

  const rows = rowsByWeek[periodStart];
  const displayRows = rows ?? rowsByWeek[lastLoadedPeriod] ?? initialRows;

  const periodEnd = weekBoundsForDate(periodStart).periodEnd;
  const previousPeriodStart = shiftWeekStart(periodStart, -1);
  const previousPeriodEnd = shiftWeekStart(periodEnd, -1);
  const weeksAgo = weeksAgoFor(periodStart);

  const overallStatus = deriveOverallStatus(displayRows);
  const offTargetNames = useMemo(
    () => displayRows.filter((r) => r.status.status === "off_target").map((r) => r.name),
    [displayRows]
  );

  const categories = useMemo(() => {
    const map = new Map<string | null, EmployeeMetricRow[]>();
    for (const row of displayRows) {
      const forCategory = map.get(row.category) ?? [];
      forCategory.push(row);
      map.set(row.category, forCategory);
    }
    return map;
  }, [displayRows]);

  const scorecardMetrics: ScorecardMetric[] = useMemo(
    () =>
      displayRows.map((r) => ({
        category: r.category,
        name: r.name,
        currentValue: r.currentValue,
        previousValue: r.previousValue,
        targetValue: r.target?.targetValue ?? null,
        targetType: r.target?.targetType ?? null,
        targetMin: r.target?.targetMin ?? null,
        targetMax: r.target?.targetMax ?? null,
        status: r.status.status,
        unit: r.unit,
        valueType: r.valueType,
      })),
    [displayRows]
  );

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 print:h-10 print:w-10 ring-2 ring-border shadow-xs shrink-0">
            <AvatarFallback className="text-base font-bold bg-slate-100 dark:bg-slate-800 text-foreground">
              {initials(employeeName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-[28px] font-bold text-foreground tracking-tight">
                {employeeName}
              </h1>
              <StatusBadge status={overallStatus} showDot />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {employeeJobTitle ?? "Support Specialist"} • {teamName}
              {managerName ? ` • Manager: ${managerName}` : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Overall status:{" "}
              <span className="font-semibold text-foreground">{getStatusLabel(overallStatus)}</span>
              {offTargetNames.length > 0 && (
                <>
                  {" "}
                  | {offTargetNames.length} metric{offTargetNames.length === 1 ? "" : "s"} outside
                  target: {offTargetNames.join(", ")}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <ScorecardExport
              employeeName={employeeName}
              periodLabel={formatWeekRangeLong(periodStart, periodEnd)}
              metrics={scorecardMetrics}
            />
            <WeekNavigator
              periodStart={periodStart}
              rangeLabel={formatWeekRangeLong(periodStart, periodEnd)}
              weeksAgo={weeksAgo}
              onNavigate={navigate}
              isLoading={loading}
            />
          </div>
        </div>
      </header>

      {/* No "no metrics assigned" branch here -- page.tsx already gates on
          that before this component is ever rendered, and assignments
          (unlike values) don't vary week to week, so it can't become true
          later either. */}
      <div
        id={SCORECARD_CAPTURE_ID}
        className={cn("space-y-6 transition-opacity", loading && !rows && "opacity-50")}
      >
        {Array.from(categories.entries()).map(([category, categoryRows]) => (
          <MetricCategoryTable
            key={category ?? "uncategorized"}
            category={category}
            title={formatCategoryLabel(category)}
            rows={categoryRows}
            currentLabel={formatWeekRangeShort(periodStart, periodEnd)}
            previousLabel={formatWeekRangeShort(previousPeriodStart, previousPeriodEnd)}
          />
        ))}
      </div>
    </>
  );
}

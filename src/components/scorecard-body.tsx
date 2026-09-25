"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge, getStatusLabel } from "@/components/status-badge";
import { MetricCategoryTable } from "@/components/metric-category-table";
import { ScorecardExport, SCORECARD_CAPTURE_ID } from "@/components/scorecard-export";
import type { ScorecardMetric } from "@/components/scorecard-export";
import { WeekNavigator } from "@/components/week-navigator";
import { formatCategoryLabel } from "@/lib/domain/metrics/category-labels";
import { deriveOverallStatus, isReportingPeriodInProgress } from "@/lib/domain/metrics/status";
import type { EmployeeMetricRow } from "@/lib/domain/metrics/queries";
import {
  initials,
  shiftWeekStart,
  weekBoundsForDate,
  resolveReportingWeek,
  weeksAgoFor,
  formatWeekRangeShort,
  formatWeekRangeLong,
} from "@/lib/utils";
import { getWeekMetrics } from "@/app/(app)/one-on-ones/[id]/actions";
import { HISTORICAL_TARGET_REASON } from "@/lib/domain/metrics/availability";

interface ScorecardBodyProps {
  employeeId: string;
  employeeName: string;
  employeeJobTitle: string | null;
  teamName: string;
  managerName: string | null;
  initialPeriodStart: string;
  initialRows: EmployeeMetricRow[];
}

const CACHE_TTL_MS = 60_000;

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
  const [snapshot, setSnapshot] = useState({ periodStart: initialPeriodStart, rows: initialRows });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef(new Map<string, { rows: EmployeeMetricRow[]; loadedAt: number }>());
  const requestRef = useRef(0);
  const selectedPeriodRef = useRef(initialPeriodStart);

  const fetchWeek = useCallback(
    async (ps: string, force = false) => {
      const request = ++requestRef.current;
      selectedPeriodRef.current = ps;
      setPeriodStart(ps);
      setError(null);
      const cached = cacheRef.current.get(ps);
      if (!force && cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
        setSnapshot({ periodStart: ps, rows: cached.rows });
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const rows = await getWeekMetrics(employeeId, ps);
        // A slow response may never replace a more recently requested period.
        if (request !== requestRef.current) return;
        if (cacheRef.current.size >= 8) cacheRef.current.clear();
        cacheRef.current.set(ps, { rows, loadedAt: Date.now() });
        setSnapshot({ periodStart: ps, rows });
      } catch {
        if (request === requestRef.current) {
          setError("Unable to load this week. Please try again.");
        }
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    },
    [employeeId]
  );

  // Seed the cache from the server snapshot; invalidate pending work on unmount.
  useEffect(() => {
    const requests = requestRef;
    cacheRef.current.set(initialPeriodStart, { rows: initialRows, loadedAt: Date.now() });
    return () => {
      requests.current++;
    };
  }, [initialPeriodStart, initialRows]);

  // Browser Back/Forward: history.pushState below doesn't reload the page,
  // so we need our own popstate handling to stay in sync with it.
  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      void fetchWeek(resolveReportingWeek(params.get("week")));
    }
    function onFocus() {
      void fetchWeek(selectedPeriodRef.current, true);
    }
    window.addEventListener("popstate", onPopState);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchWeek]);

  const navigate = useCallback(
    (ps: string) => {
      const week = resolveReportingWeek(ps);
      const url = new URL(window.location.href);
      url.searchParams.set("week", week);
      window.history.pushState(null, "", url.toString());
      void fetchWeek(week);
    },
    [fetchWeek]
  );

  const ready = !loading && !error && snapshot.periodStart === periodStart;
  const displayRows = snapshot.rows;

  const periodEnd = weekBoundsForDate(periodStart).periodEnd;
  const previousPeriodStart = shiftWeekStart(periodStart, -1);
  const previousPeriodEnd = shiftWeekStart(periodEnd, -1);
  const weeksAgo = weeksAgoFor(periodStart);

  const overallStatus = deriveOverallStatus(displayRows, { periodStart, periodEnd });
  const inProgress = isReportingPeriodInProgress(periodStart, periodEnd);
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
        qualityStatus: r.qualityStatus,
        dataFreshnessAt: r.dataFreshnessAt ? new Date(r.dataFreshnessAt).toISOString() : null,
        calculationVersion: r.calculationVersion,
        targetSource: r.target?.source ?? null,
        targetContextStatus: r.targetContextStatus,
      })),
    [displayRows]
  );

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 max-w-full items-start gap-3 sm:gap-4">
          <Avatar className="h-10 w-10 sm:h-16 sm:w-16 print:h-10 print:w-10 ring-2 ring-border shadow-xs shrink-0">
            <AvatarFallback className="text-base font-bold bg-slate-100 dark:bg-slate-800 text-foreground">
              {initials(employeeName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 break-words">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-2xl sm:text-[28px] font-bold text-foreground tracking-tight break-words max-w-full">
                {employeeName}
              </h1>
              {ready && <StatusBadge status={overallStatus} showDot />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {employeeJobTitle ?? "Support Specialist"} • {teamName}
              {managerName ? ` • Manager: ${managerName}` : ""}
            </p>
            {ready && (
              <p className="text-xs text-muted-foreground mt-1">
                Overall status:{" "}
                <span className="font-semibold text-foreground">
                  {getStatusLabel(overallStatus)}
                </span>
                {offTargetNames.length > 0 && (
                  <>
                    {" "}
                    | {offTargetNames.length} metric{offTargetNames.length === 1 ? "" : "s"} outside
                    target: {offTargetNames.join(", ")}
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col items-start gap-2 sm:w-auto sm:items-end">
          <div className="flex w-full min-w-0 flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-center">
            {ready && (
              <ScorecardExport
                key={periodStart}
                employeeName={employeeName}
                periodLabel={`${formatWeekRangeLong(periodStart, periodEnd)}${inProgress ? " — In progress; targets cover the full week" : ""}`}
                previousPeriodLabel={formatWeekRangeLong(previousPeriodStart, previousPeriodEnd)}
                metrics={scorecardMetrics}
              />
            )}
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

      {error ? (
        <div role="alert" className="rounded-lg border p-6">
          <p>{error}</p>
          <button
            type="button"
            className="mt-3 underline"
            onClick={() => void fetchWeek(periodStart, true)}
          >
            Retry
          </button>
        </div>
      ) : !ready ? (
        <div role="status" aria-live="polite" className="rounded-lg border p-6">
          Loading {formatWeekRangeLong(periodStart, periodEnd)}…
        </div>
      ) : (
        <div id={SCORECARD_CAPTURE_ID} className="space-y-6">
          <p className="sr-only" role="status">
            Loaded {formatWeekRangeLong(periodStart, periodEnd)}
          </p>
          {inProgress && (
            <p className="text-xs text-muted-foreground">
              This week is in progress. Targets cover the full week; individual comparisons are
              provisional.
            </p>
          )}
          {displayRows.some((row) => row.targetContextStatus === "historical_unverified") && (
            <p className="text-xs text-muted-foreground">
              {HISTORICAL_TARGET_REASON} Target comparisons are unavailable for this past week.
              Metric selection uses the current team; profile details describe the current employee.
            </p>
          )}
          {displayRows.length === 0 && <p>No metrics assigned for this scorecard.</p>}
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
      )}
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge, getStatusLabel } from "@/components/status-badge";
import { MetricCategoryTable } from "@/components/metric-category-table";
import { ScorecardExport, SCORECARD_CAPTURE_ID } from "@/components/scorecard-export";
import type { ScorecardMetric } from "@/components/scorecard-export";
import { WeekNavigator } from "@/components/week-navigator";
import { formatCategoryLabel } from "@/lib/domain/metrics/category-labels";
import {
  scorecardPresentation,
  type ScorecardRow,
} from "@/lib/domain/metrics/scorecard-presentation";
import type { EmployeeMetricRow } from "@/lib/domain/metrics/queries";
import {
  initials,
  weekBoundsForDate,
  resolveReportingWeek,
  weeksAgoFor,
  formatWeekRangeShort,
  formatWeekRangeLong,
} from "@/lib/utils";
import { getWeekMetrics } from "@/app/(app)/one-on-ones/[id]/actions";
import { HISTORICAL_TARGET_REASON } from "@/lib/domain/metrics/availability";
import { DURATION_CLOCK_NOTE, DURATION_FORMAT_LABEL } from "@/lib/domain/metrics/types";

interface ScorecardBodyProps {
  employeeId: string;
  employeeName: string;
  employeeJobTitle: string | null;
  teamName: string;
  managerName: string | null;
  initialPeriodStart: string;
  initialRows: EmployeeMetricRow[];
  loadWeekAction?: (employeeId: string, periodStart: string) => Promise<EmployeeMetricRow[]>;
  basePath?: "/one-on-ones" | "/demo/one-on-ones";
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
  loadWeekAction = getWeekMetrics,
  basePath = "/one-on-ones",
}: ScorecardBodyProps) {
  const [periodStart, setPeriodStart] = useState(initialPeriodStart);
  const [snapshot, setSnapshot] = useState({ periodStart: initialPeriodStart, rows: initialRows });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef(new Map<string, { rows: EmployeeMetricRow[]; loadedAt: number }>());
  const requestRef = useRef(0);

  const fetchWeek = useCallback(
    async (ps: string, force = false) => {
      const request = ++requestRef.current;
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
        const rows = await loadWeekAction(employeeId, ps);
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
    [employeeId, loadWeekAction]
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
      // An unpinned entry follows last week after rollover; explicit links stay fixed.
      const params = new URLSearchParams(window.location.search);
      void fetchWeek(resolveReportingWeek(params.get("week")), true);
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
  const presentation = scorecardPresentation(snapshot.periodStart, snapshot.rows);
  const displayRows = presentation.rows;
  const periodEnd = weekBoundsForDate(periodStart).periodEnd;
  const weeksAgo = weeksAgoFor(periodStart);
  const { overallStatus, previousPeriodStart, previousPeriodEnd } = presentation;
  const inProgress = presentation.mode === "progress";
  const offTargetNames = displayRows
    .filter((r) => r.displayStatus === "off_target")
    .map((r) => r.name);

  const categories = (() => {
    const map = new Map<string | null, ScorecardRow[]>();
    for (const row of displayRows) {
      const forCategory = map.get(row.category) ?? [];
      forCategory.push(row);
      map.set(row.category, forCategory);
    }
    return map;
  })();

  const scorecardMetrics: ScorecardMetric[] = displayRows.map((r) => ({
    key: r.key,
    category: r.category,
    name: r.name,
    currentValue: r.currentValue,
    previousValue: r.previousValue,
    targetValue: r.target?.targetValue ?? null,
    targetType: r.target?.targetType ?? null,
    targetMin: r.target?.targetMin ?? null,
    targetMax: r.target?.targetMax ?? null,
    status: r.displayStatus,
    unit: r.unit,
    valueType: r.valueType,
    qualityStatus: r.qualityStatus,
    dataFreshnessAt: r.dataFreshnessAt ? new Date(r.dataFreshnessAt).toISOString() : null,
    calculationVersion: r.calculationVersion,
    targetSource: r.target?.source ?? null,
    targetContextStatus: r.targetContextStatus,
    sourceDescription: r.sourceDescription,
    missingReason: r.missingReason,
    sourceContract: r.sourceContract,
    reportingTimeZone: r.reportingTimeZone,
    comparisonUnavailableReason: r.comparisonUnavailableReason,
  }));

  return (
    <>
      <header className="rounded-2xl border border-border/80 bg-card shadow-xs">
        <div className="rounded-t-2xl border-t-4 border-primary p-5 sm:p-6">
          <div className="flex min-w-0 max-w-full items-start gap-3 sm:gap-4">
            <Avatar className="h-12 w-12 sm:h-16 sm:w-16 print:h-10 print:w-10 rounded-2xl shrink-0">
              <AvatarFallback className="rounded-2xl bg-primary/10 text-xl font-semibold text-primary">
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
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {employeeJobTitle ?? "Support Specialist"} • {teamName}
                {managerName ? ` • Manager: ${managerName}` : ""}
              </p>
              {ready && (
                <p
                  className={
                    offTargetNames.length > 0
                      ? "mt-2 text-xs leading-relaxed text-muted-foreground"
                      : "sr-only"
                  }
                >
                  Overall status:{" "}
                  <span className="font-semibold text-foreground">
                    {getStatusLabel(overallStatus)}
                  </span>
                  {offTargetNames.length > 0 && (
                    <>
                      {" "}
                      | {offTargetNames.length} metric{offTargetNames.length === 1 ? "" : "s"}{" "}
                      outside target: {offTargetNames.join(", ")}
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/80 bg-muted/25 px-5 py-4 sm:px-6 print:hidden">
          <div>
            <p className="text-sm font-semibold text-foreground">Choose a reporting week</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Last week for your 1:1. This week for progress.
            </p>
          </div>
          <div className="flex w-full min-w-0 flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-center">
            {ready && (
              <ScorecardExport
                key={periodStart}
                employeeName={employeeName}
                periodStart={presentation.periodStart}
                periodEnd={presentation.periodEnd}
                mode={presentation.mode}
                periodLabel={presentation.periodLabel}
                previousPeriodLabel={presentation.previousPeriodLabel}
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
        <div id={SCORECARD_CAPTURE_ID} className="space-y-5">
          <p className="sr-only" role="status">
            Loaded {formatWeekRangeLong(periodStart, periodEnd)}
          </p>
          <section
            aria-label="Review period and data availability"
            className="rounded-xl border border-primary/20 bg-primary/[0.045] px-5 py-5 sm:px-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {inProgress
                    ? "This week · In progress"
                    : weeksAgo === 1
                      ? "1:1 review · Last week"
                      : "1:1 review · Historical review"}
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
                  {formatWeekRangeLong(periodStart, periodEnd)}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Compared with {presentation.previousPeriodLabel}
                </p>
              </div>
              <Link
                href={`${basePath}/${employeeId}/history?${new URLSearchParams({ returnWeek: presentation.periodStart })}`}
                className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground print:hidden"
                data-html2canvas-ignore="true"
              >
                {basePath === "/demo/one-on-ones" ? "Reporting weeks" : "Stored reporting periods"}
              </Link>
            </div>
            <p className="mt-4 text-sm font-medium">{presentation.availability}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Reported values do not imply certified accuracy. Source observations and definitions
              are in Data details.
              {presentation.qualityWarnings > 0 &&
                ` ${presentation.qualityWarnings} metric${presentation.qualityWarnings === 1 ? " has" : "s have"} data quality warnings.`}
            </p>
            {presentation.reported === 0 && displayRows.length > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                No values are available for this reporting week. Use the arrows or calendar to
                review an older week.
              </p>
            )}
          </section>
          {displayRows.some((row) => row.valueType === "duration") && (
            <p className="rounded-lg border border-border/80 bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              Times use {DURATION_FORMAT_LABEL}. {DURATION_CLOCK_NOTE}
            </p>
          )}
          {inProgress && (
            <p className="border-l-2 border-primary/50 pl-3 text-xs leading-relaxed text-muted-foreground">
              This week is in progress. Targets cover the full week. Values are shown for progress,
              without performance judgments against an unfinished week.
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
              currentHeading={inProgress ? "This week so far" : "Review week"}
            />
          ))}
        </div>
      )}
    </>
  );
}

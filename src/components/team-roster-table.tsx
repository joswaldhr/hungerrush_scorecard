"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/status-badge";
import { TrendSparkline } from "@/components/trend-sparkline";
import { Card } from "@/components/ui/card";
import {
  Search,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  MinusCircle,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";

export interface RosterRow {
  employeeId: string;
  displayName: string;
  jobTitle: string | null;
  overallStatus: "on_track" | "mixed" | "needs_attention" | "no_data";
  keyChange: { name: string; pct: number; improved: boolean; subtitle?: string } | null;
  metricsOnTarget: number;
  metricsOffTarget: number;
  metricsNoData: number;
  metricsTotal: number;
  trend: Array<number | null>;
  trendDirection: "higher_is_better" | "lower_is_better" | "neutral";
  upcomingMeetingAt: string | null;
}

type FilterKey = "all" | "improving" | "declining" | "needs_attention" | "no_change";

const FILTERS: { key: FilterKey; label: string; activeClass: string }[] = [
  {
    key: "all",
    label: "All",
    activeClass: "bg-teal-50 text-[#009ca6] border-[#009ca6] dark:bg-teal-950/60",
  },
  {
    key: "improving",
    label: "Improving",
    activeClass:
      "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400",
  },
  {
    key: "declining",
    label: "Declining",
    activeClass: "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-400",
  },
  {
    key: "needs_attention",
    label: "Needs Attention",
    activeClass:
      "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-400",
  },
  {
    key: "no_change",
    label: "No Change",
    activeClass:
      "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
  },
];

function matchesFilter(row: RosterRow, filter: FilterKey): boolean {
  switch (filter) {
    case "all":
      return true;
    case "improving":
      return row.keyChange !== null && row.keyChange.improved;
    case "declining":
      return row.keyChange !== null && !row.keyChange.improved;
    case "needs_attention":
      return row.overallStatus === "needs_attention" || row.metricsOffTarget > 0;
    case "no_change":
      return row.keyChange === null;
  }
}

export function TeamRosterTable({
  rows,
  allTeams,
  selectedTeamId,
  weeksAgo = 0,
}: {
  rows: RosterRow[];
  allTeams?: Array<{ id: string; name: string }>;
  selectedTeamId?: string | null;
  weeksAgo?: number;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "metrics">("overview");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => matchesFilter(r, filter))
      .filter((r) => (q.length === 0 ? true : r.displayName.toLowerCase().includes(q)));
  }, [rows, filter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  function handleFilterChange(next: FilterKey) {
    setFilter(next);
    setPage(1);
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Filter Toolbar (Dropdowns & Search) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Team Dropdown */}
        <div className="rounded-lg border border-border/80 bg-card p-2 shadow-2xs">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Team
          </label>
          <select
            value={selectedTeamId ?? "all"}
            onChange={(e) => {
              const val = e.target.value;
              router.push(
                `/team${val === "all" ? "" : `?team=${val}`}${weeksAgo > 0 ? `${val === "all" ? "?" : "&"}week=${weeksAgo}` : ""}`
              );
            }}
            className="w-full mt-0.5 bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
          >
            <option value="all">All Teams</option>
            {allTeams?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Period Dropdown */}
        <div className="rounded-lg border border-border/80 bg-card p-2 shadow-2xs">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Period
          </label>
          <select
            value={weeksAgo}
            onChange={(e) => {
              const val = e.target.value;
              router.push(`/team${selectedTeamId ? `?team=${selectedTeamId}&` : "?"}week=${val}`);
            }}
            className="w-full mt-0.5 bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
          >
            <option value="0">This Week</option>
            <option value="1">Last Week</option>
            <option value="4">4 Weeks Ago</option>
          </select>
        </div>

        {/* View Dropdown */}
        <div className="rounded-lg border border-border/80 bg-card p-2 shadow-2xs">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            View
          </label>
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as "overview" | "metrics")}
            className="w-full mt-0.5 bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
          >
            <option value="overview">Overview</option>
            <option value="metrics">Metrics View</option>
          </select>
        </div>

        {/* Filter Dropdown */}
        <div className="rounded-lg border border-border/80 bg-card p-2 shadow-2xs">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Filter
          </label>
          <select
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value as FilterKey)}
            className="w-full mt-0.5 bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
          >
            <option value="all">All Employees</option>
            <option value="improving">Improving</option>
            <option value="declining">Declining</option>
            <option value="needs_attention">Needs Attention</option>
            <option value="no_change">No Change</option>
          </select>
        </div>

        {/* Search */}
        <div className="rounded-lg border border-border/80 bg-card p-2 shadow-2xs col-span-2 sm:col-span-1 flex flex-col justify-center">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search employees..."
              aria-label="Search employees"
              className="w-full bg-transparent py-0.5 pl-7 pr-2 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Main Card Container */}
      <Card className="overflow-hidden">
        {/* Card Header: Tabs (OVERVIEW / METRICS VIEW) + Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 px-5 py-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-6 text-xs font-bold tracking-wider uppercase">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={cn(
                "pb-1 border-b-2 transition-colors",
                activeTab === "overview"
                  ? "border-[#009ca6] text-[#009ca6]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("metrics")}
              className={cn(
                "pb-1 border-b-2 transition-colors",
                activeTab === "metrics"
                  ? "border-[#009ca6] text-[#009ca6]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Metrics View
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => handleFilterChange(f.key)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all",
                    active
                      ? f.activeClass
                      : "border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Employee Table */}
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-foreground">No employees found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try clearing your search or filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Team roster</caption>
              <thead>
                <tr className="border-b border-border/80 bg-slate-50/30 dark:bg-slate-900/30 text-left text-xs font-semibold text-muted-foreground">
                  <th className="py-3 px-5">Employee</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Key Change</th>
                  <th className="py-3 px-4">This Week Summary</th>
                  <th className="py-3 px-4 text-center">Trend (4 Weeks)</th>
                  <th className="py-3 px-4">1:1 Upcoming</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {pageRows.map((row) => {
                  const isKeyImproved = row.keyChange?.improved ?? false;
                  return (
                    <tr
                      key={row.employeeId}
                      onClick={() => router.push(`/employee/${row.employeeId}`)}
                      className="cursor-pointer hover:bg-muted/30 transition-colors group"
                    >
                      {/* Employee Avatar & Info */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 ring-1 ring-border shrink-0">
                            <AvatarFallback className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-foreground">
                              {initials(row.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground group-hover:text-[#009ca6] transition-colors truncate">
                              {row.displayName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {row.jobTitle ?? "Support Specialist"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={row.overallStatus} />
                      </td>

                      {/* Key Change */}
                      <td className="py-3.5 px-4">
                        {row.keyChange ? (
                          <div className="flex items-start gap-1.5">
                            {isKeyImproved ? (
                              <TrendingUp className="h-4 w-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ) : (
                              <TrendingDown className="h-4 w-4 mt-0.5 text-rose-600 dark:text-rose-400 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  "text-xs font-semibold leading-tight",
                                  isKeyImproved
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : "text-rose-700 dark:text-rose-400"
                                )}
                              >
                                {row.keyChange.name} {isKeyImproved ? "improved" : "declined"}{" "}
                                {Math.abs(row.keyChange.pct).toFixed(0)}%
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                {row.keyChange.subtitle ??
                                  (isKeyImproved ? "Consistent improvement" : "Requires attention")}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* This Week Summary */}
                      <td className="py-3.5 px-4">
                        {row.metricsTotal === 0 ? (
                          <span className="text-xs text-muted-foreground">No metrics</span>
                        ) : row.metricsOffTarget > 0 ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>{row.metricsOffTarget} metrics need attention</span>
                          </span>
                        ) : row.metricsNoData === row.metricsTotal ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <MinusCircle className="h-4 w-4 shrink-0" />
                            <span>Awaiting data</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>
                              {row.metricsOnTarget} / {row.metricsTotal - row.metricsNoData} on
                              target
                            </span>
                          </span>
                        )}
                      </td>

                      {/* Trend 4 Weeks */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex justify-center">
                          <TrendSparkline
                            values={row.trend}
                            direction={row.trendDirection}
                            width={76}
                            height={20}
                          />
                        </div>
                      </td>

                      {/* 1:1 Upcoming */}
                      <td className="py-3.5 px-4">
                        {row.upcomingMeetingAt ? (
                          <div className="text-xs leading-tight">
                            <p className="font-semibold text-foreground">
                              {new Date(row.upcomingMeetingAt).toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                            <p className="text-muted-foreground mt-0.5">
                              {new Date(row.upcomingMeetingAt).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            <p className="font-semibold text-slate-400">—</p>
                            <p className="text-[11px]">No meeting</p>
                          </div>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="py-3.5 px-5 text-right">
                        <Link
                          href={`/one-on-ones/${row.employeeId}`}
                          onClick={(e) => e.stopPropagation()}
                          title="Prepare 1:1"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#009ca6] text-[#009ca6] hover:bg-[#009ca6] hover:text-white transition-colors shadow-2xs"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/80 px-5 py-3 text-xs text-muted-foreground bg-slate-50/30 dark:bg-slate-900/30">
            <span>
              Showing {(currentPage - 1) * rowsPerPage + 1} to{" "}
              {Math.min(currentPage * rowsPerPage, filtered.length)} of {filtered.length} employees
            </span>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    aria-current={p === currentPage ? "page" : undefined}
                    className={cn(
                      "h-7 min-w-[28px] px-1.5 rounded-md border text-xs font-semibold transition-colors",
                      p === currentPage
                        ? "border-[#009ca6] bg-teal-50 text-[#009ca6] dark:bg-teal-950/60"
                        : "border-border/80 hover:bg-muted text-foreground"
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span>Rows per page</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-md border border-border/80 bg-card py-1 px-1.5 text-xs font-medium text-foreground focus:outline-none"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

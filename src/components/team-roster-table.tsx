"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/status-badge";
import { TrendIndicator } from "@/components/trend-indicator";
import { TrendSparkline } from "@/components/trend-sparkline";
import { Search, ArrowRight, CheckCircle2, AlertTriangle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RosterRow {
  employeeId: string;
  displayName: string;
  jobTitle: string | null;
  overallStatus: "on_track" | "mixed" | "needs_attention" | "no_data";
  keyChange: { name: string; pct: number; improved: boolean } | null;
  metricsOnTarget: number;
  metricsOffTarget: number;
  metricsNoData: number;
  metricsTotal: number;
  trend: Array<number | null>;
  trendDirection: "higher_is_better" | "lower_is_better" | "neutral";
  upcomingMeetingAt: string | null;
}

type FilterKey = "all" | "improving" | "declining" | "needs_attention" | "no_change";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "improving", label: "Improving" },
  { key: "declining", label: "Declining" },
  { key: "needs_attention", label: "Needs Attention" },
  { key: "no_change", label: "No Change" },
];

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function matchesFilter(row: RosterRow, filter: FilterKey): boolean {
  switch (filter) {
    case "all":
      return true;
    case "improving":
      return row.keyChange !== null && row.keyChange.improved;
    case "declining":
      return row.keyChange !== null && !row.keyChange.improved;
    case "needs_attention":
      return row.overallStatus === "needs_attention";
    case "no_change":
      return row.keyChange === null;
  }
}

export function TeamRosterTable({ rows }: { rows: RosterRow[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => handleFilterChange(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f.key
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search employees..."
            aria-label="Search employees"
            className="w-56 rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No employees match this filter.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Team roster</caption>
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 font-medium text-muted-foreground">Employee</th>
                <th className="pb-2 font-medium text-muted-foreground">Status</th>
                <th className="pb-2 font-medium text-muted-foreground">Key change</th>
                <th className="pb-2 font-medium text-muted-foreground">This week</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">
                  Trend (4 weeks)
                </th>
                <th className="pb-2 font-medium text-muted-foreground">1:1 upcoming</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.employeeId} className="border-b last:border-0">
                  <td className="py-3">
                    <Link
                      href={`/employee/${row.employeeId}`}
                      className="flex items-center gap-3 hover:underline"
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px]">
                          {initials(row.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium text-foreground">{row.displayName}</span>
                        {row.jobTitle && (
                          <p className="text-xs text-muted-foreground">{row.jobTitle}</p>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="py-3">
                    <StatusBadge status={row.overallStatus} />
                  </td>
                  <td className="py-3">
                    {row.keyChange ? (
                      <span className="flex items-center gap-1.5 text-sm">
                        <TrendIndicator direction={row.keyChange.improved ? "improved" : "declined"} />
                        <span className="text-muted-foreground">
                          {row.keyChange.name} {Math.abs(row.keyChange.pct).toFixed(0)}%
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3">
                    {row.metricsTotal === 0 ? (
                      <span className="text-muted-foreground">No metrics</span>
                    ) : row.metricsOffTarget > 0 ? (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <AlertTriangle
                          className="h-3.5 w-3.5 text-[oklch(var(--status-attention))]"
                          aria-hidden="true"
                        />
                        {row.metricsOffTarget} need attention
                      </span>
                    ) : row.metricsNoData === row.metricsTotal ? (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Awaiting data
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2
                          className="h-3.5 w-3.5 text-[oklch(var(--status-on-track))]"
                          aria-hidden="true"
                        />
                        {row.metricsOnTarget} / {row.metricsTotal - row.metricsNoData} on target
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end">
                      <TrendSparkline values={row.trend} direction={row.trendDirection} />
                    </div>
                  </td>
                  <td className="py-3">
                    {row.upcomingMeetingAt ? (
                      <div className="text-xs">
                        <p className="font-medium text-foreground">
                          {new Date(row.upcomingMeetingAt).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-muted-foreground">
                          {new Date(row.upcomingMeetingAt).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No meeting</span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      href={`/one-on-ones/${row.employeeId}`}
                      aria-label={`Prepare 1:1 with ${row.displayName}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-accent text-accent hover:bg-accent/10"
                    >
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {(currentPage - 1) * rowsPerPage + 1} to{" "}
            {Math.min(currentPage * rowsPerPage, filtered.length)} of {filtered.length} employees
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={cn(
                    "rounded-md border px-2 py-1",
                    p === currentPage
                      ? "border-accent text-accent"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

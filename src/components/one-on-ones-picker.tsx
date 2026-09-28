"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { SortControl } from "@/components/sort-control";
import { ArrowUpRight, Search, Users } from "lucide-react";
import { cn, initials } from "@/lib/utils";

export interface PickerEmployee {
  id: string;
  displayName: string;
  jobTitle: string | null;
  line: string | null;
  primaryTeamId: string | null;
}

interface OneOnOnesPickerProps {
  teams: Array<{ id: string; name: string }>;
  employees: PickerEmployee[];
}

const LINE_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  consumer: "Consumer",
};

// Only splits a team's roster into line-based groups when the data actually
// varies by line -- a team where every employee has line === null (e.g. POS,
// which never sets it) renders as a single flat group, same as before this
// was added.
function groupByLine(
  emps: PickerEmployee[]
): Array<{ label: string | null; emps: PickerEmployee[] }> {
  if (!emps.some((e) => e.line)) return [{ label: null, emps }];

  const groups: Array<{ label: string | null; emps: PickerEmployee[] }> = [];
  for (const line of ["restaurant", "consumer"]) {
    const inLine = emps.filter((e) => e.line === line);
    if (inLine.length > 0) groups.push({ label: LINE_LABELS[line]!, emps: inLine });
  }
  const other = emps.filter((e) => !e.line || !Object.keys(LINE_LABELS).includes(e.line));
  if (other.length > 0) groups.push({ label: "Other", emps: other });
  return groups;
}

// Shared header treatment for both a team-level group (only shown for a
// manager who sees more than one team) and a line-level group -- name,
// employee count, and a divider that fills the remaining row width.
function GroupHeading({
  title,
  count,
  level,
}: {
  title: string;
  count: number;
  level: "h2" | "h3";
}) {
  const Heading = level;
  return (
    <div className="flex items-center gap-3">
      <Heading
        className={cn(
          "font-bold text-foreground shrink-0",
          level === "h2" ? "text-base" : "text-sm"
        )}
      >
        {title}
      </Heading>
      <span className="text-xs font-medium text-muted-foreground shrink-0">
        {count} {count === 1 ? "employee" : "employees"}
      </span>
      <div className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  );
}

type SortDir = "asc" | "desc";
const SORT_OPTIONS = [
  { value: "asc" as const, label: "A–Z" },
  { value: "desc" as const, label: "Z–A" },
];

export function OneOnOnesPicker({ teams, employees }: OneOnOnesPickerProps) {
  const [query, setQuery] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? employees.filter((e) => e.displayName.toLowerCase().includes(q)) : employees;
    const sorted = [...base].sort((a, b) => a.displayName.localeCompare(b.displayName));
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [query, employees, sortDir]);

  const byTeam = useMemo(() => {
    const map = new Map<string, PickerEmployee[]>();
    for (const emp of filtered) {
      if (!emp.primaryTeamId) continue;
      const forTeam = map.get(emp.primaryTeamId) ?? [];
      forTeam.push(emp);
      map.set(emp.primaryTeamId, forTeam);
    }
    return map;
  }, [filtered]);

  const hasAnyResults = filtered.length > 0;
  const knownTeamIds = new Set(teams.map((team) => team.id));
  const unassigned = filtered.filter(
    (employee) => !employee.primaryTeamId || !knownTeamIds.has(employee.primaryTeamId)
  );
  const displayGroups: Array<{ id: string | null; name: string; emps: PickerEmployee[] }> = teams
    .map((team) => ({ ...team, emps: byTeam.get(team.id) ?? [] }))
    .filter((team) => team.emps.length > 0);
  if (unassigned.length)
    displayGroups.push({ id: null, name: "Unassigned team", emps: unassigned });
  const needsMappingReview =
    unassigned.length > 0 ||
    filtered.some((employee) => employee.line && !Object.keys(LINE_LABELS).includes(employee.line));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-xs sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employees..."
            aria-label="Search employees"
            className="w-full rounded-lg border border-transparent bg-muted/65 py-3 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <SortControl label="Sort" value={sortDir} options={SORT_OPTIONS} onChange={setSortDir} />
      </div>

      <p role="status" className="sr-only">
        {filtered.length} of {employees.length} employees shown
      </p>
      {needsMappingReview && (
        <p className="text-sm text-muted-foreground">
          Some employees need a team or line assignment review. They remain available below.
        </p>
      )}
      {!hasAnyResults ? (
        <EmptyState icon={Users} title="No matches" description={`No one matches "${query}".`} />
      ) : (
        displayGroups.map((team) => {
          const teamEmps = team.emps;
          const showTeamHeading = true;

          return (
            <div key={team.id ?? "unassigned"} className="space-y-6">
              {showTeamHeading && (
                <GroupHeading title={team.name} count={teamEmps.length} level="h2" />
              )}

              <div className="space-y-6">
                {groupByLine(teamEmps).map((group) => (
                  <div key={group.label ?? "all"} className="space-y-3">
                    {group.label && (
                      <GroupHeading
                        title={group.label}
                        count={group.emps.length}
                        level={showTeamHeading ? "h3" : "h2"}
                      />
                    )}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {group.emps.map((emp) => (
                        <Link
                          key={emp.id}
                          href={`/one-on-ones/${emp.id}`}
                          className="group flex min-h-24 items-center gap-4 rounded-xl border border-border/80 bg-card p-5 shadow-xs transition-colors hover:border-primary/50 hover:bg-primary/[0.035] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          <Avatar className="h-12 w-12 shrink-0 rounded-xl">
                            <AvatarFallback className="rounded-xl bg-primary/10 text-sm font-bold text-primary">
                              {initials(emp.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                              {emp.displayName}
                            </p>
                            {emp.jobTitle && (
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {emp.jobTitle}
                              </p>
                            )}
                          </div>
                          <ArrowUpRight
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-primary"
                          />
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

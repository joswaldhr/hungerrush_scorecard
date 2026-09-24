"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { SortControl } from "@/components/sort-control";
import { ChevronRight, Search, Users } from "lucide-react";
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
      <div className="h-px flex-1 bg-border" />
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
            className="w-full rounded-lg border border-border/80 bg-card py-2 pl-9 pr-3 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#009ca6] shadow-2xs"
          />
        </div>

        <SortControl label="Sort" value={sortDir} options={SORT_OPTIONS} onChange={setSortDir} />
      </div>

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
          const showTeamHeading = displayGroups.length > 1 || team.id === null;

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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {group.emps.map((emp) => (
                        <Link
                          key={emp.id}
                          href={`/one-on-ones/${emp.id}`}
                          className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3.5 py-3 shadow-2xs hover:border-[#009ca6]/50 hover:bg-muted/40 transition-colors group"
                        >
                          <Avatar className="h-10 w-10 ring-1 ring-border shrink-0">
                            <AvatarFallback className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-foreground">
                              {initials(emp.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground group-hover:text-[#009ca6] transition-colors truncate">
                              {emp.displayName}
                            </p>
                            {emp.jobTitle && (
                              <p className="text-xs text-muted-foreground truncate">
                                {emp.jobTitle}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
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

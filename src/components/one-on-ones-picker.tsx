"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ChevronRight, Search, Users } from "lucide-react";
import { initials } from "@/lib/utils";

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
  const other = emps.filter((e) => !e.line);
  if (other.length > 0) groups.push({ label: "Other", emps: other });
  return groups;
}

export function OneOnOnesPicker({ teams, employees }: OneOnOnesPickerProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? employees.filter((e) => e.displayName.toLowerCase().includes(q)) : employees;
  }, [query, employees]);

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

  return (
    <div className="space-y-6">
      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name..."
          aria-label="Search employees"
          className="w-full rounded-lg border border-border/80 bg-card py-2 pl-9 pr-3 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#009ca6] shadow-2xs"
        />
      </div>

      {!hasAnyResults ? (
        <EmptyState icon={Users} title="No matches" description={`No one matches "${query}".`} />
      ) : (
        teams.map((team) => {
          const teamEmps = byTeam.get(team.id) ?? [];
          if (teamEmps.length === 0) return null;

          return (
            <div key={team.id} className="space-y-3">
              {teams.length > 1 && (
                <h2 className="text-sm font-bold text-foreground px-1">{team.name}</h2>
              )}

              <Card className="overflow-hidden">
                {groupByLine(teamEmps).map((group) => (
                  <div key={group.label ?? "all"}>
                    {group.label && (
                      <div className="bg-muted/40 border-b border-border/60 px-5 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          {group.label}
                        </p>
                      </div>
                    )}
                    <div className="divide-y divide-border/60">
                      {group.emps.map((emp) => (
                        <Link
                          key={emp.id}
                          href={`/one-on-ones/${emp.id}`}
                          className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-9 w-9 ring-1 ring-border shrink-0">
                              <AvatarFallback className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-foreground">
                                {initials(emp.displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground group-hover:text-[#009ca6] transition-colors truncate">
                                {emp.displayName}
                              </p>
                              {emp.jobTitle && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {emp.jobTitle}
                                </p>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          );
        })
      )}
    </div>
  );
}

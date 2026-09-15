"use client";

import { useRouter } from "next/navigation";

interface TeamFiltersProps {
  allTeams: Array<{ id: string; name: string }>;
  selectedTeamId: string | null;
  weeksAgo: number;
}

export function TeamFilters({ allTeams, selectedTeamId, weeksAgo }: TeamFiltersProps) {
  const router = useRouter();

  function buildUrl(team: string | null, week: number) {
    const params = new URLSearchParams();
    if (team) params.set("team", team);
    if (week > 0) params.set("week", String(week));
    const qs = params.toString();
    return `/team${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedTeamId ?? "all"}
        onChange={(e) => {
          const val = e.target.value === "all" ? null : e.target.value;
          router.push(buildUrl(val, weeksAgo));
        }}
        className="rounded-lg border border-border/80 bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-2xs focus:outline-none cursor-pointer"
      >
        <option value="all">All Teams</option>
        {allTeams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <select
        value={weeksAgo}
        onChange={(e) => {
          router.push(buildUrl(selectedTeamId, Number(e.target.value)));
        }}
        className="rounded-lg border border-border/80 bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-2xs focus:outline-none cursor-pointer"
      >
        <option value={0}>This Week</option>
        <option value={1}>Last Week</option>
        <option value={2}>2 Weeks Ago</option>
        <option value={3}>3 Weeks Ago</option>
      </select>
    </div>
  );
}

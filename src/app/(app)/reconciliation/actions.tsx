"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { weekDates } from "@/lib/utils";

export function ReconciliationActions({
  teams,
  managedTeamIds,
}: {
  teams: Array<{ id: string; name: string }>;
  managedTeamIds: string[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [error, setError] = useState<string | null>(null);

  const defaults = weekDates();

  async function handleRun() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reconciliation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: selectedTeam || undefined,
          periodStart: defaults.periodStart,
          periodEnd: defaults.periodEnd,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Failed to run reconciliation");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const availableTeams = teams.filter((t) => managedTeamIds.includes(t.id));

  return (
    <Card>
      <CardContent className="py-4 px-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor="team-select"
              className="block text-xs font-medium text-muted-foreground mb-1"
            >
              Team (optional)
            </label>
            <select
              id="team-select"
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="">All employees</option>
              {availableTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Period</p>
            <p className="text-sm text-foreground">
              {defaults.periodStart} &mdash; {defaults.periodEnd}
            </p>
          </div>

          <Button onClick={handleRun} disabled={loading} size="sm">
            {loading ? "Running..." : "Run Reconciliation"}
          </Button>
        </div>

        {error && <p className="mt-2 text-xs text-status-attention">{error}</p>}
      </CardContent>
    </Card>
  );
}

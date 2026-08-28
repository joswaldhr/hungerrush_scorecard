import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getEffectiveManagerContext } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import {
  reconciliationRuns,
  reconciliationResults,
  teams,
  metricDefinitions,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { CheckCircle, XCircle, AlertTriangle, MinusCircle, RefreshCw } from "lucide-react";
import { ReconciliationActions } from "./actions";

function statusIcon(status: string) {
  switch (status) {
    case "match":
      return <CheckCircle className="h-3.5 w-3.5 text-status-on-track" aria-hidden="true" />;
    case "mismatch":
      return <XCircle className="h-3.5 w-3.5 text-status-attention" aria-hidden="true" />;
    case "source_missing":
      return <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />;
    case "cadence_missing":
      return <AlertTriangle className="h-3.5 w-3.5 text-status-watch" aria-hidden="true" />;
    default:
      return null;
  }
}

function statusBadge(status: string) {
  const variant =
    status === "completed"
      ? ("default" as const)
      : status === "failed"
        ? ("destructive" as const)
        : ("secondary" as const);
  return <Badge variant={variant}>{status}</Badge>;
}

export default async function ReconciliationPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const { ctx, isPlatformAdmin } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) redirect(isPlatformAdmin ? "/admin" : "/");

  const runs = await db
    .select()
    .from(reconciliationRuns)
    .where(eq(reconciliationRuns.organizationId, ctx.organizationId))
    .orderBy(desc(reconciliationRuns.startedAt))
    .limit(10);

  const teamList = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.organizationId, ctx.organizationId));

  const teamMap = new Map(teamList.map((t) => [t.id, t.name]));

  const metricDefs = await db
    .select({ key: metricDefinitions.key, name: metricDefinitions.name })
    .from(metricDefinitions)
    .where(eq(metricDefinitions.organizationId, ctx.organizationId));
  const metricNameMap = new Map(metricDefs.map((m) => [m.key, m.name]));

  let latestResults: Array<{
    id: string;
    metricKey: string;
    employeeId: string;
    cadenceValue: number | null;
    sourceValue: number | null;
    absoluteDelta: number | null;
    relativeDeltaPct: number | null;
    status: string;
    cadenceCalculationVersion: number | null;
  }> = [];

  if (runs.length > 0) {
    const assignedIds = new Set(ctx.assignedEmployeeIds);
    const allResults = await db
      .select()
      .from(reconciliationResults)
      .where(eq(reconciliationResults.reconciliationRunId, runs[0]!.id));
    // A run may span employees outside this manager's own assignment (e.g. an
    // org-wide run triggered by someone else) — never show another team's
    // employee-level metric values just because the run itself is org-scoped.
    latestResults = allResults.filter((r) => assignedIds.has(r.employeeId));
  }

  const managedTeamIds = ctx.assignedTeamIds;

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Data Reconciliation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compare Cadence metric values against source system data
        </p>
      </header>

      <ReconciliationActions teams={teamList} managedTeamIds={managedTeamIds} />

      {runs.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          title="No reconciliation runs"
          description="Run a reconciliation to compare Cadence values against source data."
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-foreground">Recent Runs</h2>
            {runs.map((run) => (
              <Card key={run.id}>
                <CardContent className="py-3 px-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {run.periodStart} &mdash; {run.periodEnd}
                        </span>
                        {statusBadge(run.status)}
                      </div>
                      {run.teamId && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Team: {teamMap.get(run.teamId) ?? run.teamId}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{run.totalComparisons} comparisons</p>
                      <p className="text-status-on-track">{run.matchCount} match</p>
                      {run.mismatchCount > 0 && (
                        <p className="text-status-attention">{run.mismatchCount} mismatch</p>
                      )}
                      {run.sourceMissingCount > 0 && <p>{run.sourceMissingCount} source missing</p>}
                      {run.cadenceMissingCount > 0 && (
                        <p className="text-status-watch">
                          {run.cadenceMissingCount} cadence missing
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          {latestResults.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-foreground">
                Latest Run Detail ({latestResults.length} results)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Reconciliation run detail</caption>
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Metric</th>
                      <th className="pb-2 pr-4 text-right">Cadence</th>
                      <th className="pb-2 pr-4 text-right">Source</th>
                      <th className="pb-2 pr-4 text-right">Delta</th>
                      <th className="pb-2 text-right">Delta %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestResults.map((r) => (
                      <tr key={r.id} className="border-b border-border/50">
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-1.5">
                            {statusIcon(r.status)}
                            <span className="text-xs">{r.status.replace(/_/g, " ")}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-4 font-medium">
                          {metricNameMap.get(r.metricKey) ?? r.metricKey.replace(/_/g, " ")}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {r.cadenceValue !== null ? r.cadenceValue.toFixed(1) : "—"}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {r.sourceValue !== null ? r.sourceValue.toFixed(1) : "—"}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {r.absoluteDelta !== null ? r.absoluteDelta.toFixed(2) : "—"}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {r.relativeDeltaPct !== null ? `${r.relativeDeltaPct.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

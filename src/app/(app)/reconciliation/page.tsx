import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getEffectiveManagerContext,
  getAssignedEmployees,
  getVisibleTeamsForManager,
} from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { teams, metricDefinitions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getScopedReconciliationRun,
  getScopedReconciliationRuns,
} from "@/lib/domain/reconciliation/queries";
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
    case "unverified_attribution":
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

  const runs = await getScopedReconciliationRuns(ctx, 10);

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
    employeeName: string;
    unavailableReason: string | null;
    notes: string | null;
    cadenceValue: number | null;
    sourceValue: number | null;
    absoluteDelta: number | null;
    relativeDeltaPct: number | null;
    status: string;
    cadenceCalculationVersion: number | null;
  }> = [];

  if (runs.length > 0) {
    latestResults = (await getScopedReconciliationRun(ctx, runs[0]!.id))?.results ?? [];
  }

  // Not just ctx.assignedTeamIds -- a sub-manager's access can come entirely
  // from individual employee assignments (see getVisibleTeamsForManager),
  // and they still need their own team to appear as a reconciliation option.
  const assignedEmployees = await getAssignedEmployees(ctx);
  const visibleTeams = await getVisibleTeamsForManager(ctx, assignedEmployees);
  const managedTeamIds = visibleTeams.map((t) => t.id);

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Data Reconciliation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compare Cadence metric values against stored source facts for your assigned employees
          (counts require exact matches; other values use the configured tolerance)
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Matching stored values does not verify source completeness or human activity. Ticket
          activity remains unavailable until human attribution is verified.
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {run.periodStart} &mdash; {run.periodEnd}
                        </span>
                        {statusBadge(run.status)}
                      </div>
                      {run.teamId && (
                        <p className="text-xs text-muted-foreground mt-0.5 break-words">
                          Team: {teamMap.get(run.teamId) ?? run.teamId}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground sm:text-right">
                      <p>{run.totalComparisons} comparisons</p>
                      <p className="text-status-on-track">{run.matchCount} match</p>
                      {run.unavailableCount > 0 && (
                        <p>{run.unavailableCount} attribution unavailable</p>
                      )}
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
                      <th className="pb-2 pr-4">Employee</th>
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
                            <span className="text-xs" title={r.unavailableReason ?? undefined}>
                              {r.status === "unverified_attribution"
                                ? "Attribution unavailable"
                                : r.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          {r.notes && !r.unavailableReason && (
                            <p className="mt-1 max-w-64 text-xs text-muted-foreground">{r.notes}</p>
                          )}
                        </td>
                        <td className="py-2 pr-4">{r.employeeName}</td>
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

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getEffectiveManagerContext } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { dataSources, syncRuns, syncErrors } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { DataFreshness } from "@/components/data-freshness";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import { SyncNowButton } from "./actions";

function syncStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4 text-status-on-track" aria-hidden="true" />;
    case "running":
      return <Clock className="h-4 w-4 text-status-watch" aria-hidden="true" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-status-attention" aria-hidden="true" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
  }
}

function sanitizeErrorMessage(message: string): string {
  if (message.length > 200) return message.slice(0, 200) + "...";
  return message;
}

function syncStatusLabel(status: string): string {
  switch (status) {
    case "completed":
      return "Healthy";
    case "running":
      return "Syncing";
    case "failed":
      return "Failed";
    default:
      return "Unknown";
  }
}

export default async function DataHealthPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const { ctx, isPlatformAdmin } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) redirect(isPlatformAdmin ? "/admin" : "/");

  const now = new Date();
  const nowTs = now.getTime();

  const sources = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.organizationId, ctx.organizationId));

  if (sources.length === 0) {
    return (
      <div className="max-w-3xl">
        <EmptyState title="No data sources" description="No data sources have been configured." />
      </div>
    );
  }

  const sourceHealth = await Promise.all(
    sources.map(async (source) => {
      const [latestRun] = await db
        .select()
        .from(syncRuns)
        .where(eq(syncRuns.dataSourceId, source.id))
        .orderBy(desc(syncRuns.startedAt))
        .limit(1);

      const errorList = latestRun
        ? await db.select().from(syncErrors).where(eq(syncErrors.syncRunId, latestRun.id)).limit(5)
        : [];

      return { source, latestRun: latestRun ?? null, errors: errorList };
    })
  );

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Data Health</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Status of external data sources and recent sync activity
        </p>
      </header>

      <div className="space-y-3">
        {sourceHealth.map(({ source, latestRun, errors }) => (
          <Card key={source.id}>
            <CardContent className="py-4 px-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {latestRun ? syncStatusIcon(latestRun.status) : syncStatusIcon("none")}
                  <div>
                    <h2 className="text-sm font-medium text-foreground">{source.displayName}</h2>
                    <p className="text-xs text-muted-foreground">{source.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      latestRun?.status === "completed"
                        ? "default"
                        : latestRun?.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {latestRun ? syncStatusLabel(latestRun.status) : "Never synced"}
                  </Badge>
                  <SyncNowButton dataSourceType={source.type} />
                </div>
              </div>

              {latestRun && (
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <span>{latestRun.recordsIngested} ingested</span>
                  <span>{latestRun.recordsNormalized} normalized</span>
                  {latestRun.recordsSkipped > 0 && <span>{latestRun.recordsSkipped} skipped</span>}
                  {latestRun.errorCount > 0 && (
                    <span className="text-status-attention">{latestRun.errorCount} errors</span>
                  )}
                </div>
              )}

              <div className="mt-2">
                <DataFreshness
                  freshnessAt={source.lastSuccessfulSyncAt?.toISOString() ?? null}
                  now={nowTs}
                />
              </div>

              {errors.length > 0 && (
                <div className="mt-3 space-y-1">
                  {errors.map((err) => (
                    <p key={err.id} className="text-xs text-status-attention">
                      {err.errorType}: {sanitizeErrorMessage(err.message)}
                      {err.retryable && <span className="text-muted-foreground"> (retryable)</span>}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

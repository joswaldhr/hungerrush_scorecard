import { auth } from "@/lib/auth";
import { getManagerContext } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { dataSources, syncRuns, syncErrors } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

function sanitizeErrorMessage(message: string): string {
  if (message.length > 200) return message.slice(0, 200) + "...";
  return message;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getManagerContext(session.user.email);
  if (!ctx) {
    return NextResponse.json({ error: "Not a manager" }, { status: 403 });
  }

  try {
    const sources = await db
      .select()
      .from(dataSources)
      .where(eq(dataSources.organizationId, ctx.organizationId));

    const health = await Promise.all(
      sources.map(async (source) => {
        const [latestRun] = await db
          .select()
          .from(syncRuns)
          .where(eq(syncRuns.dataSourceId, source.id))
          .orderBy(desc(syncRuns.startedAt))
          .limit(1);

        const recentErrors = latestRun
          ? await db
              .select()
              .from(syncErrors)
              .where(eq(syncErrors.syncRunId, latestRun.id))
              .limit(10)
          : [];

        return {
          id: source.id,
          type: source.type,
          displayName: source.displayName,
          status: source.status,
          lastSuccessfulSyncAt: source.lastSuccessfulSyncAt?.toISOString() ?? null,
          latestRun: latestRun
            ? {
                id: latestRun.id,
                status: latestRun.status,
                startedAt: latestRun.startedAt.toISOString(),
                completedAt: latestRun.completedAt?.toISOString() ?? null,
                recordsIngested: latestRun.recordsIngested,
                recordsNormalized: latestRun.recordsNormalized,
                recordsSkipped: latestRun.recordsSkipped,
                errorCount: latestRun.errorCount,
              }
            : null,
          recentErrors: recentErrors.map((e) => ({
            errorType: e.errorType,
            message: sanitizeErrorMessage(e.message),
            retryable: e.retryable,
          })),
        };
      })
    );

    return NextResponse.json({ sources: health });
  } catch (err) {
    logger.error("Failed to fetch sync health", { error: err });
    return NextResponse.json({ error: "Failed to fetch health status" }, { status: 500 });
  }
}

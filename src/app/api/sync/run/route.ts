import { auth } from "@/lib/auth";
import { getEffectiveManagerContext } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { dataSources } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { runSync, ZendeskConnector, AssembledConnector } from "@/lib/connectors";
import type { Connector } from "@/lib/connectors";
import { computeMetricValuesFromFacts } from "@/lib/domain/metrics/compute-values";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isSyncRateLimited } from "@/lib/rate-limit";
import { z } from "zod";

const CONNECTOR_TYPES = ["zendesk", "assembled"] as const;

const CONNECTORS: Record<(typeof CONNECTOR_TYPES)[number], () => Connector> = {
  zendesk: () => new ZendeskConnector(),
  assembled: () => new AssembledConnector(),
};

const syncRunBodySchema = z.object({
  dataSourceType: z.enum(CONNECTOR_TYPES),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ctx } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) {
    return NextResponse.json({ error: "Not a manager" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = syncRunBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `dataSourceType must be one of: ${CONNECTOR_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  const body = parsed.data;

  try {
    const [source] = await db
      .select()
      .from(dataSources)
      .where(
        and(
          eq(dataSources.organizationId, ctx.organizationId),
          eq(dataSources.type, body.dataSourceType)
        )
      );

    if (!source) {
      return NextResponse.json({ error: "Data source not configured" }, { status: 404 });
    }

    if (await isSyncRateLimited(source.id)) {
      return NextResponse.json(
        { error: "A sync for this data source already ran recently. Try again in a few minutes." },
        { status: 429 }
      );
    }

    const connector = CONNECTORS[body.dataSourceType]();
    const result = await runSync(connector, {
      dataSourceId: source.id,
      organizationId: ctx.organizationId,
    });

    const valuesWritten = await computeMetricValuesFromFacts(
      ctx.organizationId,
      body.dataSourceType
    );

    return NextResponse.json({ ...result, valuesWritten });
  } catch (err) {
    logger.error("Sync run failed", { error: err, dataSourceType: body.dataSourceType });
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

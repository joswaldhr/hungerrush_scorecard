import { auth } from "@/lib/auth";
import { getManagerContext } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { dataSources } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { runSync, ZendeskConnector, AssembledConnector } from "@/lib/connectors";
import type { Connector } from "@/lib/connectors";
import { computeMetricValuesFromFacts } from "@/lib/domain/metrics/compute-values";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const CONNECTORS: Record<string, () => Connector> = {
  zendesk: () => new ZendeskConnector(),
  assembled: () => new AssembledConnector(),
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getManagerContext(session.user.email);
  if (!ctx) {
    return NextResponse.json({ error: "Not a manager" }, { status: 403 });
  }

  const body = (await request.json()) as { dataSourceType?: string };
  if (!body.dataSourceType || !(body.dataSourceType in CONNECTORS)) {
    return NextResponse.json(
      { error: `dataSourceType must be one of: ${Object.keys(CONNECTORS).join(", ")}` },
      { status: 400 }
    );
  }

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

    const connector = CONNECTORS[body.dataSourceType]!();
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

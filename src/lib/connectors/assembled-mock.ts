import type {
  Connector,
  ConnectorConfig,
  SyncContext,
  IngestedRecord,
  NormalizedFactInput,
  IdentityMatch,
  HealthStatus,
} from "./types";
import { db } from "@/lib/db";
import { externalIdentities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export class AssembledMockConnector implements Connector {
  readonly sourceType = "assembled";

  async healthCheck(_config: ConnectorConfig): Promise<HealthStatus> {
    return { connected: true, message: "Mock Assembled connector ready", lastSyncAt: null };
  }

  async fetchRecords(
    config: ConnectorConfig,
    ctx: SyncContext
  ): Promise<{ records: IngestedRecord[]; cursor: string | null; hasMore: boolean }> {
    const identities = await db
      .select()
      .from(externalIdentities)
      .where(eq(externalIdentities.dataSourceId, config.dataSourceId));

    const records: IngestedRecord[] = [];
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const periodStart = weekStart.toISOString().split("T")[0]!;
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const periodEnd = weekEnd.toISOString().split("T")[0]!;

    for (let i = 0; i < identities.length; i++) {
      const identity = identities[i]!;
      const seed = i * 2000 + parseInt(ctx.syncRunId.slice(-4), 16);

      records.push({
        externalRecordType: "schedule_adherence",
        externalRecordId: `schedule-${identity.externalId}-${periodStart}`,
        employeeExternalId: identity.externalId,
        occurredAt: now,
        periodStart,
        periodEnd,
        payload: {
          agentId: identity.externalId,
          scheduledMinutes: Math.round(2400 + seededRandom(seed) * 200),
          actualMinutes: Math.round(2300 + seededRandom(seed + 1) * 300),
          adherencePct: Math.round((85 + seededRandom(seed + 2) * 13) * 10) / 10,
          lateArrivals: Math.round(seededRandom(seed + 3) * 3),
          earlyDepartures: Math.round(seededRandom(seed + 4) * 2),
        },
        sourceUpdatedAt: now,
      });
    }

    return { records, cursor: null, hasMore: false };
  }

  normalizeRecords(
    records: Array<{ sourceRecordId: string; payload: Record<string, unknown> }>,
    employeeId: string,
    teamId: string | null,
    periodStart: string,
    periodEnd: string
  ): NormalizedFactInput[] {
    const facts: NormalizedFactInput[] = [];

    for (const { payload } of records) {
      if ("adherencePct" in payload) {
        facts.push({
          employeeId,
          teamId,
          factType: "schedule_adherence",
          numericValue: payload.adherencePct as number,
          textValue: null,
          booleanValue: null,
          unit: "%",
          periodStart,
          periodEnd,
          dimensionsJson: {
            scheduledMinutes: payload.scheduledMinutes,
            actualMinutes: payload.actualMinutes,
          },
        });
      }
    }

    return facts;
  }

  async resolveIdentities(
    config: ConnectorConfig,
    externalIds: string[]
  ): Promise<IdentityMatch[]> {
    const matches: IdentityMatch[] = [];

    for (const extId of externalIds) {
      const identity = await db
        .select()
        .from(externalIdentities)
        .where(eq(externalIdentities.externalId, extId))
        .then((r) => r[0]);

      if (identity) {
        matches.push({
          externalId: extId,
          externalEmail: identity.externalEmail,
          externalDisplayName: identity.externalDisplayName,
          employeeId: identity.employeeId,
          matchMethod: identity.matchMethod,
          matchConfidence: identity.matchConfidence ?? 1,
        });
      }
    }

    return matches;
  }
}

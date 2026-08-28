import type {
  Connector,
  ConnectorConfig,
  SyncContext,
  IngestedRecord,
  NormalizedFactInput,
  IdentityMatch,
  HealthStatus,
  RosterGroupMapping,
  DiscoveredRosterMember,
} from "./types";
import { db } from "@/lib/db";
import { externalIdentities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export class ZendeskMockConnector implements Connector {
  readonly sourceType = "zendesk";

  async healthCheck(_config: ConnectorConfig): Promise<HealthStatus> {
    return { connected: true, message: "Mock Zendesk connector ready", lastSyncAt: null };
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
      const seed = i * 1000 + parseInt(ctx.syncRunId.slice(-4), 16);

      const ticketsResolved = Math.round(30 + seededRandom(seed) * 30);
      records.push({
        externalRecordType: "agent_stats",
        externalRecordId: `stats-${identity.externalId}-${periodStart}`,
        employeeExternalId: identity.externalId,
        occurredAt: now,
        periodStart,
        periodEnd,
        payload: {
          agentId: identity.externalId,
          ticketsResolved,
          avgHandleTimeMinutes: Math.round((8 + seededRandom(seed + 1) * 12) * 10) / 10,
          firstContactResolutionPct: Math.round((60 + seededRandom(seed + 2) * 35) * 10) / 10,
          backlogCount: Math.round(seededRandom(seed + 3) * 15),
        },
        sourceUpdatedAt: now,
      });

      const csatScore = Math.round((70 + seededRandom(seed + 4) * 25) * 10) / 10;
      records.push({
        externalRecordType: "csat_summary",
        externalRecordId: `csat-${identity.externalId}-${periodStart}`,
        employeeExternalId: identity.externalId,
        occurredAt: now,
        periodStart,
        periodEnd,
        payload: {
          agentId: identity.externalId,
          csatScore,
          totalRatings: Math.round(10 + seededRandom(seed + 5) * 40),
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
      if ("ticketsResolved" in payload) {
        facts.push({
          employeeId,
          teamId,
          factType: "tickets_resolved",
          numericValue: payload.ticketsResolved as number,
          textValue: null,
          booleanValue: null,
          unit: "count",
          periodStart,
          periodEnd,
          dimensionsJson: null,
        });
        facts.push({
          employeeId,
          teamId,
          factType: "avg_handle_time",
          numericValue: payload.avgHandleTimeMinutes as number,
          textValue: null,
          booleanValue: null,
          unit: "min",
          periodStart,
          periodEnd,
          dimensionsJson: null,
        });
        if (payload.firstContactResolutionPct != null) {
          facts.push({
            employeeId,
            teamId,
            factType: "first_contact_resolution",
            numericValue: payload.firstContactResolutionPct as number,
            textValue: null,
            booleanValue: null,
            unit: "%",
            periodStart,
            periodEnd,
            dimensionsJson: null,
          });
        }
        if (payload.backlogCount != null) {
          facts.push({
            employeeId,
            teamId,
            factType: "backlog_count",
            numericValue: payload.backlogCount as number,
            textValue: null,
            booleanValue: null,
            unit: "count",
            periodStart,
            periodEnd,
            dimensionsJson: null,
          });
        }
      }

      if ("csatScore" in payload) {
        facts.push({
          employeeId,
          teamId,
          factType: "csat_score",
          numericValue: payload.csatScore as number,
          textValue: null,
          booleanValue: null,
          unit: "%",
          periodStart,
          periodEnd,
          dimensionsJson: null,
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

  async discoverRoster(
    _config: ConnectorConfig,
    _groupMappings: RosterGroupMapping[]
  ): Promise<DiscoveredRosterMember[]> {
    return [];
  }
}

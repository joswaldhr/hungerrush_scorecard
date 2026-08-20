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
import { employees, externalIdentities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export class RipplingMockConnector implements Connector {
  readonly sourceType = "rippling";

  async healthCheck(_config: ConnectorConfig): Promise<HealthStatus> {
    return { connected: true, message: "Mock Rippling connector ready", lastSyncAt: null };
  }

  async fetchRecords(
    config: ConnectorConfig,
    _ctx: SyncContext
  ): Promise<{ records: IngestedRecord[]; cursor: string | null; hasMore: boolean }> {
    const identities = await db
      .select()
      .from(externalIdentities)
      .where(eq(externalIdentities.dataSourceId, config.dataSourceId));

    const records: IngestedRecord[] = [];
    const now = new Date();

    for (const identity of identities) {
      const emp = await db
        .select()
        .from(employees)
        .where(eq(employees.id, identity.employeeId))
        .then((r) => r[0]);

      if (!emp) continue;

      records.push({
        externalRecordType: "employee",
        externalRecordId: `emp-${identity.externalId}`,
        employeeExternalId: identity.externalId,
        occurredAt: now,
        periodStart: null,
        periodEnd: null,
        payload: {
          riplingId: identity.externalId,
          name: emp.displayName,
          email: emp.email,
          jobTitle: emp.jobTitle,
          employmentStatus: emp.employmentStatus,
        },
        sourceUpdatedAt: now,
      });
    }

    return { records, cursor: null, hasMore: false };
  }

  normalizeRecords(
    _records: Array<{ sourceRecordId: string; payload: Record<string, unknown> }>,
    _employeeId: string,
    _teamId: string | null,
    _periodStart: string,
    _periodEnd: string
  ): NormalizedFactInput[] {
    return [];
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

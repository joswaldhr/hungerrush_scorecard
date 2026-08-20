export interface ConnectorConfig {
  dataSourceId: string;
  organizationId: string;
}

export interface SyncContext {
  syncRunId: string;
  dataSourceId: string;
  organizationId: string;
  cursor: string | null;
}

export interface IngestedRecord {
  externalRecordType: string;
  externalRecordId: string;
  employeeExternalId: string | null;
  occurredAt: Date | null;
  periodStart: string | null;
  periodEnd: string | null;
  payload: Record<string, unknown>;
  sourceUpdatedAt: Date | null;
}

export interface NormalizedFactInput {
  employeeId: string;
  teamId: string | null;
  factType: string;
  numericValue: number | null;
  textValue: string | null;
  booleanValue: boolean | null;
  unit: string | null;
  periodStart: string;
  periodEnd: string;
  dimensionsJson: Record<string, unknown> | null;
}

export interface IdentityMatch {
  externalId: string;
  externalEmail: string | null;
  externalDisplayName: string | null;
  employeeId: string;
  matchMethod: string;
  matchConfidence: number;
}

export interface SyncResult {
  recordsIngested: number;
  recordsNormalized: number;
  recordsSkipped: number;
  errorCount: number;
  cursor: string | null;
  hasMore: boolean;
}

export interface HealthStatus {
  connected: boolean;
  message: string;
  lastSyncAt: Date | null;
}

export interface Connector {
  readonly sourceType: string;

  healthCheck(config: ConnectorConfig): Promise<HealthStatus>;

  fetchRecords(
    config: ConnectorConfig,
    ctx: SyncContext
  ): Promise<{ records: IngestedRecord[]; cursor: string | null; hasMore: boolean }>;

  normalizeRecords(
    records: Array<{ sourceRecordId: string; payload: Record<string, unknown> }>,
    employeeId: string,
    teamId: string | null,
    periodStart: string,
    periodEnd: string
  ): NormalizedFactInput[];

  resolveIdentities(config: ConnectorConfig, externalIds: string[]): Promise<IdentityMatch[]>;
}

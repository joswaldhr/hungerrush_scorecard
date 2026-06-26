// Connector interfaces — SACRED. Never change without updating all three connectors.
// Uses Date (not string) because connectors deal with live API calls, not DB rows.

export interface ConnectorMetricResult {
  employeeId: string;
  metricKey: string;
  value: number | null;
  unit: string;
  periodStart: Date;
  periodEnd: Date;
  rawSource: Record<string, unknown>;
}

export interface DataSourceConnector {
  name: string;
  isAvailable: boolean;
  fetchAgentMetrics(
    agentId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<ConnectorMetricResult[]>;
  testConnection(): Promise<{ ok: boolean; error?: string }>;
}

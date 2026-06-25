import type { DataSourceConnector, ConnectorMetricResult } from '@scorecard/shared';

export const forethoughtConnector: DataSourceConnector = {
  name: 'forethought',
  isAvailable: false,

  async fetchAgentMetrics(
    _agentId: string,
    _periodStart: Date,
    _periodEnd: Date,
  ): Promise<ConnectorMetricResult[]> {
    console.warn('[forethought] Connector is stubbed — API not available. Returning empty results.');
    return [];
  },

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: 'Forethought API is not yet available' };
  },
};

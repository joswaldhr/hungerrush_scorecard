import type { DataSourceConnector } from '@scorecard/shared';

// Stub per CLAUDE.md: isAvailable false · returns nothing · never throws · warns only.
export const forethoughtConnector: DataSourceConnector<null, null> = {
  name: 'forethought',
  isAvailable: false,

  async prepareRun(_periodStart: Date, _periodEnd: Date): Promise<null> {
    return null;
  },

  async fetchWeekData(
    _agentRef: string,
    _periodStart: Date,
    _periodEnd: Date,
    _run: null,
  ): Promise<null> {
    console.warn('[forethought] Connector is stubbed — API not available. Returning no data.');
    return null;
  },

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: 'Forethought API is not yet available' };
  },
};

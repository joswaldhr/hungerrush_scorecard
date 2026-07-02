// Connector interface — SACRED. Never change without updating all three connectors.
// Evolved in Phase 1B (compute-shape → fetch-shape, all three connectors in the same
// commit): connectors no longer compute metrics; they fetch one source's raw week data
// and the metric modules in apps/api/src/metrics/ compute from it. ConnectorMetricResult
// retired with that change (F13 — its unit/rawSource fields were built and then discarded).
// Uses Date (not string) because connectors deal with live API calls, not DB rows.

export interface DataSourceConnector<TRunContext, TWeekData> {
  name: string;
  isAvailable: boolean;
  /**
   * Fetch run-scoped data once per sync run — anything identical for every agent
   * (Zendesk SLA policy target, Assembled org-wide activities/people/activity types).
   * Called once by the sync before the employee loop; the result is passed back into
   * every fetchWeekData call (fixes L3: 247 identical SLA fetches per run).
   */
  prepareRun(periodStart: Date, periodEnd: Date): Promise<TRunContext>;
  /**
   * Fetch one agent's raw week data for the metric modules to compute from.
   * Returns null when this source doesn't know the agent (no write, not an error).
   */
  fetchWeekData(
    agentRef: string,
    periodStart: Date,
    periodEnd: Date,
    run: TRunContext
  ): Promise<TWeekData | null>;
  testConnection(): Promise<{ ok: boolean; error?: string }>;
}

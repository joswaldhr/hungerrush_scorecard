import axios from 'axios';
import { currentWeekStartUtc, weekStartStr, type Employee } from '@scorecard/shared';
import type { AssembledPerson } from '../types/assembled';
import type { ZendeskUser, ZendeskUsersResponse } from '../types/zendesk';
import { assembledConnector, type AssembledRunContext } from '../connectors/assembled';
import { zendeskConnector, createZendeskClient, type ZendeskRunContext } from '../connectors/zendesk';
import { ALL_METRICS, ASSEMBLED_METRICS, ZENDESK_METRICS } from '../metrics/registry';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';

// --- Helpers ---

// Week identity comes from the shared util (Phase 1C commit 6, L2) — the same UTC
// Monday this sync has always written, now also used by every frontend read site.
function getSyncBounds(mode: 'live' | 'snapshot'): { start: Date; end: Date } {
  const start = currentWeekStartUtc();
  if (mode === 'live') {
    return { start, end: new Date() };
  }
  const end = new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate() + 6,
    23, 59, 59, 999,
  ));
  return { start, end };
}

/** The projection every sync-side employees read uses (columns of shared Employee). */
type EmployeeAgentRow = Pick<Employee, 'id' | 'email' | 'zendesk_agent_id' | 'assembled_agent_id'>;

// Paginated employees fetch (external review; the L7 truncation class):
// PostgREST caps one response at 1,000 rows — comfortably above today's ~350
// employees, but the sync must not silently truncate as the org grows.
// Ordered by id for stable pages, like every paginated fetch in this repo.
async function fetchEmployeesPaginated<T extends Partial<EmployeeAgentRow>>(
  selectFields: string,
  orFilter?: string,
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const supabase = getSupabaseAdmin();
  const all: T[] = [];
  const PAGE_SIZE = 1000;
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from('employees').select(selectFields);
    if (orFilter) query = query.or(orFilter);
    const { data, error } = await query.order('id').range(from, from + PAGE_SIZE - 1);

    if (error) return { data: null, error };
    const page = (data ?? []) as unknown as T[];
    all.push(...page);
    if (page.length < PAGE_SIZE) return { data: all, error: null };
  }
}

// --- Zendesk user fetch ---

async function fetchAllZendeskAgents(): Promise<ZendeskUser[]> {
  const client = createZendeskClient();
  const agents: ZendeskUser[] = [];
  let url: string | null = '/users.json?role=agent&page[size]=100';

  while (url) {
    const resp: { data: ZendeskUsersResponse } = await client.get(url);
    agents.push(...resp.data.users);
    // Cursor pagination (page[size]) uses meta/links; offset uses next_page
    if (resp.data.meta?.has_more && resp.data.links?.next) {
      url = resp.data.links.next;
    } else {
      url = resp.data.next_page;
    }
  }

  return agents;
}

// --- Bootstrap ---

export interface BootstrapResult {
  assembledMatched: number;
  zendeskDirectMatched: number;
  deactivated: number;
  noZendeskAccount: number;
  unmatched: number;
  updated: number;
  errors: string[];
}

export async function bootstrapAgentIds(): Promise<BootstrapResult> {
  const startedAt = Date.now();
  const result: BootstrapResult = {
    assembledMatched: 0,
    zendeskDirectMatched: 0,
    deactivated: 0,
    noZendeskAccount: 0,
    unmatched: 0,
    updated: 0,
    errors: [],
  };

  const supabase = getSupabaseAdmin();
  const { data: employees, error: empError } = await fetchEmployeesPaginated<EmployeeAgentRow>(
    'id, email, zendesk_agent_id, assembled_agent_id',
  );

  if (empError) throw new Error(`Failed to fetch employees: ${empError.message}`);
  if (!employees || employees.length === 0) {
    console.warn('[bootstrap] No employees in database');
    return result;
  }

  console.log(`[bootstrap] Starting — ${employees.length} employees to process`);

  // --- Pass 1: Assembled matching (unchanged logic) ---

  const apiKey = process.env['ASSEMBLED_API_KEY'];
  if (!apiKey) throw new Error('ASSEMBLED_API_KEY is not set');

  const { data: rawData } = await axios.get<{ people: Record<string, AssembledPerson> }>(
    'https://api.assembledhq.com/v0/people?limit=500',
    { auth: { username: apiKey, password: '' } },
  );
  const people = Object.values(rawData.people);

  const peopleByEmail = new Map(
    people.map(p => [p.email.toLowerCase(), p]),
  );

  for (const emp of employees) {
    const agent = peopleByEmail.get(String(emp.email).toLowerCase());
    if (!agent) continue;
    result.assembledMatched++;

    const updates: Record<string, string> = {
      assembled_agent_id: agent.id,
      updated_at: new Date().toISOString(),
    };
    if (agent.platforms?.zendesk) {
      updates['zendesk_agent_id'] = agent.platforms.zendesk;
    }

    const { error } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', emp.id);

    if (error) {
      result.errors.push(`[assembled] Update failed for ${String(emp.email)}: ${error.message}`);
    } else {
      result.updated++;
    }
  }

  console.log(`[bootstrap] Assembled: ${result.assembledMatched} matched`);

  // --- Pass 2: Direct Zendesk email matching ---

  const allZdAgents = await fetchAllZendeskAgents();

  const activeZdByEmail = new Map<string, number>();
  const deactivatedZdIds = new Set<string>();

  for (const agent of allZdAgents) {
    if (agent.active) {
      activeZdByEmail.set(agent.email.toLowerCase(), agent.id);
    } else {
      deactivatedZdIds.add(String(agent.id));
    }
  }

  // Re-fetch employees to pick up assembled pass updates
  const { data: refreshed, error: refreshErr } = await fetchEmployeesPaginated<
    Pick<EmployeeAgentRow, 'id' | 'email' | 'zendesk_agent_id'>
  >('id, email, zendesk_agent_id');

  if (refreshErr) throw new Error(`Failed to refresh employees: ${refreshErr.message}`);
  const currentEmployees = refreshed ?? [];

  for (const emp of currentEmployees) {
    if (emp.zendesk_agent_id) continue;

    const zdId = activeZdByEmail.get(String(emp.email).toLowerCase());
    if (zdId === undefined) continue;

    result.zendeskDirectMatched++;

    const { error } = await supabase
      .from('employees')
      .update({
        zendesk_agent_id: String(zdId),
        updated_at: new Date().toISOString(),
      })
      .eq('id', emp.id);

    if (error) {
      result.errors.push(`[zendesk] Update failed for ${String(emp.email)}: ${error.message}`);
    } else {
      result.updated++;
    }
  }

  console.log(`[bootstrap] Zendesk direct: ${result.zendeskDirectMatched} new matches`);

  // --- Pass 3: Deactivation cleanup ---

  for (const emp of currentEmployees) {
    if (!emp.zendesk_agent_id) continue;
    if (!deactivatedZdIds.has(String(emp.zendesk_agent_id))) continue;

    result.deactivated++;

    const { error } = await supabase
      .from('employees')
      .update({
        zendesk_agent_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', emp.id);

    if (error) {
      result.errors.push(`[deactivation] Clear failed for ${String(emp.email)}: ${error.message}`);
    } else {
      result.updated++;
    }
  }

  console.log(`[bootstrap] Deactivated: ${result.deactivated} cleared`);

  // --- Summary ---

  const allZdEmails = new Set(allZdAgents.map(a => a.email.toLowerCase()));
  result.noZendeskAccount = employees.filter(
    e => !allZdEmails.has(String(e.email).toLowerCase()),
  ).length;
  result.unmatched = result.noZendeskAccount;

  console.log(`[bootstrap] No Zendesk account: ${result.noZendeskAccount} employees (likely non-support roles)`);

  const totalWithZd = employees.length - result.noZendeskAccount - result.deactivated;
  const durationMs = Date.now() - startedAt;
  console.log(
    `[bootstrap] Done in ${(durationMs / 1000).toFixed(1)}s — ` +
    `${totalWithZd} total matched, ${result.noZendeskAccount} no account, ` +
    `${result.deactivated} deactivated, ${result.errors.length} errors`,
  );

  return result;
}

// --- Sync ---

export interface SyncResult {
  mode: 'live' | 'snapshot';
  employeeCount: number;
  metricsCollected: number;
  metricsWritten: number;
  errors: string[];
  durationSeconds: number;
}

// Overlap guard (audit PR 2a, REVIEW.md 3.3): one sync at a time per process.
// A manual /api/sync/run landing during a cron run would double the external
// API load and interleave two synced_at stamps into what reads as one run —
// breaking the documented DB-side verification heuristic (one stamp per run).
let syncRunning = false;

export function isSyncRunning(): boolean {
  return syncRunning;
}

// One queryable summary row per run (audit PR 2a, REVIEW.md 3.3) — failures
// used to die in Railway logs only. Recording must never mask the run's own
// outcome, so insert problems are logged and swallowed.
async function recordSyncRun(
  mode: 'live' | 'snapshot',
  result: SyncResult | null,
  failure: string | null,
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('audit_log').insert({
      actor_id: null,
      action: failure === null ? 'sync_run' : 'sync_run_failed',
      resource_type: 'sync',
      resource_id: mode,
      metadata:
        failure === null && result
          ? {
              mode: result.mode,
              employee_count: result.employeeCount,
              metrics_collected: result.metricsCollected,
              metrics_written: result.metricsWritten,
              error_count: result.errors.length,
              errors: result.errors.slice(0, 20),
              duration_seconds: result.durationSeconds,
            }
          : { mode, error: failure },
    });
    if (error) console.error('[sync] sync_run audit insert failed:', error.message);
  } catch (err: unknown) {
    console.error(
      '[sync] sync_run audit insert failed:',
      err instanceof Error ? err.message : err,
    );
  }
}

export async function runSync(mode: 'live' | 'snapshot'): Promise<SyncResult> {
  if (syncRunning) {
    // A skip is not a run: no sync_run row. The cron wrappers catch and log
    // this; the manual route pre-checks isSyncRunning() and responds 409.
    throw new Error('sync already running — skipped');
  }
  syncRunning = true;
  try {
    const result = await runSyncInner(mode);
    await recordSyncRun(mode, result, null);
    return result;
  } catch (err: unknown) {
    await recordSyncRun(mode, null, err instanceof Error ? err.message : 'Unknown error');
    throw err;
  } finally {
    syncRunning = false;
  }
}

// --- Dynamic Connector Registry ---
import type { DataSourceConnector, MetricSpec } from '@scorecard/shared';

interface SyncConnectorDef<TRun = any, TData = any> {
  source: string;
  connector: DataSourceConnector<TRun, TData>;
  metricsModules: ReadonlyArray<{ spec: MetricSpec; compute: (d: TData) => number | null }>;
  getAgentRef: (emp: EmployeeAgentRow) => string | null;
}

const CONNECTOR_REGISTRY: SyncConnectorDef[] = [
  {
    source: 'assembled',
    connector: assembledConnector,
    metricsModules: ASSEMBLED_METRICS,
    getAgentRef: (emp) => (emp.assembled_agent_id ? String(emp.email) : null),
  },
  {
    source: 'zendesk',
    connector: zendeskConnector,
    metricsModules: ZENDESK_METRICS,
    getAgentRef: (emp) => (emp.zendesk_agent_id ? String(emp.zendesk_agent_id) : null),
  }
];

async function runSyncInner(mode: 'live' | 'snapshot'): Promise<SyncResult> {
  const startedAt = Date.now();
  const { start: periodStart, end: periodEnd } = getSyncBounds(mode);
  const errors: string[] = [];

  console.log(
    `[sync] Starting ${mode} sync for ` +
    `${periodStart.toISOString().substring(0, 10)} – ${periodEnd.toISOString().substring(0, 10)}`,
  );

  const supabase = getSupabaseAdmin();

  // Registry ∩ is_active drives the sync (Phase 1B): a metric is synced only when it
  // has both a registry module and an active metric_definitions row. Toggling
  // is_active in the admin UI starts/stops sync and display with no deploy.
  const { data: defs, error: defError } = await supabase
    .from('metric_definitions')
    .select('key')
    .eq('is_active', true);

  if (defError) throw new Error(`Failed to fetch metric definitions: ${defError.message}`);
  const activeKeys = new Set((defs ?? []).map(d => String(d.key)));

  const registryKeys = new Set(ALL_METRICS.map(m => m.spec.key));
  for (const key of activeKeys) {
    if (!registryKeys.has(key)) {
      console.warn(
        `[sync] Active metric '${key}' has no registry module — skipped ` +
        `(add apps/api/src/metrics/${key}.ts and register it; see docs/metrics.md)`,
      );
    }
  }

  const { data: employees, error: empError } = await fetchEmployeesPaginated<EmployeeAgentRow>(
    'id, email, zendesk_agent_id, assembled_agent_id',
    'zendesk_agent_id.not.is.null,assembled_agent_id.not.is.null',
  );

  if (empError) throw new Error(`Failed to fetch employees: ${empError.message}`);
  if (!employees || employees.length === 0) {
    console.log('[sync] No employees with agent IDs — nothing to sync');
    const d = parseFloat(((Date.now() - startedAt) / 1000).toFixed(1));
    return { mode, employeeCount: 0, metricsCollected: 0, metricsWritten: 0, errors, durationSeconds: d };
  }

  console.log(`[sync] Found ${employees.length} employees with agent IDs`);

  // Prepare active connectors
  const activeConnectors = CONNECTOR_REGISTRY.map(def => {
    const activeMetrics = def.metricsModules.filter(m => activeKeys.has(m.spec.key));
    return {
      ...def,
      activeMetrics,
      runContext: null as any
    };
  }).filter(c => c.activeMetrics.length > 0 && c.connector.isAvailable);

  console.log(
    `[sync] Active metrics: ` +
    CONNECTOR_REGISTRY.map(c => 
      `${c.source} ${c.metricsModules.filter(m => activeKeys.has(m.spec.key)).length}/${c.metricsModules.length}`
    ).join(', ')
  );

  for (const c of activeConnectors) {
    try {
      c.runContext = await c.connector.prepareRun(periodStart, periodEnd);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`[${c.source}] prepareRun failed — source skipped this run: ${msg}`);
      c.runContext = null; // Mark as failed
    }
  }

  let metricsCollected = 0;
  let metricsWritten = 0;
  const syncedAt = new Date().toISOString();
  const pStart = weekStartStr(periodStart);
  const pEnd = periodEnd.toISOString().substring(0, 10);

  for (const [i, emp] of employees.entries()) {
    const empRows: Array<Record<string, unknown>> = [];

    for (const c of activeConnectors) {
      if (!c.runContext) continue; // Skipped due to prepareRun failure

      const agentRef = c.getAgentRef(emp);
      if (!agentRef) continue;

      const beforeCount = empRows.length;
      try {
        const data = await c.connector.fetchWeekData(agentRef, periodStart, periodEnd, c.runContext);
        if (data) {
          for (const metric of c.activeMetrics) {
            const value = metric.compute(data);
            if (value === null) continue;
            empRows.push({
              employee_id: String(emp.id),
              metric_key: metric.spec.key,
              value,
              period_start: pStart,
              period_end: pEnd,
              synced_at: syncedAt,
            });
          }
        }
        console.log(`[sync] [${i + 1}/${employees.length}] ${c.connector.name}: ${String(emp.email)} → ${empRows.length - beforeCount} rows`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`[${c.source}] ${String(emp.email)}: ${msg}`);
      }
    }

    metricsCollected += empRows.length;

    if (empRows.length > 0) {
      const { error } = await supabase
        .from('metric_snapshots')
        .upsert(empRows, {
          onConflict: 'employee_id,metric_key,period_start',
          ignoreDuplicates: false,
        });
      if (error) {
        errors.push(`[db] Write failed for ${String(emp.email)}: ${error.message}`);
      } else {
        metricsWritten += empRows.length;
      }
    }
  }

  const durationSeconds = parseFloat(((Date.now() - startedAt) / 1000).toFixed(1));
  console.log(
    `[sync] ${mode} complete in ${durationSeconds}s: ` +
    `${metricsWritten} written, ${errors.length} errors`,
  );
  if (errors.length > 0) {
    console.error('[sync] Errors:', errors);
  }

  return { mode, employeeCount: employees.length, metricsCollected, metricsWritten, errors, durationSeconds };
}

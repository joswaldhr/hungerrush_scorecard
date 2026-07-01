import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import type { AssembledPerson } from '../types/assembled';
import { assembledConnector } from '../connectors/assembled';
import { zendeskConnector } from '../connectors/zendesk';

// --- Helpers ---

function getSupabaseAdmin() {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'];
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getCurrentWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + mondayOffset,
  ));
}

function getSyncBounds(mode: 'live' | 'snapshot'): { start: Date; end: Date } {
  const start = getCurrentWeekStart();
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

// --- Bootstrap ---

export interface BootstrapResult {
  matched: number;
  unmatched: number;
  updated: number;
  errors: string[];
}

export async function bootstrapAgentIds(): Promise<BootstrapResult> {
  const result: BootstrapResult = { matched: 0, unmatched: 0, updated: 0, errors: [] };

  const apiKey = process.env['ASSEMBLED_API_KEY'];
  if (!apiKey) throw new Error('ASSEMBLED_API_KEY is not set');

  console.log('[bootstrap] Fetching agents from Assembled...');
  const { data: rawData } = await axios.get<{ people: Record<string, AssembledPerson> }>(
    'https://api.assembledhq.com/v0/people?limit=500',
    { auth: { username: apiKey, password: '' } },
  );
  const people = Object.values(rawData.people);
  console.log(`[bootstrap] Found ${people.length} agents in Assembled`);

  const supabase = getSupabaseAdmin();
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id, email');

  if (empError) throw new Error(`Failed to fetch employees: ${empError.message}`);
  if (!employees || employees.length === 0) {
    console.warn('[bootstrap] No employees in database');
    return result;
  }

  const peopleByEmail = new Map(
    people.map(p => [p.email.toLowerCase(), p]),
  );

  for (const emp of employees) {
    const agent = peopleByEmail.get(String(emp.email).toLowerCase());
    if (!agent) {
      result.unmatched++;
      continue;
    }
    result.matched++;

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
      result.errors.push(`Update failed for ${String(emp.email)}: ${error.message}`);
    } else {
      result.updated++;
    }
  }

  console.log(
    `[bootstrap] Done: ${result.matched} matched, ${result.unmatched} unmatched, ${result.updated} updated`,
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

export async function runSync(mode: 'live' | 'snapshot'): Promise<SyncResult> {
  const startedAt = Date.now();
  const { start: periodStart, end: periodEnd } = getSyncBounds(mode);
  const errors: string[] = [];

  console.log(
    `[sync] Starting ${mode} sync for ` +
    `${periodStart.toISOString().substring(0, 10)} – ${periodEnd.toISOString().substring(0, 10)}`,
  );

  const supabase = getSupabaseAdmin();

  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id, email, zendesk_agent_id, assembled_agent_id')
    .or('zendesk_agent_id.not.is.null,assembled_agent_id.not.is.null');

  if (empError) throw new Error(`Failed to fetch employees: ${empError.message}`);
  if (!employees || employees.length === 0) {
    console.log('[sync] No employees with agent IDs — nothing to sync');
    const d = parseFloat(((Date.now() - startedAt) / 1000).toFixed(1));
    return { mode, employeeCount: 0, metricsCollected: 0, metricsWritten: 0, errors, durationSeconds: d };
  }

  console.log(`[sync] Found ${employees.length} employees with agent IDs`);

  let metricsCollected = 0;
  let metricsWritten = 0;
  const syncedAt = new Date().toISOString();
  const pStart = periodStart.toISOString().substring(0, 10);
  const pEnd = periodEnd.toISOString().substring(0, 10);

  for (const [i, emp] of employees.entries()) {
    const empRows: Array<Record<string, unknown>> = [];

    if (emp.assembled_agent_id && assembledConnector.isAvailable) {
      try {
        const metrics = await assembledConnector.fetchAgentMetrics(
          String(emp.email), periodStart, periodEnd,
        );
        for (const m of metrics) {
          if (m.value === null) continue;
          empRows.push({
            employee_id: String(emp.id),
            metric_key: m.metricKey,
            value: m.value,
            period_start: pStart,
            period_end: pEnd,
            synced_at: syncedAt,
          });
        }
        console.log(`[sync] [${i + 1}/${employees.length}] Assembled: ${String(emp.email)} → ${metrics.length} metrics`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`[assembled] ${String(emp.email)}: ${msg}`);
      }
    }

    if (emp.zendesk_agent_id && zendeskConnector.isAvailable) {
      try {
        const metrics = await zendeskConnector.fetchAgentMetrics(
          String(emp.zendesk_agent_id), periodStart, periodEnd,
        );
        for (const m of metrics) {
          if (m.value === null) continue;
          empRows.push({
            employee_id: String(emp.id),
            metric_key: m.metricKey,
            value: m.value,
            period_start: pStart,
            period_end: pEnd,
            synced_at: syncedAt,
          });
        }
        console.log(`[sync] [${i + 1}/${employees.length}] Zendesk: ${String(emp.email)} → ${metrics.length} metrics`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`[zendesk] ${String(emp.email)}: ${msg}`);
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

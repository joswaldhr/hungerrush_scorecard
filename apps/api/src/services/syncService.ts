import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { createClient } from '@supabase/supabase-js';
import type { AssembledPerson } from '../types/assembled';
import type { ZendeskUser, ZendeskUsersResponse } from '../types/zendesk';
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

// --- Zendesk user fetch ---

function createZendeskClient(): AxiosInstance {
  const subdomain = process.env['ZENDESK_SUBDOMAIN'];
  const email = process.env['ZENDESK_EMAIL'];
  const token = process.env['ZENDESK_API_TOKEN'];
  if (!subdomain || !email || !token) {
    throw new Error('ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, and ZENDESK_API_TOKEN must be set');
  }
  return axios.create({
    baseURL: `https://${subdomain}.zendesk.com/api/v2`,
    auth: { username: `${email}/token`, password: token },
  });
}

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
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id, email, zendesk_agent_id, assembled_agent_id');

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
  const { data: refreshed, error: refreshErr } = await supabase
    .from('employees')
    .select('id, email, zendesk_agent_id');

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

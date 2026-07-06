// Shared helpers for the parity/backup scripts (Phase 1A).
// HARD REQUIREMENT (docs/refactor-plan.md, 1A commit 2): every fetch here paginates
// explicitly past PostgREST's 1,000-row default and is verified against a server-side
// exact count — otherwise the parity baseline would be truncated by the very bug
// tracked as L7. Row counts are printed by every caller.
import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;

export function createServiceClient(): SupabaseClient {
  dotenv.config({ path: resolve(__dirname, '../apps/api/.env') });
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'];
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY (expected in apps/api/.env)');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface SnapshotFilter {
  periodStart?: string; // YYYY-MM-DD — omit for the full table
}

interface FetchResult {
  rows: Record<string, unknown>[];
  serverCount: number;
}

// Fetches metric_snapshots rows with explicit .range() pagination, ordered by id for
// stable pages, and verifies the fetched total against a server-side exact count.
// Retries the whole fetch once if the counts disagree (a cron write can land mid-run),
// then throws so no caller ever proceeds on silently incomplete data.
export async function fetchSnapshots(
  supabase: SupabaseClient,
  columns: string,
  filter: SnapshotFilter = {},
): Promise<FetchResult> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const serverCount = await countSnapshots(supabase, filter);
    const rows: Record<string, unknown>[] = [];

    for (let from = 0; ; from += PAGE_SIZE) {
      let query = supabase
        .from('metric_snapshots')
        .select(columns)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (filter.periodStart) query = query.eq('period_start', filter.periodStart);

      const { data, error } = await query;
      if (error) throw new Error(`Fetch failed at offset ${from}: ${error.message}`);
      const page = (data ?? []) as unknown as Record<string, unknown>[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    if (rows.length === serverCount) {
      return { rows, serverCount };
    }
    console.warn(
      `[fetch] count mismatch (fetched ${rows.length}, server says ${serverCount}) — ` +
      (attempt === 1 ? 'a write likely landed mid-fetch; retrying once' : 'still mismatched'),
    );
  }
  throw new Error('Fetched row count disagreed with server count twice — aborting rather than writing incomplete data');
}

async function countSnapshots(supabase: SupabaseClient, filter: SnapshotFilter): Promise<number> {
  let query = supabase
    .from('metric_snapshots')
    .select('id', { count: 'exact', head: true });
  if (filter.periodStart) query = query.eq('period_start', filter.periodStart);
  const { count, error } = await query;
  if (error) throw new Error(`Count failed: ${error.message}`);
  return count ?? 0;
}

// Current week's Monday as YYYY-MM-DD, computed in UTC — identical semantics to
// currentWeekStartUtc() in packages/shared/src/week.ts (the sync writes period_start
// from UTC Monday; the dump must read the same week).
export function currentWeekStartUtc(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + mondayOffset,
  ));
  return monday.toISOString().substring(0, 10);
}

export function utcTimestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
}

// Phase 1C commit 10b — APPROVED data correction (user, 2026-07-02; docs/refactor-plan.md
// §d). The L6 mapping gap wrote occupancy/schedule_adherence 0% rows as "measured"
// values for agents whose states never matched a productive name. Null = no row in this
// schema, so those rows are deleted — ALL zero-value rows for the two keys across ALL
// weeks, re-counted at execution.
//
// Safety rails, per the approval's conditions:
//   - dry run by default; deletes only with --execute
//   - --execute refuses to run unless a fresh backup CSV (< 15 min old) exists
//     (run `npx tsx scripts/backup-snapshots.ts` first)
//   - the correction is written to audit_log
//   - sequencing: run only AFTER commit 10 is deployed (verify GET /health sha) so a
//     re-enabled sync cannot re-write zeros
//
// This is a one-time approved correction — never generalize into casual snapshot
// deletion (constraint 7 protects real history; these values were measured-wrong).
// Usage: npx tsx scripts/correct-assembled-zeros.ts [--execute]
import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServiceClient } from './snapshotDb';

const KEYS = ['occupancy', 'schedule_adherence'];
const BACKUP_MAX_AGE_MS = 15 * 60 * 1000;

function newestBackupAgeMs(): { file: string; ageMs: number } | null {
  const dir = resolve(__dirname, 'backups');
  let newest: { file: string; ageMs: number } | null = null;
  try {
    for (const f of readdirSync(dir)) {
      if (!f.startsWith('metric-snapshots-') || !f.endsWith('.csv')) continue;
      const ageMs = Date.now() - statSync(resolve(dir, f)).mtimeMs;
      if (!newest || ageMs < newest.ageMs) newest = { file: f, ageMs };
    }
  } catch {
    return null;
  }
  return newest;
}

async function main() {
  const execute = process.argv.includes('--execute');
  const supabase = createServiceClient();

  console.log(`[10b] Mode: ${execute ? 'EXECUTE' : 'dry run (no writes)'}`);

  for (const key of KEYS) {
    const { count: total } = await supabase
      .from('metric_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('metric_key', key);
    const { count: zeros } = await supabase
      .from('metric_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('metric_key', key)
      .eq('value', 0);
    console.log(`[10b] ${key.padEnd(20)} total ${total ?? 0}, value=0 ${zeros ?? 0}`);
  }

  const { data: weeks } = await supabase
    .from('metric_snapshots')
    .select('period_start, metric_key')
    .in('metric_key', KEYS)
    .eq('value', 0);
  const byWeek = new Map<string, number>();
  for (const r of weeks ?? []) {
    byWeek.set(String(r.period_start), (byWeek.get(String(r.period_start)) ?? 0) + 1);
  }
  console.log('[10b] zero rows per week:');
  for (const [w, n] of [...byWeek.entries()].sort()) console.log(`[10b]   ${w}: ${n}`);

  if (!execute) {
    console.log('[10b] Dry run complete. Re-run with --execute after (1) commit 10 is');
    console.log('[10b] deployed (check /health sha) and (2) a fresh backup exists.');
    return;
  }

  const backup = newestBackupAgeMs();
  if (!backup || backup.ageMs > BACKUP_MAX_AGE_MS) {
    throw new Error(
      'No backup CSV newer than 15 minutes found in scripts/backups/ — ' +
      'run `npx tsx scripts/backup-snapshots.ts` immediately before --execute',
    );
  }
  console.log(`[10b] Fresh backup found: ${backup.file} (${Math.round(backup.ageMs / 1000)}s old)`);

  const { data: deleted, error: delError } = await supabase
    .from('metric_snapshots')
    .delete()
    .in('metric_key', KEYS)
    .eq('value', 0)
    .select('id, metric_key, period_start');
  if (delError) throw new Error(`Delete failed: ${delError.message}`);

  const deletedByKey = new Map<string, number>();
  for (const r of deleted ?? []) {
    deletedByKey.set(String(r.metric_key), (deletedByKey.get(String(r.metric_key)) ?? 0) + 1);
  }
  console.log(`[10b] Deleted ${deleted?.length ?? 0} rows:`);
  for (const [k, n] of [...deletedByKey.entries()].sort()) console.log(`[10b]   ${k}: ${n}`);

  const { error: auditError } = await supabase.from('audit_log').insert({
    actor_id: null,
    action: 'metric_snapshot_correction',
    resource_type: 'metric_snapshots',
    resource_id: 'occupancy+schedule_adherence value=0 sweep',
    metadata: {
      reason:
        'L6 fix (Phase 1C commits 10+10b): empty productive-state intersection wrote ' +
        'misleading "measured" 0% rows; null (no row) is the correct representation',
      approved: 'user 2026-07-02, docs/refactor-plan.md §d commit 10b',
      deleted_total: deleted?.length ?? 0,
      deleted_by_key: Object.fromEntries(deletedByKey),
      backup_file: backup.file,
      executed_via: 'scripts/correct-assembled-zeros.ts (service key)',
    },
  });
  if (auditError) throw new Error(`Audit log write failed: ${auditError.message}`);
  console.log('[10b] audit_log entry written (action: metric_snapshot_correction)');

  for (const key of KEYS) {
    const { count } = await supabase
      .from('metric_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('metric_key', key)
      .eq('value', 0);
    console.log(`[10b] post-check ${key}: ${count ?? 0} zero rows remain (expect 0)`);
  }
}

main().catch(err => {
  console.error('[10b] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});

// Phase 1C deploy-week correction (option (a) of the stale-row finding, refactor plan 1C
// execution notes): after the commit-7/7b semantics change deploys, current-week
// first_reply_time / resolution_rate / csat_score rows the NEW semantics no longer
// writes keep their old-semantics values forever (upsert never deletes). This one-time
// sweep removes them for the DEPLOY WEEK ONLY — completed historical weeks stay, per
// constraint 7 (they are real history computed under the semantics of their time).
//
// Detection: every sync run stamps its rows with ONE synced_at, and ticket_volume is
// written for every Zendesk agent on every run — so the max synced_at over the current
// week's ticket_volume rows IS the latest full sync. Rows in the three re-based keys
// with any OTHER stamp were left behind by the semantics change.
//
// Safety rails (same as correct-assembled-zeros.ts):
//   - dry run by default; deletes only with --execute
//   - --execute refuses without a fresh backup CSV (< 15 min old)
//   - refuses unless the latest full sync is NEW-CODE-sized and recent
//     (>= 200 ticket_volume rows on the latest stamp, stamp < 5 h old)
//   - the correction is written to audit_log
// Run AFTER the first post-deploy cron completes (verify /health sha first).
// Usage: npx tsx scripts/sweep-stale-semantics-rows.ts [--execute]
import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServiceClient, currentWeekStartUtc } from './snapshotDb';

const KEYS = ['first_reply_time', 'resolution_rate', 'csat_score'];
const BACKUP_MAX_AGE_MS = 15 * 60 * 1000;
const STAMP_MAX_AGE_MS = 5 * 60 * 60 * 1000;
const MIN_FULL_RUN_TV_ROWS = 200;

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
  const week = currentWeekStartUtc();

  console.log(`[sweep] Mode: ${execute ? 'EXECUTE' : 'dry run (no writes)'} — week ${week}`);

  // Latest full-sync stamp = max synced_at over this week's ticket_volume rows.
  const { data: tvLatest, error: tvError } = await supabase
    .from('metric_snapshots')
    .select('synced_at')
    .eq('period_start', week)
    .eq('metric_key', 'ticket_volume')
    .order('synced_at', { ascending: false })
    .limit(1);
  if (tvError) throw new Error(tvError.message);
  const stamp = tvLatest?.[0]?.synced_at ? String(tvLatest[0].synced_at) : null;
  if (!stamp) throw new Error('No ticket_volume rows this week — nothing to anchor the sweep to');

  const stampAge = Date.now() - Date.parse(stamp);
  const { count: tvAtStamp } = await supabase
    .from('metric_snapshots')
    .select('id', { count: 'exact', head: true })
    .eq('period_start', week)
    .eq('metric_key', 'ticket_volume')
    .eq('synced_at', stamp);
  console.log(
    `[sweep] Latest full-sync stamp: ${stamp} (${Math.round(stampAge / 60000)} min old, ` +
    `${tvAtStamp ?? 0} ticket_volume rows)`,
  );

  const stale = new Map<string, number>();
  for (const key of KEYS) {
    const { count } = await supabase
      .from('metric_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('period_start', week)
      .eq('metric_key', key)
      .neq('synced_at', stamp);
    stale.set(key, count ?? 0);
    console.log(`[sweep] ${key.padEnd(20)} stale (not on latest stamp): ${count ?? 0}`);
  }
  const staleTotal = [...stale.values()].reduce((a, b) => a + b, 0);

  if (!execute) {
    console.log(`[sweep] Dry run complete — ${staleTotal} rows would be deleted.`);
    console.log('[sweep] Re-run with --execute after the first post-deploy cron completes');
    console.log('[sweep] (verify /health sha) and a fresh backup exists.');
    return;
  }

  if (stampAge > STAMP_MAX_AGE_MS) {
    throw new Error('Latest sync stamp is over 5h old — run after a fresh full sync');
  }
  if ((tvAtStamp ?? 0) < MIN_FULL_RUN_TV_ROWS) {
    throw new Error(
      `Latest stamp has only ${tvAtStamp} ticket_volume rows — not a full run; refusing`,
    );
  }
  const backup = newestBackupAgeMs();
  if (!backup || backup.ageMs > BACKUP_MAX_AGE_MS) {
    throw new Error(
      'No backup CSV newer than 15 minutes found in scripts/backups/ — ' +
      'run `npx tsx scripts/backup-snapshots.ts` immediately before --execute',
    );
  }
  console.log(`[sweep] Fresh backup found: ${backup.file} (${Math.round(backup.ageMs / 1000)}s old)`);

  const { data: deleted, error: delError } = await supabase
    .from('metric_snapshots')
    .delete()
    .eq('period_start', week)
    .in('metric_key', KEYS)
    .neq('synced_at', stamp)
    .select('id, metric_key');
  if (delError) throw new Error(`Delete failed: ${delError.message}`);

  const deletedByKey = new Map<string, number>();
  for (const r of deleted ?? []) {
    deletedByKey.set(String(r.metric_key), (deletedByKey.get(String(r.metric_key)) ?? 0) + 1);
  }
  console.log(`[sweep] Deleted ${deleted?.length ?? 0} rows:`);
  for (const [k, n] of [...deletedByKey.entries()].sort()) console.log(`[sweep]   ${k}: ${n}`);

  const { error: auditError } = await supabase.from('audit_log').insert({
    actor_id: null,
    action: 'metric_snapshot_correction',
    resource_type: 'metric_snapshots',
    resource_id: `deploy-week ${week} stale-semantics sweep (frt/resolution/csat)`,
    metadata: {
      reason:
        'Phase 1C commits 7/7b re-based frt/resolution to created-in-period and csat to ' +
        'ratings-submitted-in-period; rows the new semantics no longer writes kept ' +
        'old-semantics values (upsert never deletes). One-time deploy-week sweep.',
      approved: 'user 2026-07-06 ("do what you think is best" on option (a), presented in review bundle)',
      week,
      anchor_stamp: stamp,
      deleted_total: deleted?.length ?? 0,
      deleted_by_key: Object.fromEntries(deletedByKey),
      backup_file: backup.file,
      executed_via: 'scripts/sweep-stale-semantics-rows.ts (service key)',
    },
  });
  if (auditError) throw new Error(`Audit log write failed: ${auditError.message}`);
  console.log('[sweep] audit_log entry written (action: metric_snapshot_correction)');
}

main().catch(err => {
  console.error('[sweep] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});

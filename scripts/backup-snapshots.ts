// Full metric_snapshots backup → timestamped CSV restore point (Phase 1A commit 2).
// Run before anything that overwrites live rows (the 1B parity run, the 1C corrections).
// Usage: npx tsx scripts/backup-snapshots.ts
// Output: scripts/backups/metric-snapshots-<UTC timestamp>.csv (gitignored)
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServiceClient, fetchSnapshots, utcTimestampForFilename } from './snapshotDb';

const COLUMNS = [
  'id',
  'employee_id',
  'metric_key',
  'value',
  'period_start',
  'period_end',
  'synced_at',
  'created_at',
] as const;

function csvField(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

async function main() {
  const supabase = createServiceClient();
  console.log('[backup] Fetching full metric_snapshots table (paginated)...');
  const { rows, serverCount } = await fetchSnapshots(supabase, COLUMNS.join(', '));

  const dir = resolve(__dirname, 'backups');
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `metric-snapshots-${utcTimestampForFilename()}.csv`);

  const lines = [COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(COLUMNS.map(c => csvField(row[c])).join(','));
  }
  writeFileSync(file, lines.join('\n') + '\n', 'utf8');

  const byMetric = new Map<string, number>();
  for (const row of rows) {
    const key = String(row['metric_key']);
    byMetric.set(key, (byMetric.get(key) ?? 0) + 1);
  }

  console.log(`[backup] Rows fetched:   ${rows.length}`);
  console.log(`[backup] Server count:   ${serverCount} (verified equal)`);
  console.log('[backup] Rows per metric:');
  for (const [key, n] of [...byMetric.entries()].sort()) {
    console.log(`[backup]   ${key.padEnd(20)} ${n}`);
  }
  console.log(`[backup] Written to:     ${file}`);
}

main().catch(err => {
  console.error('[backup] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});

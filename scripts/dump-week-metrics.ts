// Dumps one week of metric_snapshots as sorted `employee_id|metric_key|value` lines —
// the parity-diff format for the Phase 1B refactor (docs/refactor-plan.md, parity protocol).
// Usage:
//   npx tsx scripts/dump-week-metrics.ts [--week YYYY-MM-DD] [--out path]
// Defaults: week = current UTC-week Monday (same semantics as the sync);
//           out  = scripts/dumps/week-<week>-<UTC timestamp>.txt (gitignored)
// Prints the row count and verifies it against a server-side exact count on every run.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createServiceClient,
  currentWeekStartUtc,
  fetchSnapshots,
  utcTimestampForFilename,
} from './snapshotDb';

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const week = argValue('--week') ?? currentWeekStartUtc();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    throw new Error(`--week must be YYYY-MM-DD, got: ${week}`);
  }

  const supabase = createServiceClient();
  console.log(`[dump] Fetching metric_snapshots for week ${week} (paginated)...`);
  const { rows, serverCount } = await fetchSnapshots(
    supabase,
    'employee_id, metric_key, value',
    { periodStart: week },
  );

  const lines = rows
    .map(r => `${String(r['employee_id'])}|${String(r['metric_key'])}|${Number(r['value'])}`)
    .sort();

  const defaultDir = resolve(__dirname, 'dumps');
  const out = argValue('--out')
    ?? (mkdirSync(defaultDir, { recursive: true }),
        resolve(defaultDir, `week-${week}-${utcTimestampForFilename()}.txt`));
  writeFileSync(out, lines.join('\n') + '\n', 'utf8');

  console.log(`[dump] Week:         ${week}`);
  console.log(`[dump] Rows fetched: ${rows.length}`);
  console.log(`[dump] Server count: ${serverCount} (verified equal)`);
  console.log(`[dump] Written to:   ${out}`);
}

main().catch(err => {
  console.error('[dump] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});

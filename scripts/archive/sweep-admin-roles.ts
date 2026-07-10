// Audit PR 1 (REVIEW.md Track 0.2) — one-time APPROVED role-classification sweep.
// The org sync minted role='admin' for every manager-less AD account (280 profiles
// at review time; only James's is active). Admin becomes audited-write-only from
// this PR on; this sweep reclassifies the minted ones to 'employee'.
//
// The keep-set is determined FROM DATA, never hardcoded: profiles with
// role='admin' AND is_active=true are kept. The script ABORTS unless that set
// is exactly one profile (the expected state — a single active admin).
//
// Safety rails (the 10b correction protocol):
//   - dry run by default; writes only with --execute
//   - --execute first writes a full profiles backup CSV to scripts/backups/
//     (row count verified against a server-side exact count before proceeding)
//   - the sweep is recorded in audit_log (action 'role_classification_sweep')
//   - run only AFTER migration 0019 is applied: each role update fires the
//     claims trigger, and 0019 makes it STRIP the claim for inactive profiles
//     (without 0019 they would still be stamped role='employee' — de-privileged
//     either way, but 0019 is the intended end state)
//
// Usage: npx tsx scripts/sweep-admin-roles.ts [--execute]
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServiceClient, utcTimestampForFilename } from './snapshotDb';

const CHUNK = 100;

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  [key: string]: unknown;
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const execute = process.argv.includes('--execute');
  const supabase = createServiceClient();

  console.log(`[sweep] Mode: ${execute ? 'EXECUTE' : 'dry run (no writes)'}`);

  // Full profiles fetch, count-verified (house rule: never proceed on silently
  // incomplete data). 367 rows at review time — one page, but verify anyway.
  const { count: serverCount, error: countErr } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true });
  if (countErr) throw new Error(`profiles count failed: ${countErr.message}`);

  const all: ProfileRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(`profiles fetch failed @${from}: ${error.message}`);
    all.push(...((data ?? []) as ProfileRow[]));
    if ((data ?? []).length < 1000) break;
  }
  if (all.length !== (serverCount ?? 0)) {
    throw new Error(`fetched ${all.length} profiles != server count ${serverCount} — aborting`);
  }
  console.log(`[sweep] fetched ${all.length} profiles (server-verified)`);

  const admins = all.filter(p => p.role === 'admin');
  const keep = admins.filter(p => p.is_active);
  const sweep = admins.filter(p => !p.is_active);

  console.log(`[sweep] role=admin: ${admins.length} total`);
  console.log(`[sweep] KEEP (active admins, determined from data): ${keep.length}`);
  for (const k of keep) console.log(`[sweep]   KEEP  ${k.full_name} <${k.email}>  (${k.id})`);
  console.log(`[sweep] SWEEP admin → employee (inactive): ${sweep.length}`);
  for (const s of sweep.slice(0, 10)) console.log(`[sweep]   sweep ${s.full_name} <${s.email}>`);
  if (sweep.length > 10) console.log(`[sweep]   … and ${sweep.length - 10} more`);

  if (keep.length !== 1) {
    throw new Error(
      `Expected exactly ONE active admin to keep, found ${keep.length} — ` +
      'unexpected state; investigate before sweeping.',
    );
  }

  if (!execute) {
    console.log('[sweep] Dry run complete. Re-run with --execute AFTER (1) migration');
    console.log('[sweep] 0019 is applied and (2) James has approved these exact counts.');
    return;
  }

  // Backup FIRST — full profiles table to a timestamped CSV.
  const backupDir = resolve(__dirname, 'backups');
  mkdirSync(backupDir, { recursive: true });
  const columns = Object.keys(all[0]!);
  const backupFile = `profiles-backup-${utcTimestampForFilename()}.csv`;
  const csv = [
    columns.join(','),
    ...all.map(row => columns.map(c => csvEscape(row[c])).join(',')),
  ].join('\n');
  writeFileSync(resolve(backupDir, backupFile), csv, 'utf8');
  console.log(`[sweep] backup written: scripts/backups/${backupFile} (${all.length} rows)`);

  // Sweep in chunks. Each update fires the claims trigger per row (0019: the
  // inactive profiles get their role claim STRIPPED as a side effect).
  let updated = 0;
  for (let i = 0; i < sweep.length; i += CHUNK) {
    const chunk = sweep.slice(i, i + CHUNK).map(p => p.id);
    const { data, error } = await supabase
      .from('profiles')
      .update({ role: 'employee', updated_at: new Date().toISOString() })
      .in('id', chunk)
      .select('id');
    if (error) throw new Error(`sweep chunk @${i} failed: ${error.message} (updated so far: ${updated})`);
    updated += (data ?? []).length;
    console.log(`[sweep] updated ${updated}/${sweep.length}`);
  }

  // Verify end state: exactly the keep-set remains admin.
  const { count: adminsAfter } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin');
  console.log(`[sweep] role=admin after sweep: ${adminsAfter} (expected 1)`);

  const { error: auditErr } = await supabase.from('audit_log').insert({
    actor_id: null,
    action: 'role_classification_sweep',
    resource_type: 'profiles',
    resource_id: 'bulk',
    metadata: {
      swept: updated,
      kept: keep.map(k => ({ id: k.id, email: k.email })),
      backup: `scripts/backups/${backupFile}`,
      reason: 'REVIEW.md 0.2 / audit PR 1: classification-minted admin roles reclassified to employee; admin is audited-write-only',
    },
  });
  if (auditErr) {
    throw new Error(`SWEEP SUCCEEDED but audit_log insert failed: ${auditErr.message} — insert manually.`);
  }

  console.log(`[sweep] Done: ${updated} profiles swept, audited, backup at scripts/backups/${backupFile}`);
  console.log('[sweep] Next: run scripts/rls-probe-admin-sweep.sql in the SQL editor.');
}

main().catch(err => {
  console.error('[sweep] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});

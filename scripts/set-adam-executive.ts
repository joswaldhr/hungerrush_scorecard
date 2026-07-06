// W2 release readiness (docs/release-plan.md) — assign Adam Seow the 'executive'
// role via an audited service-key write. The 0010 guard trigger reverts role
// changes from any context except service_role, so this script is the ONLY
// supported path (the SQL editor would silently no-op the change).
//
// Sequencing — run --execute only after BOTH:
//   1. migration 0017 is applied (the enum value must exist), and
//   2. the W2 PR is deployed (verify GET /health sha) — the pre-W2 graph sync
//      reclassifies Adam to senior_manager at the next 05:00 UTC bootstrap;
//      the W2 code preserves manually-assigned executives.
// Adam's JWT carries the new role only after his next sign-in or token refresh.
//
// Usage: npx tsx scripts/set-adam-executive.ts [--execute]
import { createServiceClient } from './snapshotDb';

const TARGET_EMAIL = 'adam.seow@hungerrush.com';

async function main() {
  const execute = process.argv.includes('--execute');
  const supabase = createServiceClient();

  console.log(`[executive] Mode: ${execute ? 'EXECUTE' : 'dry run (no writes)'}`);

  const { data: profile, error: findError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active')
    .eq('email', TARGET_EMAIL)
    .maybeSingle();
  if (findError) throw new Error(`Profile lookup failed: ${findError.message}`);

  if (!profile) {
    console.error(`[executive] No profile found for ${TARGET_EMAIL}. Candidates:`);
    const { data: candidates } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .ilike('email', '%seow%');
    for (const c of candidates ?? []) {
      console.error(`[executive]   ${c.email} (${c.full_name}, ${c.role})`);
    }
    process.exit(1);
  }

  console.log(
    `[executive] Found: ${profile.full_name} <${profile.email}> — role=${profile.role}, ` +
    `is_active=${profile.is_active}, id=${profile.id}`,
  );

  // Context: what executive visibility will cover after the change.
  const { count: managerCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .in('role', ['manager', 'senior_manager', 'admin'])
    .eq('is_active', true);
  const { count: employeeCount } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true });
  console.log(
    `[executive] Org-wide scope once executive: ${managerCount ?? 0} active manager-role ` +
    `profiles, ${employeeCount ?? 0} employees`,
  );

  if (profile.role === 'executive') {
    console.log('[executive] Role is already executive — nothing to do.');
    return;
  }

  if (!execute) {
    console.log('[executive] Dry run complete. Re-run with --execute after (1) migration');
    console.log('[executive] 0017 is applied and (2) the W2 PR is deployed (check /health sha).');
    return;
  }

  const previousRole = String(profile.role);
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'executive', updated_at: new Date().toISOString() })
    .eq('id', profile.id);
  if (updateError) throw new Error(`Role update failed: ${updateError.message}`);

  // Verify the write held (the 0010 guard trigger silently reverts non-service
  // writes — a service-key write should pass, but check rather than assume).
  const { data: after } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', profile.id)
    .single();
  if (after?.role !== 'executive') {
    throw new Error(`Write did not hold — role is ${String(after?.role)} (guard trigger?)`);
  }
  console.log('[executive] profiles.role = executive — confirmed by re-read');

  // Verify the 0010 sync trigger propagated the role into auth app_metadata
  // (the JWT claim source; his live token refreshes on next sign-in).
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(profile.id);
  if (authError) {
    console.warn(`[executive] Could not read auth user (${authError.message}) — verify app_metadata manually`);
  } else {
    const jwtRole = (authUser.user.app_metadata as Record<string, unknown>)['role'];
    console.log(
      `[executive] auth app_metadata.role = ${String(jwtRole)} ` +
      `(expect executive; JWT updates at his next sign-in or token refresh)`,
    );
  }

  const { error: auditError } = await supabase.from('audit_log').insert({
    actor_id: null,
    action: 'role_change_service_write',
    resource_type: 'profiles',
    resource_id: profile.id,
    metadata: {
      email: profile.email,
      from_role: previousRole,
      to_role: 'executive',
      reason:
        'W2 release readiness (docs/release-plan.md): executive tier for Adam Seow — ' +
        'org-wide data visibility, no admin capabilities; James stays the only admin',
      executed_via: 'scripts/set-adam-executive.ts (service key)',
    },
  });
  if (auditError) throw new Error(`Audit log write failed: ${auditError.message}`);
  console.log('[executive] audit_log entry written (action: role_change_service_write)');
}

main().catch(err => {
  console.error('[executive] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});

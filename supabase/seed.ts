import dotenv from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

dotenv.config({ path: resolve(__dirname, '../apps/api/.env') });

const SUPABASE_URL = process.env['SUPABASE_URL'];
const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_KEY'];
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in apps/api/.env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface SeedProfile {
  email: string;
  fullName: string;
  role: 'admin' | 'senior_manager' | 'manager';
  managerEmail: string | null;
}

interface SeedEmployee {
  email: string;
  fullName: string;
  managerEmail: string;
}

const PROFILES: SeedProfile[] = [
  { email: 'james.oswald@hungerrush.com', fullName: 'James Oswald', role: 'admin', managerEmail: null },
  { email: 'sarah.johnson@hungerrush.com', fullName: 'Sarah Johnson', role: 'senior_manager', managerEmail: 'james.oswald@hungerrush.com' },
  { email: 'mike.chen@hungerrush.com', fullName: 'Mike Chen', role: 'senior_manager', managerEmail: 'james.oswald@hungerrush.com' },
  { email: 'lisa.park@hungerrush.com', fullName: 'Lisa Park', role: 'manager', managerEmail: 'sarah.johnson@hungerrush.com' },
  { email: 'tom.rivera@hungerrush.com', fullName: 'Tom Rivera', role: 'manager', managerEmail: 'sarah.johnson@hungerrush.com' },
  { email: 'amy.foster@hungerrush.com', fullName: 'Amy Foster', role: 'manager', managerEmail: 'mike.chen@hungerrush.com' },
  { email: 'dan.walsh@hungerrush.com', fullName: 'Dan Walsh', role: 'manager', managerEmail: 'mike.chen@hungerrush.com' },
];

const EMPLOYEES: SeedEmployee[] = [
  { email: 'alex.martinez@hungerrush.com', fullName: 'Alex Martinez', managerEmail: 'lisa.park@hungerrush.com' },
  { email: 'nina.patel@hungerrush.com', fullName: 'Nina Patel', managerEmail: 'lisa.park@hungerrush.com' },
  { email: 'jordan.lee@hungerrush.com', fullName: 'Jordan Lee', managerEmail: 'lisa.park@hungerrush.com' },
  { email: 'casey.brown@hungerrush.com', fullName: 'Casey Brown', managerEmail: 'tom.rivera@hungerrush.com' },
  { email: 'riley.nguyen@hungerrush.com', fullName: 'Riley Nguyen', managerEmail: 'tom.rivera@hungerrush.com' },
  { email: 'morgan.davis@hungerrush.com', fullName: 'Morgan Davis', managerEmail: 'tom.rivera@hungerrush.com' },
  { email: 'taylor.kim@hungerrush.com', fullName: 'Taylor Kim', managerEmail: 'amy.foster@hungerrush.com' },
  { email: 'drew.garcia@hungerrush.com', fullName: 'Drew Garcia', managerEmail: 'amy.foster@hungerrush.com' },
  { email: 'sam.wright@hungerrush.com', fullName: 'Sam Wright', managerEmail: 'amy.foster@hungerrush.com' },
  { email: 'quinn.harris@hungerrush.com', fullName: 'Quinn Harris', managerEmail: 'dan.walsh@hungerrush.com' },
  { email: 'avery.clark@hungerrush.com', fullName: 'Avery Clark', managerEmail: 'dan.walsh@hungerrush.com' },
  { email: 'reese.turner@hungerrush.com', fullName: 'Reese Turner', managerEmail: 'dan.walsh@hungerrush.com' },
];

async function seed() {
  console.log('Looking up james.oswald auth user...');
  const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const jamesAuth = authData?.users.find(
    (u) => u.email?.toLowerCase() === 'james.oswald@hungerrush.com',
  );
  if (!jamesAuth) {
    throw new Error('james.oswald@hungerrush.com not found in auth.users — log in via SSO first');
  }
  console.log(`  Found: ${jamesAuth.id}`);

  const emailToProfileId = new Map<string, string>();
  emailToProfileId.set('james.oswald@hungerrush.com', jamesAuth.id);

  // Create fake auth users for the other 6 profiles
  console.log('\nCreating auth users for fake profiles...');
  for (const p of PROFILES) {
    if (p.email === 'james.oswald@hungerrush.com') continue;

    const existing = authData?.users.find(
      (u) => u.email?.toLowerCase() === p.email.toLowerCase(),
    );
    if (existing) {
      console.log(`  ${p.email} — already exists (${existing.id})`);
      emailToProfileId.set(p.email, existing.id);
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: p.email,
      email_confirm: true,
      user_metadata: { full_name: p.fullName },
    });
    if (error) {
      throw new Error(`Failed to create auth user ${p.email}: ${error.message}`);
    }
    console.log(`  ${p.email} — created (${data.user.id})`);
    emailToProfileId.set(p.email, data.user.id);
  }

  // Upsert profiles (order: admin first, then senior managers, then managers)
  console.log('\nUpserting profiles...');
  for (const p of PROFILES) {
    const profileId = emailToProfileId.get(p.email);
    if (!profileId) throw new Error(`No auth user ID for ${p.email}`);

    const managerId = p.managerEmail ? emailToProfileId.get(p.managerEmail) : null;

    const { error } = await supabase.from('profiles').upsert(
      {
        id: profileId,
        email: p.email,
        full_name: p.fullName,
        role: p.role,
        manager_id: managerId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (error) throw new Error(`Profile upsert failed for ${p.email}: ${error.message}`);
    console.log(`  ${p.role.padEnd(16)} ${p.fullName.padEnd(20)} (${profileId})`);
  }

  // Insert employees
  console.log('\nInserting employees...');
  for (const emp of EMPLOYEES) {
    const managerId = emailToProfileId.get(emp.managerEmail);
    if (!managerId) throw new Error(`No profile ID for manager ${emp.managerEmail}`);

    // Check if already exists
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .eq('email', emp.email)
      .maybeSingle();

    if (existing) {
      console.log(`  ${emp.fullName.padEnd(20)} — already exists, updating manager`);
      await supabase
        .from('employees')
        .update({ full_name: emp.fullName, manager_id: managerId, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      continue;
    }

    const { error } = await supabase.from('employees').insert({
      full_name: emp.fullName,
      email: emp.email,
      manager_id: managerId,
    });
    if (error) throw new Error(`Employee insert failed for ${emp.email}: ${error.message}`);
    console.log(`  ${emp.fullName.padEnd(20)} → ${emp.managerEmail}`);
  }

  // Summary
  const { data: profileCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
  const { data: employeeCount } = await supabase.from('employees').select('id', { count: 'exact', head: true });

  console.log('\n--- Seed complete ---');
  console.log(`Profiles: ${profileCount?.length ?? '?'}`);
  console.log(`Employees: ${employeeCount?.length ?? '?'}`);
  console.log('\nHierarchy:');
  console.log('  James Oswald (admin)');
  console.log('  ├── Sarah Johnson (senior_manager)');
  console.log('  │   ├── Lisa Park (manager) → 3 employees');
  console.log('  │   └── Tom Rivera (manager) → 3 employees');
  console.log('  └── Mike Chen (senior_manager)');
  console.log('      ├── Amy Foster (manager) → 3 employees');
  console.log('      └── Dan Walsh (manager) → 3 employees');
}

seed().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});

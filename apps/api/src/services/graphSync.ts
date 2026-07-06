import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

interface GraphUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle?: string | null; // Graph omits null-valued properties from $select responses
}

interface GraphListResponse {
  value: GraphUser[];
  '@odata.nextLink'?: string;
}

interface GraphManagerResponse {
  id: string;
}

interface OrgMember {
  graphId: string;
  email: string;
  fullName: string;
  title: string | null;
  managerGraphId: string | null;
}

interface SyncResult {
  profilesCreated: number;
  profilesUpdated: number;
  employeesCreated: number;
  employeesUpdated: number;
  flaggedAdmins: string[];
  errors: string[];
}

function getEntraConfig() {
  const tenantId = process.env['ENTRA_TENANT_ID'];
  const clientId = process.env['ENTRA_CLIENT_ID'];
  const clientSecret = process.env['ENTRA_CLIENT_SECRET'];
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing ENTRA_TENANT_ID, ENTRA_CLIENT_ID, or ENTRA_CLIENT_SECRET');
  }
  return { tenantId, clientId, clientSecret };
}

function getSupabaseAdmin() {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'];
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getGraphToken(): Promise<string> {
  const { tenantId, clientId, clientSecret } = getEntraConfig();
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const { data } = await axios.post<{ access_token: string }>(url, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data.access_token;
}

async function fetchAllGraphUsers(token: string): Promise<GraphUser[]> {
  const users: GraphUser[] = [];
  let url: string | null =
    'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,jobTitle&$top=999&$filter=accountEnabled eq true';

  while (url) {
    const res: { data: GraphListResponse } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    users.push(...res.data.value);
    url = res.data['@odata.nextLink'] ?? null;
  }
  return users;
}

async function fetchManagerId(token: string, userId: string): Promise<string | null> {
  try {
    const { data } = await axios.get<GraphManagerResponse>(
      `https://graph.microsoft.com/v1.0/users/${userId}/manager?$select=id`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return data.id;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

async function fetchManagersInChunks(
  token: string,
  users: GraphUser[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const CHUNK = 10;
  for (let i = 0; i < users.length; i += CHUNK) {
    const chunk = users.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      chunk.map(async (u) => ({ id: u.id, mgr: await fetchManagerId(token, u.id) })),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        map.set(r.value.id, r.value.mgr);
      }
    }
  }
  return map;
}

function classifyRoles(members: OrgMember[]): {
  managers: OrgMember[];
  seniorManagers: OrgMember[];
  admins: OrgMember[];
  employees: OrgMember[];
} {
  const byGraphId = new Map(members.map((m) => [m.graphId, m]));
  const reportIds = new Map<string, string[]>();
  for (const m of members) {
    if (m.managerGraphId && byGraphId.has(m.managerGraphId)) {
      const existing = reportIds.get(m.managerGraphId) ?? [];
      existing.push(m.graphId);
      reportIds.set(m.managerGraphId, existing);
    }
  }

  const hasReports = new Set(reportIds.keys());

  const seniorManagerIds = new Set<string>();
  const managerIds = new Set<string>();

  for (const [managerId, reports] of reportIds) {
    const reportsAreManagers = reports.some((rid) => hasReports.has(rid));
    if (reportsAreManagers) {
      seniorManagerIds.add(managerId);
    } else {
      managerIds.add(managerId);
    }
  }

  const managers: OrgMember[] = [];
  const seniorManagers: OrgMember[] = [];
  const admins: OrgMember[] = [];
  const employees: OrgMember[] = [];

  for (const m of members) {
    if (seniorManagerIds.has(m.graphId)) {
      seniorManagers.push(m);
    } else if (managerIds.has(m.graphId)) {
      managers.push(m);
    } else if (!m.managerGraphId || !byGraphId.has(m.managerGraphId)) {
      admins.push(m);
    } else {
      employees.push(m);
    }
  }

  return { managers, seniorManagers, admins, employees };
}

export async function syncOrgStructure(): Promise<SyncResult> {
  const result: SyncResult = {
    profilesCreated: 0,
    profilesUpdated: 0,
    employeesCreated: 0,
    employeesUpdated: 0,
    flaggedAdmins: [],
    errors: [],
  };

  console.log('[graph-sync] Authenticating with Microsoft Graph...');
  const token = await getGraphToken();

  console.log('[graph-sync] Fetching users from Azure AD...');
  const graphUsers = await fetchAllGraphUsers(token);
  console.log(`[graph-sync] Found ${graphUsers.length} enabled users`);

  console.log('[graph-sync] Fetching manager relationships...');
  const managerMap = await fetchManagersInChunks(token, graphUsers);

  const members: OrgMember[] = graphUsers.map((u) => ({
    graphId: u.id,
    email: (u.mail ?? u.userPrincipalName).toLowerCase(),
    fullName: u.displayName,
    title: u.jobTitle ?? null,
    managerGraphId: managerMap.get(u.id) ?? null,
  }));

  const { managers, seniorManagers, admins, employees } = classifyRoles(members);
  console.log(
    `[graph-sync] Classified: ${seniorManagers.length} senior_managers, ` +
    `${managers.length} managers, ${employees.length} employees, ` +
    `${admins.length} admins (flagged for review)`,
  );

  result.flaggedAdmins = admins.map((a) => `${a.fullName} <${a.email}>`);

  const supabase = getSupabaseAdmin();

  // Fetch existing auth users to avoid duplicates
  const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const authByEmail = new Map(
    (authData?.users ?? []).map((u) => [u.email?.toLowerCase(), u.id]),
  );

  // Graph ID → Supabase profile ID mapping (built as we go)
  const graphToProfileId = new Map<string, string>();

  // Pass 1: ensure auth users + profiles exist for managers, senior managers, admins
  const profileMembers = [...seniorManagers, ...managers, ...admins];

  for (const member of profileMembers) {
    try {
      let authId = authByEmail.get(member.email);

      if (!authId) {
        const { data, error } = await supabase.auth.admin.createUser({
          email: member.email,
          email_confirm: true,
          user_metadata: { full_name: member.fullName },
        });
        if (error) {
          result.errors.push(`Auth create failed for ${member.email}: ${error.message}`);
          continue;
        }
        authId = data.user.id;
        authByEmail.set(member.email, authId);
      }

      graphToProfileId.set(member.graphId, authId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(`Auth setup failed for ${member.email}: ${msg}`);
    }
  }

  // Pass 2: upsert profiles with correct role (manager_id set in pass 3).
  // Classification can never produce 'executive' — it is assigned only via an
  // audited service-key write — so an existing executive keeps that role
  // instead of being reclassified on the next org-sync run.
  const { data: executiveRows, error: executiveErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'executive');
  if (executiveErr) {
    console.warn(
      `[graph-sync] Executive lookup failed (${executiveErr.message}) — role preservation skipped this run`,
    );
  }
  const executiveIds = new Set((executiveRows ?? []).map((r) => String(r.id)));

  for (const member of profileMembers) {
    const profileId = graphToProfileId.get(member.graphId);
    if (!profileId) continue;

    let role: 'admin' | 'senior_manager' | 'manager' = 'admin';
    if (seniorManagers.includes(member)) role = 'senior_manager';
    else if (managers.includes(member)) role = 'manager';

    const { error, status } = await supabase.from('profiles').upsert(
      {
        id: profileId,
        email: member.email,
        full_name: member.fullName,
        ...(executiveIds.has(profileId) ? {} : { role }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    if (error) {
      result.errors.push(`Profile upsert failed for ${member.email}: ${error.message}`);
    } else {
      status === 201 ? result.profilesCreated++ : result.profilesUpdated++;
    }
  }

  // Pass 3: set manager_id on profiles (now that all profile IDs exist)
  for (const member of profileMembers) {
    if (!member.managerGraphId) continue;
    const profileId = graphToProfileId.get(member.graphId);
    const managerProfileId = graphToProfileId.get(member.managerGraphId);
    if (!profileId || !managerProfileId) continue;

    await supabase
      .from('profiles')
      .update({ manager_id: managerProfileId, updated_at: new Date().toISOString() })
      .eq('id', profileId);
  }

  // Pass 4: upsert employees (ICs)
  for (const emp of employees) {
    const managerProfileId = emp.managerGraphId
      ? graphToProfileId.get(emp.managerGraphId)
      : undefined;
    if (!managerProfileId) {
      result.errors.push(`Skipped employee ${emp.email}: manager not in profiles`);
      continue;
    }

    try {
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .eq('email', emp.email)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('employees')
          .update({
            full_name: emp.fullName,
            title: emp.title,
            manager_id: managerProfileId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        result.employeesUpdated++;
      } else {
        const { error } = await supabase.from('employees').insert({
          full_name: emp.fullName,
          email: emp.email,
          title: emp.title,
          manager_id: managerProfileId,
        });
        if (error) {
          result.errors.push(`Employee insert failed for ${emp.email}: ${error.message}`);
        } else {
          result.employeesCreated++;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(`Employee sync failed for ${emp.email}: ${msg}`);
    }
  }

  console.log('[graph-sync] Sync complete:', JSON.stringify(result, null, 2));
  return result;
}

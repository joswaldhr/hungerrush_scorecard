// One-off discovery: look up the two named pilot managers and their direct
// reports via Microsoft Graph. Scoped to exactly these two people — no
// directory-wide scan.

interface GraphUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle: string | null;
  department: string | null;
}

const MANAGER_EMAILS = ["alexander.smith@hungerrush.com", "barbara.maenza@hungerrush.com"];

async function getToken(): Promise<string> {
  const tenantId = process.env.ENTRA_TENANT_ID!;
  const clientId = process.env.ENTRA_CLIENT_ID!;
  const clientSecret = process.env.ENTRA_CLIENT_SECRET!;
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
  const { access_token } = (await res.json()) as { access_token: string };
  return access_token;
}

const SELECT = "id,displayName,mail,userPrincipalName,jobTitle,department";

async function getUserByEmail(token: string, email: string): Promise<GraphUser> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${email}?$select=${SELECT}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok)
    throw new Error(`User lookup failed for ${email}: ${res.status} ${await res.text()}`);
  return (await res.json()) as GraphUser;
}

async function getDirectReports(token: string, userId: string): Promise<GraphUser[]> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${userId}/directReports?$select=${SELECT}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok)
    throw new Error(`Direct reports failed for ${userId}: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { value: GraphUser[] };
  return data.value;
}

async function main() {
  const token = await getToken();

  for (const email of MANAGER_EMAILS) {
    const manager = await getUserByEmail(token, email);
    console.log(`\nManager: ${manager.displayName} <${manager.mail ?? manager.userPrincipalName}>`);
    console.log(`  title="${manager.jobTitle}" department="${manager.department}"`);

    const reports = await getDirectReports(token, manager.id);
    console.log(`  Direct reports (${reports.length}):`);
    for (const r of reports) {
      console.log(
        `    - ${r.displayName} <${r.mail ?? r.userPrincipalName}> title="${r.jobTitle}" dept="${r.department}"`
      );
    }
  }
}

main();

export {};

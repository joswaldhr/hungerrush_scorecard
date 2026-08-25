// One-off credential health check for live vendor connectors.
// Run with: pnpm connectors:health
// Confirms creds still work before any live connector is built on top of them.

async function checkZendesk(): Promise<void> {
  const subdomain = process.env.ZENDESK_SUBDOMAIN;
  const email = process.env.ZENDESK_EMAIL;
  const apiKey = process.env.ZENDESK_API_KEY;
  if (!subdomain || !email || !apiKey) {
    console.log("Zendesk: skipped (not configured)");
    return;
  }

  const auth = Buffer.from(`${email}/token:${apiKey}`).toString("base64");
  const res = await fetch(`https://${subdomain}.zendesk.com/api/v2/users/me.json`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) {
    console.log(`Zendesk: FAILED (${res.status} ${res.statusText})`);
    return;
  }

  const body = (await res.json()) as { user: { name: string; email: string; role: string } };
  console.log(`Zendesk: OK — authenticated as ${body.user.name} (${body.user.role})`);
}

async function checkAssembled(): Promise<void> {
  const apiKey = process.env.ASSEMBLED_API_KEY;
  if (!apiKey) {
    console.log("Assembled: skipped (not configured)");
    return;
  }

  const auth = Buffer.from(`${apiKey}:`).toString("base64");
  const res = await fetch("https://api.assembledhq.com/v0/people?limit=1", {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) {
    console.log(`Assembled: FAILED (${res.status} ${res.statusText})`);
    return;
  }

  const body = (await res.json()) as { people: Record<string, unknown> };
  console.log(`Assembled: OK — ${Object.keys(body.people).length} people returned`);
}

async function checkGraph(): Promise<void> {
  const tenantId = process.env.ENTRA_TENANT_ID;
  const clientId = process.env.ENTRA_CLIENT_ID;
  const clientSecret = process.env.ENTRA_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    console.log("Microsoft Graph: skipped (not configured)");
    return;
  }

  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  if (!tokenRes.ok) {
    console.log(`Microsoft Graph: FAILED to get token (${tokenRes.status} ${tokenRes.statusText})`);
    return;
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const usersRes = await fetch("https://graph.microsoft.com/v1.0/users?$top=1", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!usersRes.ok) {
    console.log(
      `Microsoft Graph: token OK but users call FAILED (${usersRes.status} ${usersRes.statusText})`
    );
    return;
  }

  console.log("Microsoft Graph: OK — token issued and /users call succeeded");
}

async function main() {
  await checkZendesk();
  await checkAssembled();
  await checkGraph();
}

main();

export {};

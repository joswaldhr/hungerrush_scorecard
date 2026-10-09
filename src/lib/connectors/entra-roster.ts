import { z } from "zod";

export type DirectoryEmployee = { id: string; email: string | null };
export type DirectoryResult = {
  employeeId: string;
  status: "enabled" | "disabled" | "not_found" | "ambiguous" | "missing_email";
};
export type DirectoryCredentials = { tenantId: string; clientId: string; clientSecret: string };

export function entraAccountReference(tenantId: string) {
  return `entra-tenant:${z.string().uuid().parse(tenantId).toLowerCase()}`;
}

const userSchema = z.object({
  id: z.string().uuid(),
  mail: z.string().nullable(),
  userPrincipalName: z.string(),
  accountEnabled: z.boolean(),
});
const normalized = (value: string | null) => (value ?? "").trim().toLowerCase();

/** Exact email/UPN matches only. No directory or Zendesk mutations and no tenant-wide enumeration. */
export async function readEntraRoster(
  employees: DirectoryEmployee[],
  credentials: DirectoryCredentials,
  fetcher: typeof fetch = fetch
): Promise<DirectoryResult[]> {
  entraAccountReference(credentials.tenantId);
  z.string().uuid().parse(credentials.clientId);
  if (
    !credentials.clientSecret ||
    employees.length > 100 ||
    new Set(employees.map((e) => e.id)).size !== employees.length
  )
    throw new Error("Directory check scope is invalid");
  if (!employees.length) return [];
  // One deadline for authentication and all pages, not a fresh timeout for every request.
  const signal = AbortSignal.timeout(60000);
  const response = await fetcher(
    `https://login.microsoftonline.com/${credentials.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal,
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );
  if (!response.ok) throw new Error("Directory authentication failed");
  const token = z.object({ access_token: z.string().min(1) }).parse(await response.json());
  const emails = [...new Set(employees.map((e) => normalized(e.email)).filter(Boolean))];
  if (emails.some((email) => email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email)))
    throw new Error("Directory email is invalid");
  const users = new Map<string, z.infer<typeof userSchema>>();
  // At most 15 small GETs (seven emails / fourteen filter clauses each). A truncated response fails the entire observation instead of
  // turning an unseen account into a departure. No pagination URLs are followed.
  for (let start = 0; start < emails.length; start += 7) {
    const selected = emails.slice(start, start + 7);
    const url = new URL("https://graph.microsoft.com/v1.0/users");
    url.searchParams.set(
      "$filter",
      selected
        .map((email) => {
          const literal = email.replaceAll("'", "''");
          return `(mail eq '${literal}' or userPrincipalName eq '${literal}')`;
        })
        .join(" or ")
    );
    url.searchParams.set("$select", "id,mail,userPrincipalName,accountEnabled");
    url.searchParams.set("$top", "999");
    const result = await fetcher(url, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      signal,
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!result.ok) throw new Error("Directory read failed");
    const page = z
      .object({ value: z.array(userSchema).max(999), "@odata.nextLink": z.string().optional() })
      .parse(await result.json());
    if (page["@odata.nextLink"]) throw new Error("Directory result is incomplete");
    for (const user of page.value) {
      if (
        !selected.some((email) =>
          [normalized(user.mail), normalized(user.userPrincipalName)].includes(email)
        )
      )
        throw new Error("Directory response is outside the requested scope");
      const prior = users.get(user.id);
      if (prior && JSON.stringify(prior) !== JSON.stringify(user))
        throw new Error("Directory changed during observation");
      users.set(user.id, user);
    }
  }
  const matches = employees.map((employee) => ({
    employee,
    users: [...users.values()].filter(
      (user) =>
        normalized(employee.email) &&
        [normalized(user.mail), normalized(user.userPrincipalName)].includes(
          normalized(employee.email)
        )
    ),
  }));
  return matches.map(({ employee, users: found }) => ({
    employeeId: employee.id,
    status: !normalized(employee.email)
      ? "missing_email"
      : !found.length
        ? "not_found"
        : found.length !== 1 ||
            matches.some(
              (other) =>
                other.employee.id !== employee.id && other.users.some((u) => u.id === found[0]!.id)
            )
          ? "ambiguous"
          : found[0]!.accountEnabled
            ? "enabled"
            : "disabled",
  }));
}

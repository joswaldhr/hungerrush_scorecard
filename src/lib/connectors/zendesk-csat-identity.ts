import { z } from "zod";

const pageSchema = z.object({
  users: z.array(
    z.object({
      id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      email: z.string().nullable(),
      role: z.enum(["agent", "admin"]),
      active: z.boolean(),
      suspended: z.boolean(),
    })
  ),
  meta: z.object({ has_more: z.boolean() }),
  links: z.object({ next: z.string().nullable() }),
});

/** Current-assignee identity only. Agent role does not establish human event authorship. */
export async function resolveCsatStaffIdentities(
  externalIds: string[],
  read: (path: string) => Promise<unknown>
) {
  const requested = externalIds.map((email) => email.trim().toLowerCase());
  if (
    requested.some((email) => !email || !email.includes("@")) ||
    new Set(requested).size !== requested.length
  )
    throw new Error("Ambiguous or invalid CSAT employee identities");
  const users: z.infer<typeof pageSchema>["users"] = [];
  const ids = new Set<number>(),
    visited = new Set<string>();
  let path =
    "/users.json?role%5B%5D=agent&role%5B%5D=admin&page%5Bsize%5D=100&include_boundary_indicators=true";
  for (let page = 1; page <= 20; page++) {
    if (visited.has(path)) throw new Error("Incomplete CSAT staff census: pagination loop");
    visited.add(path);
    const result = pageSchema.safeParse(await read(path));
    if (!result.success) throw new Error("Invalid CSAT staff census page");
    for (const user of result.data.users) {
      if (ids.has(user.id)) throw new Error("Duplicate CSAT staff identity");
      ids.add(user.id);
      users.push(user);
    }
    if (!result.data.meta.has_more) {
      const identities = new Map<string, number>();
      for (let i = 0; i < requested.length; i++) {
        const matches = users.filter(
          (u) => u.email?.toLowerCase() === requested[i] && u.active && !u.suspended
        );
        if (matches.length !== 1)
          throw new Error("CSAT employee has no unique active source identity");
        identities.set(externalIds[i]!, matches[0]!.id);
      }
      return { identities, pages: page, staffCount: users.length };
    }
    if (!result.data.links.next || !result.data.users.length)
      throw new Error("Incomplete CSAT staff census continuation");
    // Preserve role filters if a vendor continuation drops them. The read transport
    // separately enforces the account origin before attaching a credential.
    const next = new URL(result.data.links.next, "https://placeholder.invalid/api/v2/");
    next.searchParams.delete("role");
    next.searchParams.delete("role[]");
    next.searchParams.append("role[]", "agent");
    next.searchParams.append("role[]", "admin");
    next.searchParams.set("include_boundary_indicators", "true");
    path =
      next.origin === "https://placeholder.invalid"
        ? next.pathname.replace(/^\/api\/v2/, "") + next.search
        : next.toString();
  }
  throw new Error("CSAT staff census page budget exhausted");
}

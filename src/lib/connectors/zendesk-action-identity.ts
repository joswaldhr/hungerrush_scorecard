import { z } from "zod";

const userSchema = z.object({
  id: z.number().int().positive().safe(),
  email: z.string().nullable(),
  role: z.enum(["end-user", "agent", "admin"]),
  active: z.boolean(),
  suspended: z.boolean(),
  verified: z.boolean(),
});
const pageSchema = z.object({ users: z.array(userSchema), next_page: z.string().nullable() });

/** Current exact-email observation only: neither historical eligibility nor human-action proof. */
export async function resolveActionActor(
  email: string,
  getPage: (path: string) => Promise<unknown>
) {
  const normalized = email.trim().toLowerCase();
  if (!z.string().email().safeParse(normalized).success) throw new Error("Invalid identity email");
  let path = `/users/search.json?query=${encodeURIComponent(normalized)}`;
  const visited = new Set<string>();
  const observed = new Map<number, z.output<typeof userSchema>>();
  for (let pages = 0; pages < 5; pages++) {
    if (visited.has(path)) throw new Error("Identity search pagination stalled");
    visited.add(path);
    const page = pageSchema.parse(await getPage(path));
    for (const user of page.users) {
      const previous = observed.get(user.id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(user))
        throw new Error("Identity changed during verification");
      observed.set(user.id, user);
    }
    if (!page.next_page) {
      const matches = [...observed.values()].filter(
        (user) => user.email?.trim().toLowerCase() === normalized
      );
      if (matches.length !== 1)
        return {
          status: matches.length ? ("ambiguous" as const) : ("missing" as const),
          user: null,
        };
      return { status: "matched" as const, user: matches[0]! };
    }
    path = page.next_page;
  }
  throw new Error("Identity search incomplete");
}

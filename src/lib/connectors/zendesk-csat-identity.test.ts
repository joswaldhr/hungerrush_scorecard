// @vitest-environment node
import { expect, it, vi } from "vitest";
import { resolveCsatStaffIdentities } from "./zendesk-csat-identity";
const user = (id: number, email = "synthetic@example.test", patch = {}) => ({
  id,
  email,
  role: "agent",
  active: true,
  suspended: false,
  ...patch,
});
const page = (users: unknown[], next: string | null = null) => ({
  users,
  meta: { has_more: next !== null },
  links: { next },
});
it("resolves exact active identities across a complete staff-only census", async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce(
      page(
        [user(1, "old@example.test", { active: false })],
        "/api/v2/users.json?page%5Bafter%5D=next"
      )
    )
    .mockResolvedValueOnce(page([user(2)]));
  const result = await resolveCsatStaffIdentities(["Synthetic@example.test"], read);
  expect(result.identities.get("Synthetic@example.test")).toBe(2);
  expect(result.pages).toBe(2);
  const continuation = new URL(read.mock.calls[1]![0], "https://synthetic.zendesk.com/api/v2");
  expect(continuation.searchParams.getAll("role[]")).toEqual(["agent", "admin"]);
});
it("rejects missing, inactive, duplicated and ambiguous employee mappings", async () => {
  for (const users of [
    [],
    [user(1, undefined, { active: false })],
    [user(1, undefined, { suspended: true })],
    [user(1), user(2)],
    [user(1), user(1)],
  ]) {
    await expect(
      resolveCsatStaffIdentities(["synthetic@example.test"], async () => page(users))
    ).rejects.toThrow();
  }
  await expect(
    resolveCsatStaffIdentities(["synthetic@example.test", "Synthetic@example.test"], async () =>
      page([])
    )
  ).rejects.toThrow(/Ambiguous/);
});
it("does not accept end users, incomplete pagination or source failures", async () => {
  await expect(
    resolveCsatStaffIdentities(["synthetic@example.test"], async () =>
      page([user(1, undefined, { role: "end-user" })])
    )
  ).rejects.toThrow(/Invalid/);
  await expect(
    resolveCsatStaffIdentities(["synthetic@example.test"], async () =>
      page([], "/users.json?next=1")
    )
  ).rejects.toThrow(/continuation/);
  await expect(
    resolveCsatStaffIdentities(["synthetic@example.test"], async () => {
      throw new Error("source unavailable");
    })
  ).rejects.toThrow(/source unavailable/);
});

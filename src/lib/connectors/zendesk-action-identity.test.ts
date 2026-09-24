import { expect, it, vi } from "vitest";
import { resolveActionActor } from "./zendesk-action-identity";

const user = {
  id: 7,
  email: "agent@example.com",
  role: "agent",
  active: true,
  suspended: false,
  verified: true,
};

it("matches exact email only and strips unrelated personal fields", async () => {
  const get = vi.fn().mockResolvedValue({
    users: [
      { ...user, phone: "private" },
      { ...user, id: 8, email: "other@example.com" },
    ],
    next_page: null,
  });
  const result = await resolveActionActor(" AGENT@example.com ", get);
  expect(result).toEqual({ status: "matched", user });
  expect(get).toHaveBeenCalledWith("/users/search.json?query=agent%40example.com");
});

it("does not accept the first match when another page is ambiguous", async () => {
  const get = vi
    .fn()
    .mockResolvedValueOnce({ users: [user], next_page: "/next" })
    .mockResolvedValueOnce({ users: [{ ...user, id: 9 }], next_page: null });
  expect(await resolveActionActor(user.email, get)).toEqual({ status: "ambiguous", user: null });
});

it("rejects incomplete and contradictory search observations", async () => {
  const cyclic = vi.fn().mockResolvedValue({ users: [user], next_page: "/next" });
  await expect(resolveActionActor(user.email, cyclic)).rejects.toThrow("stalled");
  const conflict = vi
    .fn()
    .mockResolvedValueOnce({ users: [user], next_page: "/next" })
    .mockResolvedValueOnce({ users: [{ ...user, suspended: true }], next_page: null });
  await expect(resolveActionActor(user.email, conflict)).rejects.toThrow("changed");
});

it("reports missing users and retains restrictive account flags without claiming eligibility", async () => {
  expect(
    await resolveActionActor(user.email, async () => ({ users: [], next_page: null }))
  ).toEqual({ status: "missing", user: null });
  const result = await resolveActionActor(user.email, async () => ({
    users: [{ ...user, active: false, suspended: true, verified: false, role: "end-user" }],
    next_page: null,
  }));
  expect(result.user).toMatchObject({
    active: false,
    suspended: true,
    verified: false,
    role: "end-user",
  });
});

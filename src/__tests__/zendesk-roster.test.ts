import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/connectors/zendesk-shared", () => ({ zendeskGet: vi.fn() }));
import { zendeskGet } from "@/lib/connectors/zendesk-shared";
import { ZendeskConnector } from "@/lib/connectors/zendesk";

const config = { organizationId: "synthetic-org", dataSourceId: "synthetic-source" };
const user = { id: 42, email: "synthetic@example.invalid", name: "Synthetic", active: true };
beforeEach(() => vi.resetAllMocks());

function pages(secondUser = user) {
  vi.mocked(zendeskGet)
    .mockResolvedValueOnce({ group_memberships: [{ user_id: 42, group_id: 1 }], next_page: null })
    .mockResolvedValueOnce({ users: [user] })
    .mockResolvedValueOnce({
      group_memberships: [{ user_id: secondUser.id, group_id: 2 }],
      next_page: null,
    })
    .mockResolvedValueOnce({ users: [secondUser] });
}

it("deduplicates the same account in groups mapped to the same team", async () => {
  pages();
  const result = await new ZendeskConnector().discoverRoster(config, [
    { externalGroupId: "1", teamId: "team-a" },
    { externalGroupId: "2", teamId: "team-a" },
  ]);
  expect(result).toHaveLength(1);
  expect(result[0]!.teamId).toBe("team-a");
});

it.each([
  ["team-a", "team-b"],
  ["team-b", "team-a"],
])(
  "rejects conflicting teams regardless of traversal order (%s then %s)",
  async (first, second) => {
    pages();
    await expect(
      new ZendeskConnector().discoverRoster(config, [
        { externalGroupId: "1", teamId: first },
        { externalGroupId: "2", teamId: second },
      ])
    ).rejects.toThrow("conflicting accounts or team mappings");
  }
);

it("rejects separate source accounts sharing a case-insensitive email", async () => {
  pages({ ...user, id: 43, email: user.email.toUpperCase() });
  await expect(
    new ZendeskConnector().discoverRoster(config, [
      { externalGroupId: "1", teamId: "team-a" },
      { externalGroupId: "2", teamId: "team-a" },
    ])
  ).rejects.toThrow("conflicting accounts or team mappings");
});

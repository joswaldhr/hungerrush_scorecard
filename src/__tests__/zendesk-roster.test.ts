import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/connectors/zendesk-shared", () => ({ zendeskGet: vi.fn() }));
import { zendeskGet } from "@/lib/connectors/zendesk-shared";
import { ZendeskConnector } from "@/lib/connectors/zendesk";

const config = { organizationId: "synthetic-org", dataSourceId: "synthetic-source" };
const user = { id: 42, email: "synthetic@example.invalid", name: "Synthetic", active: true };
beforeEach(() => vi.resetAllMocks());

it.each(["restaurant", "consumer"])(
  "retains the existing %s line for one account in both line groups",
  async (line) => {
    pages();
    const result = await new ZendeskConnector().discoverRoster(
      config,
      [
        { externalGroupId: "1", teamId: "team-a", line: "restaurant" },
        { externalGroupId: "2", teamId: "team-a", line: "consumer" },
      ],
      [{ externalId: user.email, teamId: "team-a", line }]
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ externalId: user.email, teamId: "team-a", line });
  }
);

it.each([
  [{ externalId: user.email, teamId: "team-a", line: null }],
  [{ externalId: user.email, teamId: "team-a", line: "unobserved" }],
  [{ externalId: user.email, teamId: "team-b", line: "consumer" }],
  [
    { externalId: user.email, teamId: "team-a", line: "consumer" },
    { externalId: user.email, teamId: "team-a", line: "restaurant" },
  ],
])("rejects missing, unmatched or ambiguous saved assignments (%j)", async (...assignments) => {
  pages();
  await expect(
    new ZendeskConnector().discoverRoster(
      config,
      [
        { externalGroupId: "1", teamId: "team-a", line: "restaurant" },
        { externalGroupId: "2", teamId: "team-a", line: "consumer" },
      ],
      assignments
    )
  ).rejects.toThrow("conflicting accounts");
});

it("never uses a saved line to merge different accounts sharing an email", async () => {
  pages({ ...user, id: 43 });
  await expect(
    new ZendeskConnector().discoverRoster(
      config,
      [
        { externalGroupId: "1", teamId: "team-a", line: "restaurant" },
        { externalGroupId: "2", teamId: "team-a", line: "consumer" },
      ],
      [{ externalId: user.email, teamId: "team-a", line: "consumer" }]
    )
  ).rejects.toThrow("conflicting accounts");
});

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

it("rejects missing requested users instead of returning an empty roster", async () => {
  vi.mocked(zendeskGet)
    .mockResolvedValueOnce({ group_memberships: [{ user_id: 42, group_id: 1 }], next_page: null })
    .mockResolvedValueOnce({ users: [] });
  await expect(
    new ZendeskConnector().discoverRoster(config, [{ externalGroupId: "1", teamId: "team-a" }])
  ).rejects.toThrow("every requested account");
});

it("rejects a repeated pagination cursor without fetching forever", async () => {
  vi.mocked(zendeskGet).mockResolvedValue({
    group_memberships: [],
    next_page: "/groups/1/memberships.json",
  });
  await expect(
    new ZendeskConnector().discoverRoster(config, [{ externalGroupId: "1", teamId: "team-a" }])
  ).rejects.toThrow("pagination did not complete");
  expect(zendeskGet).toHaveBeenCalledTimes(1);
});

it("requires an explicit final page and matching group membership", async () => {
  vi.mocked(zendeskGet).mockResolvedValueOnce({ group_memberships: [] });
  await expect(
    new ZendeskConnector().discoverRoster(config, [{ externalGroupId: "1", teamId: "team-a" }])
  ).rejects.toThrow("membership response");
  vi.mocked(zendeskGet).mockResolvedValueOnce({
    group_memberships: [{ user_id: 42, group_id: 2 }],
    next_page: null,
  });
  await expect(
    new ZendeskConnector().discoverRoster(config, [{ externalGroupId: "1", teamId: "team-a" }])
  ).rejects.toThrow("membership response");
});

it("preserves configured line and rejects conflicting lines within the same team", async () => {
  pages();
  const mappings = [
    { externalGroupId: "1", teamId: "team-a", line: "restaurant" },
    { externalGroupId: "2", teamId: "team-a", line: "restaurant" },
  ];
  expect((await new ZendeskConnector().discoverRoster(config, mappings))[0]!.line).toBe(
    "restaurant"
  );
  pages();
  await expect(
    new ZendeskConnector().discoverRoster(config, [
      mappings[0]!,
      { ...mappings[1]!, line: "consumer" },
    ])
  ).rejects.toThrow("conflicting accounts");
});

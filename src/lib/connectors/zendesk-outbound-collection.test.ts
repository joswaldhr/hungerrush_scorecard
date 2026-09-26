// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { outboundObservationFixture } from "@/__tests__/fixtures/outbound-observation";
import { collectOutboundRecords } from "./zendesk-outbound-collection";
import { normalizeOutboundRecord } from "./zendesk-outbound-record";
const f = () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-25T12:06:00Z"));
  return outboundObservationFixture();
};
const members = [
  {
    employeeId: "synthetic-employee",
    teamId: "00000000-0000-4000-8000-000000000003",
    externalId: "one@example.test",
  },
  {
    employeeId: "second-employee",
    teamId: "00000000-0000-4000-8000-000000000003",
    externalId: "two@example.test",
  },
];
const reader = () =>
  vi.fn(async (path: string) =>
    path.startsWith("/users.json")
      ? {
          users: members.map((m, i) => ({
            id: i === 0 ? 42 : 99,
            email: m.externalId,
            role: "agent",
            active: true,
            suspended: false,
          })),
          meta: { has_more: false },
          links: { next: null },
        }
      : { tickets: outboundObservationFixture().tickets.tickets }
  );
afterEach(() => vi.useRealTimers());
it("resolves numeric identities once and builds separate employees from one ticket census", async () => {
  const fixture = f(),
    read = reader();
  const result = await collectOutboundRecords(
    fixture.snapshot,
    fixture.policy,
    fixture.config,
    fixture.periodStart,
    fixture.periodEnd,
    members,
    read
  );
  expect(read).toHaveBeenCalledTimes(2);
  expect(result.records).toHaveLength(2);
  const facts = result.records.map((r, i) =>
    normalizeOutboundRecord(
      r.payload,
      members[i]!.employeeId,
      members[i]!.teamId,
      fixture.periodStart,
      fixture.periodEnd
    )
  );
  expect(
    facts.map((rows) => rows.find((r) => r.factType === "outbound_calls")?.numericValue)
  ).toEqual([2, 1]);
  expect(result.diagnostics).toMatchObject({
    activeEmployees: 2,
    linkedTickets: 2,
    sourceIsAtomicSnapshot: false,
  });
  expect(JSON.stringify(result.diagnostics)).not.toContain("example.test");
});
it("rejects stale and pending stores or ambiguous employee bindings before a GET", async () => {
  const fixture = f(),
    read = reader();
  fixture.snapshot.callsState.cursor.status = "pending";
  await expect(
    collectOutboundRecords(
      fixture.snapshot,
      fixture.policy,
      fixture.config,
      fixture.periodStart,
      fixture.periodEnd,
      members,
      read
    )
  ).rejects.toThrow("exhausted");
  fixture.snapshot.callsState.cursor.status = "exhausted";
  vi.setSystemTime(new Date("2026-09-25T13:00:00Z"));
  await expect(
    collectOutboundRecords(
      fixture.snapshot,
      fixture.policy,
      fixture.config,
      fixture.periodStart,
      fixture.periodEnd,
      members,
      read
    )
  ).rejects.toThrow("stale");
  await expect(
    collectOutboundRecords(
      fixture.snapshot,
      fixture.policy,
      fixture.config,
      fixture.periodStart,
      fixture.periodEnd,
      [members[0]!, members[0]!],
      read
    )
  ).rejects.toThrow("unique");
  expect(read).not.toHaveBeenCalled();
});
it("does not return partial employee records after identity or metadata failure", async () => {
  const fixture = f(),
    read = reader();
  await expect(
    collectOutboundRecords(
      fixture.snapshot,
      fixture.policy,
      fixture.config,
      fixture.periodStart,
      fixture.periodEnd,
      [{ ...members[0]!, externalId: "unknown@example.test" }],
      read
    )
  ).rejects.toThrow("identity");
  expect(read).toHaveBeenCalledTimes(1);
  read.mockClear();
  read.mockImplementation(async (path) => {
    if (path.startsWith("/users.json")) return reader()(path);
    throw Error("metadata unavailable");
  });
  await expect(
    collectOutboundRecords(
      fixture.snapshot,
      fixture.policy,
      fixture.config,
      fixture.periodStart,
      fixture.periodEnd,
      members,
      read
    )
  ).rejects.toThrow("metadata unavailable");
});
it("rechecks freshness after source reads instead of publishing a stale calculation", async () => {
  const fixture = f(),
    base = reader();
  const read = async (path: string) => {
    const result = await base(path);
    if (path.startsWith("/tickets/")) vi.setSystemTime(new Date("2026-09-25T12:30:00Z"));
    return result;
  };
  await expect(
    collectOutboundRecords(
      fixture.snapshot,
      fixture.policy,
      fixture.config,
      fixture.periodStart,
      fixture.periodEnd,
      members,
      read
    )
  ).rejects.toThrow("stale");
});

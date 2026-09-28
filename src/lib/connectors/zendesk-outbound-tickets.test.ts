// @vitest-environment node
import { expect, it, vi } from "vitest";
import { collectOutboundTicketGroups } from "./zendesk-outbound-tickets";
import type { OutboundCall } from "./zendesk-outbound";
const scope = {
  accountReference: "zendesk-account:synthetic",
  periodStart: "2026-09-13",
  periodEnd: "2026-09-19",
  timeZone: "America/Chicago",
};
const call = (id: number, overrides: Partial<OutboundCall> = {}): OutboundCall => ({
  id,
  ticket_id: id,
  created_at: "2026-09-14T12:00:00Z",
  updated_at: "2026-09-14T13:00:00Z",
  direction: "outbound",
  completion_status: "completed",
  call_group_id: 99,
  phone_number: null,
  talk_time: 15,
  voicemail: false,
  ...overrides,
});
const ticket = (id: number) => ({
  id,
  group_id: 7,
  updated_at: "2026-09-20T12:00:00Z",
  subject: "private subject must not be retained",
});
it("fetches each linked ticket once in exact bounded batches and strips unrelated fields", async () => {
  const read = vi.fn(async (path: string) => ({
    tickets: new URL(path, "https://synthetic.zendesk.com").searchParams
      .get("ids")!
      .split(",")
      .map((x) => ticket(Number(x))),
  }));
  const result = await collectOutboundTicketGroups(
    [...Array.from({ length: 205 }, (_, i) => call(i + 1)), call(999, { ticket_id: 1 })],
    scope,
    read
  );
  expect(read).toHaveBeenCalledTimes(3);
  expect(result.coverage).toMatchObject({
    complete: true,
    requestedTickets: 205,
    returnedTickets: 205,
    requests: 3,
  });
  expect(JSON.stringify(result)).not.toContain("private subject");
});
it("uses local call-created dates and reports null ticket links separately", async () => {
  const read = vi.fn(async () => ({ tickets: [ticket(1)] }));
  const result = await collectOutboundTicketGroups(
    [
      call(1, { created_at: "2026-09-20T04:59:59Z", updated_at: "2026-09-20T06:00:00Z" }),
      call(2, { created_at: "2026-09-20T05:00:00Z", updated_at: "2026-09-20T06:00:00Z" }),
      call(3, { ticket_id: null }),
      call(4, { direction: "inbound" }),
    ],
    scope,
    read
  );
  expect(result.tickets.map((t) => t.id)).toEqual([1]);
  expect(result.coverage.unlinkedCalls).toBe(1);
});
it("rejects missing, duplicated and foreign tickets without returning a complete result", async () => {
  for (const tickets of [[], [ticket(1), ticket(1)], [ticket(2)]])
    await expect(
      collectOutboundTicketGroups([call(1)], scope, async () => ({ tickets }))
    ).rejects.toThrow(/coverage|duplicate/);
});
it("retains a reported null group without guessing and makes no requests for an empty cohort", async () => {
  const read = vi.fn(async () => ({ tickets: [{ ...ticket(1), group_id: null }] }));
  expect(
    (await collectOutboundTicketGroups([call(1)], scope, read)).tickets[0]?.group_id
  ).toBeNull();
  read.mockClear();
  expect((await collectOutboundTicketGroups([], scope, read)).coverage.requestedTickets).toBe(0);
  expect(read).not.toHaveBeenCalled();
});
it("propagates a failed batch and rejects invalid scopes before fetching", async () => {
  const read = vi.fn().mockRejectedValue(Error("bounded reader failed"));
  await expect(collectOutboundTicketGroups([call(1)], scope, read)).rejects.toThrow(
    "bounded reader failed"
  );
  read.mockClear();
  await expect(
    collectOutboundTicketGroups([call(1)], { ...scope, accountReference: "foreign" }, read)
  ).rejects.toThrow("scope");
  expect(read).not.toHaveBeenCalled();
});

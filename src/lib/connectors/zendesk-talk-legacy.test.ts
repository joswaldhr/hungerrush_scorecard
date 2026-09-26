// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchCoordinatedTalkWeek } from "./zendesk-talk-legacy";
import * as store from "./zendesk-talk-store";
vi.mock("./zendesk-talk-store", () => ({
  claimTalkCollection: vi.fn(),
  reserveTalkRequest: vi.fn(),
  deferTalkRequests: vi.fn(),
  releaseTalkCollection: vi.fn(),
}));
const scope = {
  organizationId: "org",
  dataSourceId: "source",
  accountReference: "zendesk-account:synthetic",
};
const url =
  "https://synthetic.zendesk.com/api/v2/channels/voice/stats/incremental/calls.json?start_time=1790078400";
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(store.claimTalkCollection).mockResolvedValue({
    acquired: true,
    token: "00000000-0000-4000-8000-000000000001",
    expiresAt: "later",
    nextAllowedAt: "now",
  });
  vi.mocked(store.reserveTalkRequest).mockResolvedValue({ reserved: true, waitMs: 0 });
});
afterEach(() => vi.useRealTimers());
it("preserves complete legacy call values while reserving every page through the shared budget", async () => {
  const call = {
    id: 1,
    created_at: "2026-09-21T12:00:00Z",
    updated_at: "2026-09-22T12:00:00Z",
    agent_id: 7,
    talk_time: 13,
  };
  const read = vi
    .fn()
    .mockResolvedValueOnce({
      rateLimited: false,
      page: { calls: [call], count: 1, end_time: 1790078400, next_page: url },
    })
    .mockResolvedValueOnce({
      rateLimited: false,
      page: { calls: [], count: 0, end_time: 1790078400, next_page: url },
    });
  const result = await fetchCoordinatedTalkWeek(scope, "2026-09-20", "2026-09-26", read);
  expect(result.calls).toEqual([call]);
  expect(result.diagnostics).toMatchObject({ requests: 2, sharedAccountBudget: true });
  expect(store.reserveTalkRequest).toHaveBeenCalledTimes(2);
  expect(store.releaseTalkCollection).toHaveBeenCalledTimes(1);
  expect(read.mock.calls[0]![0]).toContain("https://synthetic.zendesk.com/api/v2/channels/voice/");
});
it("makes no source request when another collector owns the account or a persisted delay is long", async () => {
  const read = vi.fn();
  vi.mocked(store.claimTalkCollection).mockResolvedValueOnce({ acquired: false, retryAt: "later" });
  await expect(fetchCoordinatedTalkWeek(scope, "2026-09-20", "2026-09-26", read)).rejects.toThrow(
    "already running"
  );
  expect(store.releaseTalkCollection).not.toHaveBeenCalled();
  vi.mocked(store.reserveTalkRequest).mockResolvedValueOnce({ reserved: false, waitMs: 60000 });
  await expect(
    fetchCoordinatedTalkWeek(scope, "2026-09-20", "2026-09-26", read)
  ).rejects.toMatchObject({ retryAfterMs: 60000 });
  expect(read).not.toHaveBeenCalled();
  expect(store.releaseTalkCollection).toHaveBeenCalledTimes(1);
});
it("persists a vendor delay and releases ownership without a hidden retry", async () => {
  const read = vi.fn().mockResolvedValue({ rateLimited: true, retryAfterMs: 120000 });
  await expect(
    fetchCoordinatedTalkWeek(scope, "2026-09-20", "2026-09-26", read)
  ).rejects.toMatchObject({ retryAfterMs: 120000 });
  expect(store.deferTalkRequests).toHaveBeenCalledWith(expect.objectContaining(scope), 120000);
  expect(read).toHaveBeenCalledTimes(1);
  expect(store.releaseTalkCollection).toHaveBeenCalledTimes(1);
});
it("withholds a partial page population on budget exhaustion or a transport failure", async () => {
  const read = vi.fn().mockResolvedValue({
    rateLimited: false,
    page: {
      calls: [{ id: 1, created_at: "2026-09-21T12:00:00Z", updated_at: "2026-09-22T12:00:00Z" }],
      count: 1,
      end_time: 1790078400,
      next_page: url,
    },
  });
  await expect(
    fetchCoordinatedTalkWeek(scope, "2026-09-20", "2026-09-26", read, { maxPages: 1 })
  ).rejects.toThrow("page budget");
  read.mockRejectedValueOnce(Error("request failed"));
  await expect(fetchCoordinatedTalkWeek(scope, "2026-09-20", "2026-09-26", read)).rejects.toThrow(
    "request failed"
  );
  expect(store.releaseTalkCollection).toHaveBeenCalledTimes(2);
});
it("rejects an overrun response even when that page would end pagination", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-26T12:00:00Z"));
  const read = vi.fn(async () => {
    vi.setSystemTime(new Date("2026-09-26T12:05:00Z"));
    return {
      rateLimited: false as const,
      page: { calls: [], count: 0, end_time: 1, next_page: null },
    };
  });
  await expect(fetchCoordinatedTalkWeek(scope, "2026-09-20", "2026-09-26", read)).rejects.toThrow(
    "elapsed-time"
  );
  expect(store.releaseTalkCollection).toHaveBeenCalledTimes(1);
});

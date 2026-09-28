// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { createTalkExportReader, runTalkCollectionBatch } from "./zendesk-talk-worker";
import * as store from "./zendesk-talk-store";
vi.mock("./zendesk-talk-store", () => ({
  claimTalkCollection: vi.fn(),
  beginTalkCollectionCycle: vi.fn(),
  commitTalkCollectionPage: vi.fn(),
  reserveTalkRequest: vi.fn(),
  releaseTalkCollection: vi.fn(),
  deferTalkRequests: vi.fn(),
}));
const scope = {
  organizationId: "org",
  dataSourceId: "source",
  accountReference: "zendesk-account:synthetic",
};
const origin = "https://synthetic.zendesk.com";
const url = `${origin}/api/v2/channels/voice/stats/incremental/calls.json?start_time=100`;
const credentials = {
  subdomain: "synthetic",
  email: "synthetic@example.invalid",
  apiKey: "synthetic-token",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(store.claimTalkCollection).mockResolvedValue({
    acquired: true,
    token: "00000000-0000-4000-8000-000000000001",
    expiresAt: "expiry",
    nextAllowedAt: "now",
  });
  vi.mocked(store.reserveTalkRequest).mockResolvedValue({ reserved: true, waitMs: 0 });
  vi.mocked(store.beginTalkCollectionCycle).mockImplementation(async (_s, resource) => ({
    expectedHash: resource,
    state: {
      accountReference: scope.accountReference,
      bootstrapStart: 100,
      cycle: 1,
      observationStartedAt: "now",
      lastPageAt: null,
      cursor: {
        version: 1,
        origin,
        resource,
        initialStartTime: 100,
        path: url.replace("calls.json", `${resource}.json`),
        watermark: 100,
        pages: 0,
        status: "pending",
        visited: [],
      },
    },
  }));
  vi.mocked(store.commitTalkCollectionPage).mockImplementation(async (s, r) => {
    const begun = await store.beginTalkCollectionCycle(s, r, 100);
    return {
      ...begun,
      state: { ...begun.state, cursor: { ...begun.state.cursor, status: "exhausted" } },
      changedRecords: 1,
      revisions: 1,
    };
  });
});
it("uses only account-bound GET exports with redirects forbidden", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"count":0}'));
  const reader = createTalkExportReader(credentials, scope.accountReference, request);
  await reader(url, new AbortController().signal);
  expect(request.mock.calls[0]?.[1]).toMatchObject({ method: "GET", redirect: "error" });
  for (const invalid of [
    url.replace("synthetic.zendesk", "other.zendesk"),
    url.replace("calls.json", "tickets.json"),
    `${url}&token=secret`,
    `${url}#fragment`,
  ])
    await expect(reader(invalid, new AbortController().signal)).rejects.toThrow("allowlist");
  expect(request).toHaveBeenCalledTimes(1);
});
it("persists rate limiting without committing or retrying the rejected page", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response("", { status: 429, headers: { "retry-after": "120" } }));
  const result = await runTalkCollectionBatch(
    scope,
    100,
    createTalkExportReader(credentials, scope.accountReference, request)
  );
  expect(result).toMatchObject({ status: "rate_limited", pages: 0, waitMs: 120000 });
  expect(store.deferTalkRequests).toHaveBeenCalledWith(expect.anything(), 120000);
  expect(store.commitTalkCollectionPage).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(1);
  expect(store.releaseTalkCollection).toHaveBeenCalledTimes(1);
});
it("alternates streams and reports export exhaustion without claiming metric coverage", async () => {
  const read = vi.fn().mockResolvedValue({ rateLimited: false, page: {} });
  const result = await runTalkCollectionBatch(scope, 100, read);
  expect(result).toMatchObject({
    status: "collected",
    pages: 2,
    callsExhausted: true,
    legsExhausted: true,
    joinedMetricCoverageCertified: false,
  });
  expect(vi.mocked(store.commitTalkCollectionPage).mock.calls.map((c) => c[1])).toEqual([
    "calls",
    "legs",
  ]);
});
it("performs no fetch for busy or deferred workers and releases a failed worker", async () => {
  const read = vi.fn();
  vi.mocked(store.claimTalkCollection).mockResolvedValueOnce({ acquired: false, retryAt: "later" });
  expect(await runTalkCollectionBatch(scope, 100, read)).toMatchObject({
    status: "busy",
    pages: 0,
  });
  vi.mocked(store.reserveTalkRequest).mockResolvedValueOnce({ reserved: false, waitMs: 60000 });
  expect(await runTalkCollectionBatch(scope, 100, read)).toMatchObject({
    status: "waiting",
    pages: 0,
  });
  expect(read).not.toHaveBeenCalled();
  read.mockRejectedValueOnce(Error("fetch failed"));
  await expect(runTalkCollectionBatch(scope, 100, read)).rejects.toThrow("fetch failed");
  expect(store.releaseTalkCollection).toHaveBeenCalledTimes(2);
});

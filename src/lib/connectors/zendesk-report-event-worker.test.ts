// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { createReportEventReader, runReportEventBatch } from "./zendesk-report-event-worker";
import { initialReportEventCursor } from "./zendesk-report-event-cursor";
import * as store from "./zendesk-report-event-store";
vi.mock("./zendesk-report-event-store", () => ({
  REPORT_EVENT_SPACING_MS: 20000,
  beginReportEventCycle: vi.fn(),
  claimReportEventCollection: vi.fn(),
  commitReportEventPage: vi.fn(),
  deferReportEventRequests: vi.fn(),
  releaseReportEventCollection: vi.fn(),
  reserveReportEventRequest: vi.fn(),
}));
const scope = {
  organizationId: "org",
  dataSourceId: "source",
  accountReference: "zendesk-account:synthetic",
};
const credentials = {
  subdomain: "synthetic",
  email: "synthetic@example.invalid",
  apiKey: "synthetic-token",
};
const state = {
  version: 1 as const,
  cycle: 1,
  observationStartedAt: "2026-10-04T00:00:00.000Z",
  lastPageAt: null,
  cursor: initialReportEventCursor(scope.accountReference, 100),
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(store.claimReportEventCollection).mockResolvedValue({
    acquired: true,
    token: "00000000-0000-4000-8000-000000000001",
    expiresAt: "expiry",
    nextAllowedAt: "now",
  });
  vi.mocked(store.reserveReportEventRequest).mockResolvedValue({ reserved: true, waitMs: 0 });
  vi.mocked(store.beginReportEventCycle).mockResolvedValue({ state, expectedHash: "initial" });
  vi.mocked(store.commitReportEventPage).mockResolvedValue({
    state: {
      ...state,
      lastPageAt: state.observationStartedAt,
      cursor: { ...state.cursor, status: "exhausted" },
    },
    expectedHash: "done",
    newEvents: 1,
  });
});
it("permits only the bound GET endpoint and suppresses credential-bearing transport errors", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}"));
  const read = createReportEventReader(credentials, scope.accountReference, request);
  await read(state.cursor.path, new AbortController().signal);
  expect(request.mock.calls[0]?.[1]).toMatchObject({ method: "GET", redirect: "error" });
  for (const url of [
    state.cursor.path.replace("synthetic.zendesk", "other.zendesk"),
    state.cursor.path + "&include=comments",
    state.cursor.path.replace("ticket_events.json", "tickets.json"),
  ])
    await expect(read(url, new AbortController().signal)).rejects.toThrow("allowlist");
  expect(request).toHaveBeenCalledTimes(1);
  request.mockRejectedValueOnce(Error("private credential in transport error"));
  await expect(read(state.cursor.path, new AbortController().signal)).rejects.toThrow(
    /^Report event request failed$/
  );
});
it("commits an exhausted stream without claiming joined coverage or metric publication", async () => {
  const read = vi.fn().mockResolvedValue({ rateLimited: false, page: {} });
  expect(await runReportEventBatch(scope, 100, read)).toMatchObject({
    status: "collected",
    pages: 1,
    newEvents: 1,
    streamExhausted: true,
    joinedMetricCoverageCertified: false,
  });
  expect(read).toHaveBeenCalledTimes(1);
  expect(store.releaseReportEventCollection).toHaveBeenCalledTimes(1);
});
it("persists Retry-After without advancing the rejected page", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response("", { status: 429, headers: { "retry-after": "120" } }));
  expect(
    await runReportEventBatch(
      scope,
      100,
      createReportEventReader(credentials, scope.accountReference, request)
    )
  ).toMatchObject({ status: "rate_limited", pages: 0, waitMs: 120000 });
  expect(store.deferReportEventRequests).toHaveBeenCalledWith(expect.anything(), 120000);
  expect(store.commitReportEventPage).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(1);
});
it("backs off at least one minute and exposes only numeric quota diagnostics", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(
    new Response("private source response", {
      status: 429,
      headers: {
        "retry-after": "4",
        "ratelimit-remaining": "0",
        "ratelimit-limit": "700",
        "ratelimit-reset": "42",
        "set-cookie": "private-cookie",
        "x-request-id": "private-request",
      },
    })
  );
  const result = await runReportEventBatch(
    scope,
    100,
    createReportEventReader(credentials, scope.accountReference, request)
  );
  expect(result).toEqual({
    status: "rate_limited",
    pages: 0,
    newEvents: 0,
    waitMs: 60000,
    sourceRetryAfterMs: 4000,
    quota: { remaining: 0, resetSeconds: 42, limit: 700 },
  });
  expect(store.deferReportEventRequests).toHaveBeenCalledWith(expect.anything(), 60000);
  expect(store.commitReportEventPage).not.toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toContain("private");
});
it("persists depleted account quota before retaining the successful page", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response("{}", { headers: { "ratelimit-remaining": "1", "ratelimit-reset": "90" } })
    );
  await runReportEventBatch(
    scope,
    100,
    createReportEventReader(credentials, scope.accountReference, request)
  );
  expect(store.commitReportEventPage).toHaveBeenCalledTimes(1);
  expect(store.deferReportEventRequests).toHaveBeenCalledWith(expect.anything(), 91000);
  expect(vi.mocked(store.deferReportEventRequests).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(store.commitReportEventPage).mock.invocationCallOrder[0]!
  );
});
it("handles quota header aliases and missing reset times without exposing malformed values", async () => {
  const request = vi.fn<typeof fetch>();
  const read = createReportEventReader(credentials, scope.accountReference, request);
  request.mockResolvedValueOnce(
    new Response("{}", { headers: { "x-rate-limit-remaining": "0", "ratelimit-reset": "private" } })
  );
  expect(await read(state.cursor.path, new AbortController().signal)).toMatchObject({
    rateLimited: false,
    quotaDelayMs: 60000,
  });
  request.mockResolvedValueOnce(
    new Response("", {
      status: 429,
      headers: { "retry-after": "120", "ratelimit-limit": "private" },
    })
  );
  expect(await read(state.cursor.path, new AbortController().signal)).toMatchObject({
    rateLimited: true,
    retryAfterMs: 120000,
    quota: { limit: null },
  });
});
it("still persists throttle deferral if disposing of the response body fails", async () => {
  const response = new Response("private", { status: 429, headers: { "retry-after": "4" } });
  vi.spyOn(response.body!, "cancel").mockRejectedValue(Error("private transport failure"));
  const request = vi.fn<typeof fetch>().mockResolvedValue(response);
  expect(
    await runReportEventBatch(
      scope,
      100,
      createReportEventReader(credentials, scope.accountReference, request)
    )
  ).toMatchObject({ status: "rate_limited", waitMs: 60000 });
  expect(store.deferReportEventRequests).toHaveBeenCalledWith(expect.anything(), 60000);
  expect(store.commitReportEventPage).not.toHaveBeenCalled();
});
it("does not advance the cursor if a known quota deferral cannot be persisted", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response("{}", { headers: { "ratelimit-remaining": "0", "ratelimit-reset": "90" } })
    );
  vi.mocked(store.deferReportEventRequests).mockRejectedValueOnce(Error("lease lost"));
  await expect(
    runReportEventBatch(
      scope,
      100,
      createReportEventReader(credentials, scope.accountReference, request)
    )
  ).rejects.toThrow("lease lost");
  expect(store.commitReportEventPage).not.toHaveBeenCalled();
});
it("does no source work when busy or deferred and releases after failure", async () => {
  const read = vi.fn();
  vi.mocked(store.claimReportEventCollection).mockResolvedValueOnce({
    acquired: false,
    retryAt: "later",
  });
  expect(await runReportEventBatch(scope, 100, read)).toMatchObject({ status: "busy", pages: 0 });
  vi.mocked(store.reserveReportEventRequest).mockResolvedValueOnce({
    reserved: false,
    waitMs: 60000,
  });
  expect(await runReportEventBatch(scope, 100, read)).toMatchObject({
    status: "waiting",
    pages: 0,
  });
  expect(read).not.toHaveBeenCalled();
  read.mockRejectedValueOnce(Error("source unavailable"));
  await expect(runReportEventBatch(scope, 100, read)).rejects.toThrow("source unavailable");
  expect(store.releaseReportEventCollection).toHaveBeenCalledTimes(2);
});
it("stops at the page budget with the last committed continuation", async () => {
  const second = {
    ...state,
    lastPageAt: state.observationStartedAt,
    cursor: {
      ...state.cursor,
      path: state.cursor.path.replace("100", "200"),
      watermark: 200,
      pages: 1,
    },
  };
  vi.mocked(store.commitReportEventPage)
    .mockResolvedValueOnce({ state: second, expectedHash: "page1", newEvents: 1 })
    .mockResolvedValueOnce({
      state: { ...second, cursor: { ...second.cursor, pages: 2 } },
      expectedHash: "page2",
      newEvents: 0,
    });
  const read = vi.fn().mockResolvedValue({ rateLimited: false, page: {} });
  expect(await runReportEventBatch(scope, 100, read, { maxPages: 2 })).toMatchObject({
    status: "collected",
    pages: 2,
    newEvents: 1,
    streamExhausted: false,
  });
  expect(read.mock.calls.map((c) => c[0])).toEqual([state.cursor.path, second.cursor.path]);
  expect(vi.mocked(store.commitReportEventPage).mock.calls.map((c) => c[1])).toEqual([
    "initial",
    "page1",
  ]);
});
it("rejects unsafe budgets before acquiring a lease", async () => {
  for (const options of [
    { maxPages: 21 },
    { maxPages: 0 },
    { maxDurationMs: 300000 },
    { maxDurationMs: 1 },
  ])
    await expect(runReportEventBatch(scope, 100, vi.fn(), options)).rejects.toThrow("budget");
  expect(store.claimReportEventCollection).not.toHaveBeenCalled();
});

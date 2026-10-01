// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { createBoundedCsatReader } from "./zendesk-csat-reader";
import { sourceFailureDiagnostics } from "./source-fetch-error";

const clock = vi.hoisted(() => ({ now: 0, waits: [] as number[], extraDelay: 0 }));
vi.mock("node:timers/promises", () => ({
  setTimeout: async (ms: number) => {
    clock.waits.push(ms);
    clock.now += ms + clock.extraDelay;
  },
}));
beforeEach(() => {
  clock.now = 0;
  clock.waits = [];
  clock.extraDelay = 0;
});
const credentials = { subdomain: "synthetic", email: "fixture@example.test", apiKey: "fixture" };
const limited = (header: string | null) =>
  new Response("private source body", {
    status: 429,
    headers: header === null ? {} : { "Retry-After": header },
  });
function setup(responses: Response[], options: Parameters<typeof createBoundedCsatReader>[1] = {}) {
  const fetcher = vi.fn<typeof fetch>(async () => {
    const response = responses.shift();
    if (!response) throw new Error("Unexpected extra request");
    return response;
  });
  return {
    fetcher,
    reader: createBoundedCsatReader(credentials, {
      fetch: fetcher,
      now: () => clock.now,
      spacingMs: 0,
      elapsedMs: 120_000,
      maxRateLimitRetries: 1,
      ...options,
    }),
  };
}

it("honors Retry-After and repeats only the same allowlisted GET, retaining budgets", async () => {
  const { fetcher, reader } = setup([limited("1"), Response.json({ tickets: [] })]);
  await expect(reader.read("/search/export.json?query=type:ticket")).resolves.toEqual({
    tickets: [],
  });
  expect(clock.waits).toEqual([1000]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1]![0].toString()).toBe(fetcher.mock.calls[0]![0].toString());
  expect(fetcher.mock.calls[1]![1]).toMatchObject({ method: "GET", redirect: "error" });
  expect(reader.stats()).toMatchObject({ requests: 2, rateLimitRetries: 1, backoffWaitMs: 1000 });
});

it("allows only one retry across all endpoints and pages, not one retry per request", async () => {
  const { fetcher, reader } = setup([limited("1"), Response.json({ users: [] }), limited("1")]);
  await reader.read("/users.json");
  await expect(reader.read("/search/export.json")).rejects.toThrow(/HTTP 429/);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(clock.waits).toEqual([1000]);
});

it("uses HTTP-date delays without exposing headers, query identifiers or response bodies", async () => {
  clock.now = Date.parse("2026-09-28T08:34:00Z");
  const { reader } = setup([limited("Mon, 28 Sep 2026 08:34:01 GMT"), limited("1")]);
  await expect(
    reader.read("/search/export.json?query=assignee:private@example.test")
  ).rejects.toThrow(
    "CSAT source request failed: HTTP 429; endpoint=search/export; retryAfterMs=1000"
  );
  expect(clock.waits).toEqual([1000]);
});

it.each([null, "unknown-private-header", "61", "99999999999999999999999"])(
  "does not guess or shorten an unknown/excessive vendor delay: %s",
  async (header) => {
    const { fetcher, reader } = setup([limited(header)]);
    await expect(reader.read("/users.json")).rejects.toThrow(/HTTP 429/);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(clock.waits).toEqual([]);
  }
);

it.each([{ requestBudget: 1 }, { elapsedMs: 31_000 }, { maxRateLimitRetries: 0 as const }])(
  "does not retry without request/time allowance or explicit opt-in: %j",
  async (options) => {
    const { fetcher, reader } = setup([limited("1")], options);
    await expect(reader.read("/users.json")).rejects.toThrow(/HTTP 429/);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(clock.waits).toEqual([]);
  }
);

it("includes the retry in the collection-wide request limit", async () => {
  const { fetcher, reader } = setup([limited("0"), Response.json({})], { requestBudget: 2 });
  await reader.read("/users.json");
  await expect(reader.read("/users.json")).rejects.toThrow(/request budget/);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("never issues a retry after an unexpectedly delayed wait exhausts the deadline", async () => {
  clock.extraDelay = 120_000;
  const { fetcher, reader } = setup([limited("1")]);
  await expect(reader.read("/users.json")).rejects.toThrow(/elapsed-time budget/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("retains pacing when the vendor allows an immediate retry", async () => {
  const { reader } = setup([limited("0"), Response.json({})], { spacingMs: 650 });
  await reader.read("/users.json");
  expect(clock.waits).toEqual([650]);
});

it("does not retry other HTTP failures", async () => {
  const { fetcher, reader } = setup([
    new Response(null, { status: 503, headers: { "Retry-After": "1" } }),
  ]);
  await expect(reader.read("/users.json")).rejects.toThrow(/HTTP 503/);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(clock.waits).toEqual([]);
});

it("retains the precise retry stop reason without private request data", async () => {
  const { reader } = setup([limited("9"), Response.json({ users: [] }), limited("9")]);
  await reader.read("/users.json");
  const failure = await reader
    .read("/tickets/show_many.json?ids=123")
    .catch((error: unknown) => error);
  const diagnostics = sourceFailureDiagnostics(failure);
  expect(diagnostics).toMatchObject({
    family: "csat",
    endpoint: "tickets/show_many",
    requests: 3,
    rateLimitRetries: 1,
    backoffWaitMs: 9000,
    httpStatus: 429,
    retryAfterMs: 9000,
    retryStoppedBy: "retry_allowance",
  });
  expect(JSON.stringify(diagnostics)).not.toMatch(/123|private|fixture/);
});

it("distinguishes insufficient time from a consumed retry allowance", async () => {
  const { reader } = setup([limited("9")], { elapsedMs: 38_000 });
  const failure = await reader.read("/users.json").catch((error: unknown) => error);
  expect(sourceFailureDiagnostics(failure)).toMatchObject({
    rateLimitRetries: 0,
    retryStoppedBy: "time_budget",
  });
});

const quotaResponse = (remaining: string, reset: string | null) =>
  Response.json(
    {},
    {
      headers: {
        "ratelimit-limit": "700",
        "ratelimit-remaining": remaining,
        ...(reset === null ? {} : { "ratelimit-reset": reset }),
      },
    }
  );

it("waits for the shared account quota before crossing into another endpoint", async () => {
  const { reader, fetcher } = setup([quotaResponse("0", "9"), Response.json({})]);
  await reader.read("/users.json");
  await reader.read("/tickets/show_many.json?ids=123");
  expect(clock.waits).toEqual([10000]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(reader.stats()).toMatchObject({ quotaWaitMs: 10000, rateLimitRetries: 0 });
});

it("does not borrow publication time to wait for quota or issue another request", async () => {
  const { reader, fetcher } = setup([quotaResponse("0", "9")], { elapsedMs: 39000 });
  await reader.read("/users.json");
  const error = await reader.read("/tickets/show_many.json?ids=123").catch((error) => error);
  expect(sourceFailureDiagnostics(error)).toMatchObject({
    accountLimit: 700,
    accountRemaining: 0,
    retryStoppedBy: "quota_budget",
    requests: 1,
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(clock.waits).toEqual([]);
});

it("respects the longer account reset when Retry-After is shorter", async () => {
  const response = limited("1");
  response.headers.set("ratelimit-limit", "700");
  response.headers.set("ratelimit-remaining", "0");
  response.headers.set("ratelimit-reset", "9");
  const { reader } = setup([response, Response.json({})]);
  await reader.read("/users.json");
  expect(clock.waits).toEqual([10000]);
  expect(reader.stats()).toMatchObject({ backoffWaitMs: 10000, rateLimitRetries: 1 });
});

it.each([
  ["private", "1"],
  ["999999999999999999999", "1"],
  ["701", "1"],
])("ignores malformed quota without exposing its text (%s)", async (remaining, reset) => {
  const { reader } = setup([quotaResponse(remaining, reset), Response.json({})]);
  await reader.read("/users.json");
  await reader.read("/users.json");
  expect(clock.waits).toEqual([]);
  expect(JSON.stringify(reader.stats())).not.toContain("private");
});

it("fails closed when a known empty account quota has no usable reset", async () => {
  const { reader, fetcher } = setup([quotaResponse("0", null)]);
  await expect(reader.read("/users.json")).rejects.toThrow("without a usable reset");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("does not wait twice when normal processing already passes the quota delay", async () => {
  const { reader } = setup([quotaResponse("3", "9"), Response.json({})]);
  await reader.read("/users.json");
  clock.now += 10000;
  await reader.read("/users.json");
  expect(clock.waits).toEqual([]);
});

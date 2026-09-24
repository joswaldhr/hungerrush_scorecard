// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env", () => ({
  env: {
    ZENDESK_SUBDOMAIN: "synthetic",
    ZENDESK_EMAIL: "agent@example.test",
    ZENDESK_API_KEY: "fixture",
  },
}));
import { zendeskGet } from "./zendesk-shared";
import { SourceRetryLaterError } from "./source-retry";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("Zendesk credential destination", () => {
  it("omits search parameters and resource IDs from persisted failure reasons", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "private response" })
    );
    await expect(
      zendeskGet("/tickets/12345/audits/67890.json?email=private@example.test")
    ).rejects.toThrow("Zendesk GET /api/v2/tickets/[id]/audits/[id].json failed: HTTP 404");
  });
  it("omits actor IDs and queries from retry logs while retaining retry diagnostics", async () => {
    vi.useFakeTimers();
    const sink = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ status: 429, headers: new Headers({ "Retry-After": "1" }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ users: [] }) })
    );
    const pending = zendeskGet("/users/show_many.json?ids=12345&email=private@example.test");
    await vi.runAllTimersAsync();
    await pending;
    expect(sink).toHaveBeenCalledOnce();
    const output = String(sink.mock.calls[0]?.[0]);
    expect(output).not.toContain("12345");
    expect(output).not.toContain("private");
    expect(JSON.parse(output).context).toMatchObject({
      path: "/api/v2/users/show_many.json",
      retryAfter: 1,
      attempt: 0,
    });
  });
  it("defers a rate-limited resumable page without sleeping or issuing another request", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ status: 429, headers: new Headers({ "Retry-After": "46" }) });
    vi.stubGlobal("fetch", fetch);
    await expect(
      zendeskGet("/incremental/ticket_events.json", undefined, { deferRateLimit: true })
    ).rejects.toMatchObject({ name: SourceRetryLaterError.name, retryAfterMs: 46000 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    "https://outside.example/api/v2/tickets.json",
    "http://synthetic.zendesk.com/api/v2/tickets.json",
    "https://synthetic.zendesk.com/not-api",
    "https://user:password@synthetic.zendesk.com/api/v2/tickets.json",
    "https://synthetic.zendesk.com/api/v2/../../not-api",
  ])("rejects unsafe pagination URL %s before sending a request", async (url) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(zendeskGet(url)).rejects.toThrow("outside the configured API");
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["/tickets.json", "https://synthetic.zendesk.com/api/v2/tickets.json?page=2"])(
    "allows configured API paths and forbids redirects: %s",
    async (url) => {
      const fetch = vi
        .fn()
        .mockResolvedValue({ ok: true, status: 200, json: async () => ({ tickets: [] }) });
      vi.stubGlobal("fetch", fetch);
      expect(await zendeskGet(url)).toEqual({ tickets: [] });
      expect(fetch.mock.calls[0]![1]).toMatchObject({ redirect: "error" });
    }
  );
});

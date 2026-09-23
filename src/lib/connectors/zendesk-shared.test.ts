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
afterEach(() => vi.unstubAllGlobals());
describe("Zendesk credential destination", () => {
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

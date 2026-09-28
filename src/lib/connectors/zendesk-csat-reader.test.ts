// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createBoundedCsatReader } from "./zendesk-csat-reader";
const credentials = {
  subdomain: "synthetic",
  email: "synthetic@example.test",
  apiKey: "fixture-secret",
};
it("confines authenticated requests to the configured account and selected read endpoints", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ complete: true }));
  const reader = createBoundedCsatReader(credentials, { fetch: fetcher, spacingMs: 0 });
  for (const path of [
    "https://other.zendesk.com/api/v2/users.json",
    "https://user:password@synthetic.zendesk.com/api/v2/users.json",
    "/users/1.json",
    "/users.json#fragment",
  ])
    await expect(reader.read(path)).rejects.toThrow(/allowlist/);
  expect(fetcher).not.toHaveBeenCalled();
  await expect(reader.read("/users.json")).resolves.toEqual({ complete: true });
  expect(fetcher.mock.calls[0]![1]).toMatchObject({ method: "GET", redirect: "error" });
});
it("bounds all collection requests and elapsed time without hidden retries", async () => {
  let now = 0;
  const fetcher = vi.fn(async () => Response.json({}));
  const reader = createBoundedCsatReader(credentials, {
    fetch: fetcher,
    now: () => now,
    requestBudget: 1,
    elapsedMs: 1000,
    spacingMs: 0,
  });
  await reader.read("/users.json");
  await expect(reader.read("/users.json")).rejects.toThrow(/request budget/);
  now = 1001;
  await expect(reader.read("/users.json")).rejects.toThrow(/elapsed-time/);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const limited = vi.fn(async () => new Response(null, { status: 429 }));
  await expect(
    createBoundedCsatReader(credentials, { fetch: limited }).read("/users.json")
  ).rejects.toThrow(/HTTP 429/);
  expect(limited).toHaveBeenCalledTimes(1);
});

it.each([
  ["60", "60000"],
  ["0", "0"],
  ["Mon, 28 Sep 2026 08:35:00 GMT", "60000"],
  [null, "unavailable"],
  ["private-untrusted-header", "unavailable"],
  ["99999999999999999999999999", "unavailable"],
  ["Mon, 28 Sep 2026 08:33:00 GMT", "unavailable"],
])(
  "retains safe 429 endpoint/delay diagnostics without another request (%s)",
  async (header, expected) => {
    const fetcher = vi.fn(
      async () =>
        new Response("private-response-body", {
          status: 429,
          headers: header === null ? {} : { "Retry-After": header },
        })
    );
    const reader = createBoundedCsatReader(credentials, {
      fetch: fetcher,
      now: () => Date.parse("2026-09-28T08:34:00Z"),
      spacingMs: 0,
    });
    const error = await reader
      .read("/search/export.json?query=assignee:private@example.invalid")
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      `CSAT source request failed: HTTP 429; endpoint=search/export; retryAfterMs=${expected}`
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(reader.stats().requests).toBe(1);
  }
);

it("identifies a non-rate-limit failure without leaking its request or response", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response("private-response-body", { status: 503, headers: { "Retry-After": "60" } })
  );
  await expect(
    createBoundedCsatReader(credentials, { fetch: fetcher }).read(
      "/tickets/show_many.json?ids=123&include=metric_sets"
    )
  ).rejects.toThrow("CSAT source request failed: HTTP 503; endpoint=tickets/show_many");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

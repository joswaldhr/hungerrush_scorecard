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

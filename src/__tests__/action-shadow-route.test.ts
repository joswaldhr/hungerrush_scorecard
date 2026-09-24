// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  next: vi.fn(),
  run: vi.fn(),
  claim: vi.fn(),
  release: vi.fn(),
  env: {
    CRON_SECRET: "fixture",
    ACTION_SHADOW_SOURCE_ID: undefined as string | undefined,
    ZENDESK_SUBDOMAIN: "synthetic",
    ZENDESK_EMAIL: "fixture@example.test",
    ZENDESK_API_KEY: "fixture",
  },
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@/lib/connectors/action-shadow-lease", () => ({
  claimActionShadowLease: mocks.claim,
  releaseActionShadowLease: mocks.release,
}));
vi.mock("@/lib/db", () => ({ db: { select: mocks.select } }));
vi.mock("@/lib/connectors/action-shadow-worker", () => ({
  nextActionShadowScope: mocks.next,
  runActionShadowBatch: mocks.run,
}));
import { GET } from "@/app/api/cron/action-shadow/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.ACTION_SHADOW_SOURCE_ID = undefined;
  mocks.claim.mockResolvedValue({ acquired: true, token: "fixture-token" });
  mocks.release.mockResolvedValue(undefined);
});
const request = (token = "fixture") =>
  new Request("https://test.invalid/api/cron/action-shadow", {
    headers: { authorization: `Bearer ${token}` },
  });
it("rejects unauthorized triggers before database access", async () => {
  expect((await GET(request("wrong"))).status).toBe(401);
  expect(mocks.select).not.toHaveBeenCalled();
});
it("does no work without an explicit source opt-in", async () => {
  expect(await (await GET(request())).json()).toEqual({ enabled: false });
  expect(mocks.select).not.toHaveBeenCalled();
});
it("uses only the configured source's organization and a bounded worker", async () => {
  mocks.env.ACTION_SHADOW_SOURCE_ID = "source";
  mocks.select.mockReturnValue({
    from: () => ({ where: async () => [{ id: "source", organizationId: "org", type: "zendesk" }] }),
  });
  mocks.next.mockResolvedValue({ dataSourceId: "source", organizationId: "org" });
  mocks.run.mockResolvedValue({ completed: false, steps: 6 });
  expect(await (await GET(request())).json()).toMatchObject({
    enabled: true,
    completed: false,
    steps: 6,
  });
  expect(mocks.next).toHaveBeenCalledWith("org", "source");
  expect(mocks.release).toHaveBeenCalledWith("source", "fixture-token");
});

it("does not start vendor work when another invocation owns the lease", async () => {
  mocks.env.ACTION_SHADOW_SOURCE_ID = "source";
  mocks.select.mockReturnValue({
    from: () => ({ where: async () => [{ id: "source", organizationId: "org", type: "zendesk" }] }),
  });
  mocks.claim.mockResolvedValue({ acquired: false, retryAt: "2026-09-24T14:00:00.000Z" });
  expect(await (await GET(request())).json()).toMatchObject({ busy: true });
  expect(mocks.next).not.toHaveBeenCalled();
  expect(mocks.run).not.toHaveBeenCalled();
  expect(mocks.release).not.toHaveBeenCalled();
});

it("releases the lease after worker failure", async () => {
  mocks.env.ACTION_SHADOW_SOURCE_ID = "source";
  mocks.select.mockReturnValue({
    from: () => ({ where: async () => [{ id: "source", organizationId: "org", type: "zendesk" }] }),
  });
  mocks.run.mockRejectedValue(new Error("Synthetic worker failure"));
  expect((await GET(request())).status).toBe(503);
  expect(mocks.release).toHaveBeenCalledWith("source", "fixture-token");
});

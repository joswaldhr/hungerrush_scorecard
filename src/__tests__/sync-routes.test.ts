import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  limited: vi.fn(),
  fetch: vi.fn(),
  sources: [] as unknown[],
}));
vi.mock("@/lib/db", () => ({
  db: { select: () => ({ from: () => ({ where: async () => mocks.sources }) }) },
}));
vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { email: "manager@test.invalid" } }) }));
vi.mock("@/lib/auth/authorization", () => ({
  getEffectiveManagerContext: async () => ({ ctx: { organizationId: "org" } }),
}));
vi.mock("@/lib/connectors", () => ({
  runSync: mocks.run,
  ZendeskConnector: class {},
  MAX_WEEKS_BACK: 4,
}));
vi.mock("@/lib/rate-limit", () => ({ isSyncRateLimited: mocks.limited }));
vi.mock("@/lib/env", () => ({
  env: { CRON_SECRET: "test", SYNC_HEARTBEAT_URL: "https://heartbeat.test.invalid" },
}));
import { GET } from "@/app/api/cron/sync/route";
import { POST } from "@/app/api/sync/run/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.sources = [{ id: "source", organizationId: "org", status: "configured", type: "zendesk" }];
  mocks.limited.mockResolvedValue(false);
  mocks.run.mockResolvedValue({ success: false, syncRunId: "run", valuesWritten: 0 });
  mocks.fetch.mockResolvedValue(new Response());
  vi.stubGlobal("fetch", mocks.fetch);
});
const cron = () =>
  GET(
    new Request("https://cadence.test/api/cron/sync?week=1", {
      headers: { authorization: "Bearer test" },
    })
  );
describe("sync API failure reporting", () => {
  it.each(["disabled", "retired", "unknown"])(
    "refuses %s sources in cron and manual triggers",
    async (status) => {
      mocks.sources = [{ id: "source", organizationId: "org", type: "zendesk", status }];
      expect((await cron()).status).toBe(503);
      expect(
        (await POST(new Request("https://cadence.test/api/sync/run", { method: "POST" }))).status
      ).toBe(503);
      expect(mocks.run).not.toHaveBeenCalled();
      expect(mocks.limited).not.toHaveBeenCalled();
      expect(mocks.fetch).not.toHaveBeenCalled();
    }
  );
  it.each([
    JSON.stringify({ dataSourceType: "assembled" }),
    JSON.stringify({ dataSourceType: "entra" }),
    "{broken",
    JSON.stringify({ dataSourceId: "unselected-source" }),
  ])("rejects unsupported or malformed manual requests without syncing (%s)", async (body) => {
    const response = await POST(
      new Request("https://cadence.test/api/sync/run", { method: "POST", body })
    );
    expect(response.status).toBe(400);
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.limited).not.toHaveBeenCalled();
  });
  it("accepts the explicit supported source type", async () => {
    mocks.run.mockResolvedValue({ success: true, valuesWritten: 1 });
    const response = await POST(
      new Request("https://cadence.test/api/sync/run", {
        method: "POST",
        body: JSON.stringify({ dataSourceType: "zendesk" }),
      })
    );
    expect(response.status).toBe(200);
    expect(mocks.run).toHaveBeenCalledOnce();
  });
  it("returns a non-success status for manual source failures", async () => {
    const response = await POST(
      new Request("https://cadence.test/api/sync/run", { method: "POST" })
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ success: false, valuesWritten: 0 });
  });
  it("does not send a healthy heartbeat for a failed cron sync", async () => {
    expect((await cron()).status).toBe(503);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("does not send a healthy heartbeat if every source was skipped", async () => {
    mocks.limited.mockResolvedValue(true);
    expect((await cron()).status).toBe(503);
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("reports success and pings only after successful publication", async () => {
    mocks.run.mockResolvedValue({ success: true, syncRunId: "run", valuesWritten: 4 });
    expect((await cron()).status).toBe(200);
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });
  it("does not report a configured healthy source when none exist", async () => {
    mocks.sources = [];
    expect((await cron()).status).toBe(503);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

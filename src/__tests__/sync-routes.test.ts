import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  limited: vi.fn(),
  fetch: vi.fn(),
  roster: vi.fn(),
  enqueue: vi.fn(),
  sources: [] as unknown[],
  env: {
    CRON_SECRET: "test",
    SYNC_HEARTBEAT_URL: "https://heartbeat.test.invalid",
    ROSTER_DISCOVERY_SOURCE_ID: undefined as string | undefined,
    ZENDESK_LEGACY_SYNC_RECOVERY: undefined as string | undefined,
    ZENDESK_REPORT_RECOVERY: undefined as string | undefined,
    ZENDESK_SUBDOMAIN: "synthetic",
    ZENDESK_REPORT_EVENT_COLLECTION_POLICY: undefined as string | undefined,
  },
}));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () =>
          Object.assign(Promise.resolve(mocks.sources), { limit: async () => [{ id: "mapping" }] }),
      }),
    }),
  },
}));
vi.mock("@/lib/domain/roster/reconcile", () => ({ discoverRosterCandidates: mocks.roster }));
vi.mock("@/lib/connectors/zendesk-report-jobs", () => ({ requestReportJobs: mocks.enqueue }));
vi.mock("@/lib/connectors/zendesk-solved-config", async (original) => ({
  ...(await original<object>()),
  configuredSolvedReportReleases: () => [{ kind: "updater" }],
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
  env: mocks.env,
}));
import { GET } from "@/app/api/cron/sync/route";
import { POST } from "@/app/api/sync/run/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.ROSTER_DISCOVERY_SOURCE_ID = undefined;
  mocks.env.ZENDESK_LEGACY_SYNC_RECOVERY = undefined;
  mocks.env.ZENDESK_REPORT_RECOVERY = undefined;
  mocks.env.ZENDESK_REPORT_EVENT_COLLECTION_POLICY = undefined;
  mocks.enqueue.mockReset();
  mocks.sources = [{ id: "source", organizationId: "org", status: "configured", type: "zendesk" }];
  mocks.limited.mockResolvedValue(false);
  mocks.run.mockResolvedValue({ success: false, syncRunId: "run", valuesWritten: 0 });
  mocks.fetch.mockResolvedValue(new Response());
  mocks.roster.mockResolvedValue({ newCandidates: 0, departedCandidates: 0, autoApproved: 0 });
  vi.stubGlobal("fetch", mocks.fetch);
});
const cron = (week = 1) =>
  GET(
    new Request(`https://cadence.test/api/cron/sync?week=${week}`, {
      headers: { authorization: "Bearer test" },
    })
  );
describe("sync API failure reporting", () => {
  it("persists delegated work even during cooldown without claiming publication or pinging success", async () => {
    const scope = {
      organizationId: "10000000-0000-4000-8000-000000000001",
      dataSourceId: "10000000-0000-4000-8000-000000000002",
      accountReference: "zendesk-account:synthetic",
    };
    mocks.env.ZENDESK_LEGACY_SYNC_RECOVERY = "1";
    mocks.env.ZENDESK_REPORT_RECOVERY = "1";
    mocks.env.ROSTER_DISCOVERY_SOURCE_ID = scope.dataSourceId;
    mocks.env.ZENDESK_REPORT_EVENT_COLLECTION_POLICY = JSON.stringify({
      schemaVersion: 1,
      ...scope,
      bootstrapDate: "2020-01-05",
    });
    mocks.sources = [
      {
        id: scope.dataSourceId,
        organizationId: scope.organizationId,
        type: "zendesk",
        status: "configured",
      },
    ];
    mocks.limited.mockResolvedValue(true);
    const response = await cron(1);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      completed: false,
      results: [{ delegated: true, completed: false }],
    });
    expect(mocks.enqueue).toHaveBeenCalledWith(scope, [
      expect.objectContaining({
        definition: expect.objectContaining({ kind: "legacy-sync" }),
      }),
    ]);
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.limited).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.roster).not.toHaveBeenCalled();
    mocks.enqueue.mockRejectedValueOnce(Error("Synthetic queue failure"));
    expect((await cron(1)).status).toBe(503);
    mocks.env.ZENDESK_REPORT_RECOVERY = undefined;
    expect((await cron(1)).status).toBe(503);
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it.each(["Roster conflict", ""])(
    "preserves published metric results but withholds a healthy heartbeat on roster failure (%s)",
    async (error) => {
      mocks.run.mockResolvedValue({ success: true, syncRunId: "run", valuesWritten: 4 });
      mocks.roster.mockRejectedValue(new Error(error));
      const response = await cron(0);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        success: false,
        results: [
          {
            sync: { success: true, syncRunId: "run" },
            valuesWritten: 4,
            roster: null,
            rosterError: error || "Unknown roster error",
          },
        ],
      });
      expect(mocks.fetch).not.toHaveBeenCalled();
    }
  );
  it("requires successful roster discovery on the current-week leg", async () => {
    mocks.run.mockResolvedValue({ success: true, syncRunId: "run", valuesWritten: 4 });
    expect((await cron(0)).status).toBe(200);
    expect(mocks.roster).toHaveBeenCalledOnce();
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });
  it("decouples roster discovery only for the explicitly selected independent source", async () => {
    mocks.run.mockResolvedValue({ success: true, syncRunId: "run", valuesWritten: 4 });
    mocks.env.ROSTER_DISCOVERY_SOURCE_ID = "source";
    expect((await cron(0)).status).toBe(200);
    expect(mocks.roster).not.toHaveBeenCalled();
    mocks.env.ROSTER_DISCOVERY_SOURCE_ID = "different-source";
    expect((await cron(0)).status).toBe(200);
    expect(mocks.roster).toHaveBeenCalledOnce();
  });
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

import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  health: vi.fn(),
  recovery: vi.fn(),
  recoveryHealth: vi.fn(),
  plan: vi.fn(),
  requestJobs: vi.fn(),
  env: {
    CRON_SECRET: "synthetic-secret",
    ROSTER_DISCOVERY_SOURCE_ID: "",
    ZENDESK_SUBDOMAIN: "synthetic",
    ZENDESK_EMAIL: "synthetic@example.invalid",
    ZENDESK_API_KEY: "synthetic",
  },
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@/lib/connectors/zendesk", () => ({ ZendeskConnector: class {} }));
vi.mock("@/lib/domain/roster/discovery-job", () => ({
  runRosterDiscoveryJob: mocks.run,
  getRosterDiscoveryHealth: mocks.health,
}));
vi.mock("@/lib/connectors/zendesk-roster-recovery", () => ({
  configuredRosterRecovery: mocks.recovery,
  getRosterRecoveryHealth: mocks.recoveryHealth,
  planRosterRecovery: mocks.plan,
}));
vi.mock("@/lib/connectors/zendesk-report-jobs", () => ({ requestReportJobs: mocks.requestJobs }));
import { GET } from "./route";
const request = (query = "", auth = true) =>
  new Request(`https://synthetic.invalid/api/cron/roster${query}`, {
    headers: auth ? { authorization: "Bearer synthetic-secret" } : {},
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.ROSTER_DISCOVERY_SOURCE_ID = "";
});
it("requires authentication even when disabled", async () => {
  expect((await GET(request("", false))).status).toBe(401);
  expect(mocks.run).not.toHaveBeenCalled();
});
it("is inert without the explicit source opt-in", async () => {
  expect(await (await GET(request())).json()).toEqual({ enabled: false });
  expect(mocks.run).not.toHaveBeenCalled();
  expect(mocks.health).not.toHaveBeenCalled();
});
it("keeps auth and health probes separate from discovery", async () => {
  mocks.env.ROSTER_DISCOVERY_SOURCE_ID = "synthetic-source";
  mocks.health.mockResolvedValue({ status: "completed" });
  expect(await (await GET(request("?probe=auth"))).json()).toMatchObject({
    discoveryRequested: false,
  });
  expect(await (await GET(request("?probe=health"))).json()).toMatchObject({
    discoveryRequested: false,
  });
  expect(mocks.run).not.toHaveBeenCalled();
  expect(mocks.requestJobs).not.toHaveBeenCalled();
});
it("does not disguise failed or busy discovery as success", async () => {
  mocks.env.ROSTER_DISCOVERY_SOURCE_ID = "synthetic-source";
  mocks.run.mockResolvedValue({ success: false, busy: true });
  expect((await GET(request())).status).toBe(503);
  mocks.run.mockResolvedValue({ success: true, reviewOnly: true });
  expect((await GET(request())).status).toBe(200);
});
it("rejects unknown probes before invoking the worker", async () => {
  mocks.env.ROSTER_DISCOVERY_SOURCE_ID = "synthetic-source";
  expect((await GET(request("?probe=unexpected"))).status).toBe(400);
  expect(mocks.run).not.toHaveBeenCalled();
});

it("delegates daily discovery without performing a second collection", async () => {
  mocks.env.ROSTER_DISCOVERY_SOURCE_ID = "synthetic-source";
  const scope = { dataSourceId: "synthetic-source" };
  const requests = [{ definition: { kind: "roster" }, desiredAt: "2026-10-09T16:10:00.000Z" }];
  mocks.recovery.mockReturnValue(scope);
  mocks.plan.mockReturnValue({ requests });
  const response = await GET(request());
  expect(response.status).toBe(202);
  expect(await response.json()).toMatchObject({ queued: true, completed: false, reviewOnly: true });
  expect(mocks.requestJobs).toHaveBeenCalledWith(scope, requests);
  expect(mocks.run).not.toHaveBeenCalled();
});
it("does not fall back to direct work when opted-in configuration or enqueue fails", async () => {
  mocks.env.ROSTER_DISCOVERY_SOURCE_ID = "synthetic-source";
  mocks.recovery.mockImplementation(() => {
    throw Error("Inactive dispatcher");
  });
  expect((await GET(request())).status).toBe(503);
  mocks.recovery.mockReturnValue({ dataSourceId: "synthetic-source" });
  mocks.plan.mockReturnValue({ requests: [] });
  mocks.requestJobs.mockRejectedValue(Error("Unavailable"));
  expect((await GET(request())).status).toBe(503);
  expect(mocks.run).not.toHaveBeenCalled();
});
it("reads queued roster health without enqueueing or collecting", async () => {
  mocks.env.ROSTER_DISCOVERY_SOURCE_ID = "synthetic-source";
  mocks.recoveryHealth.mockResolvedValue({ enabled: true, status: "deferred" });
  expect(await (await GET(request("?probe=health"))).json()).toMatchObject({
    recovery: { enabled: true, status: "deferred" },
  });
  expect(mocks.requestJobs).not.toHaveBeenCalled();
  expect(mocks.run).not.toHaveBeenCalled();
});

it.each([
  "?health=1",
  "?probe=health&probe=health",
  "?probe=auth&probe=health",
  "?probe=health&health=1",
  "?probe=",
  "?week=0",
])("rejects malformed diagnostics before reading health or requesting work: %s", async (query) => {
  mocks.env.ROSTER_DISCOVERY_SOURCE_ID = "synthetic-source";
  mocks.recovery.mockReturnValue({ dataSourceId: "synthetic-source" });
  mocks.plan.mockReturnValue({ requests: [{ definition: { kind: "roster" } }] });
  expect((await GET(request(query))).status).toBe(400);
  for (const action of [
    mocks.recovery,
    mocks.plan,
    mocks.requestJobs,
    mocks.run,
    mocks.health,
    mocks.recoveryHealth,
  ])
    expect(action).not.toHaveBeenCalled();
});
it("rejects unknown parameters even when the source is disabled, after authenticating", async () => {
  expect((await GET(request("?health=1", false))).status).toBe(401);
  expect((await GET(request("?health=1"))).status).toBe(400);
  expect(mocks.requestJobs).not.toHaveBeenCalled();
  expect(mocks.run).not.toHaveBeenCalled();
});

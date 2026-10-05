import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  health: vi.fn(),
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
import { GET } from "./route";
const request = (query = "", auth = true) =>
  new Request(`https://synthetic.invalid/api/cron/roster${query}`, {
    headers: auth ? { authorization: "Bearer synthetic-secret" } : {},
  });
beforeEach(() => {
  vi.clearAllMocks();
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

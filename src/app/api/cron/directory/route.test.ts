import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  config: vi.fn(),
  env: { CRON_SECRET: "synthetic", ENTRA_ROSTER_SOURCE_ID: "" },
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@/lib/domain/roster/directory-config", () => ({ directoryConfig: mocks.config }));
vi.mock("@/lib/domain/roster/directory-check", () => ({ runDirectoryCheck: mocks.run }));
import { GET } from "./route";
const request = (query = "", authorized = true) =>
  new Request(`https://synthetic.invalid/api/cron/directory${query}`, {
    headers: authorized ? { authorization: "Bearer synthetic" } : {},
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.ENTRA_ROSTER_SOURCE_ID = "";
  mocks.config.mockReturnValue({ sourceId: "synthetic" });
});
it("is authenticated and inert unless explicitly activated", async () => {
  expect((await GET(request("", false))).status).toBe(401);
  expect(await (await GET(request())).json()).toEqual({ enabled: false });
  expect(mocks.run).not.toHaveBeenCalled();
});
it("does not run a check for probes or incomplete configuration", async () => {
  mocks.env.ENTRA_ROSTER_SOURCE_ID = "synthetic";
  expect((await GET(request("?probe=unexpected"))).status).toBe(400);
  expect(await (await GET(request("?probe=auth"))).json()).toEqual({
    authenticated: true,
    checkRequested: false,
  });
  mocks.config.mockReturnValue(null);
  expect((await GET(request())).status).toBe(503);
  expect(mocks.run).not.toHaveBeenCalled();
});
it("does not return raw errors or disguise failed checks", async () => {
  mocks.env.ENTRA_ROSTER_SOURCE_ID = "synthetic";
  mocks.run.mockResolvedValue({ status: "failed" });
  expect((await GET(request())).status).toBe(503);
  mocks.run.mockRejectedValue(Error("private source content"));
  expect(await (await GET(request())).json()).toEqual({ error: "Directory check unavailable" });
});

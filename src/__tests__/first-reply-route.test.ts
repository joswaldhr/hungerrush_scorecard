// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  policy: vi.fn(),
  run: vi.fn(),
  limited: vi.fn(),
  factory: vi.fn(() => ({ sourceType: "zendesk" })),
  env: { CRON_SECRET: "synthetic-secret" as string | undefined },
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@/lib/connectors/zendesk-first-reply-config", () => ({
  configuredFirstReplyPolicy: mocks.policy,
}));
vi.mock("@/lib/connectors/zendesk-first-reply-connector", () => ({
  createFirstReplyConnector: mocks.factory,
}));
vi.mock("@/lib/connectors/sync-engine", () => ({ runSync: mocks.run }));
vi.mock("@/lib/connectors/zendesk", () => ({ MAX_WEEKS_BACK: 4 }));
vi.mock("@/lib/rate-limit", () => ({ isSyncRateLimited: mocks.limited }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { GET } from "@/app/api/cron/first-reply/route";
const policy = {
  dataSourceId: "source",
  organizationId: "org",
  effectivePeriodStart: "2026-09-20",
};
const invoke = (query = "?week=0", secret = "synthetic-secret") =>
  GET(
    new Request(`https://synthetic.test/api/cron/first-reply${query}`, {
      headers: { authorization: `Bearer ${secret}` },
    })
  );
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-25T12:00:00Z"));
  mocks.env.CRON_SECRET = "synthetic-secret";
  mocks.policy.mockReturnValue(policy);
  mocks.limited.mockResolvedValue(false);
  mocks.run.mockResolvedValue({ success: true, syncRunId: "run", valuesWritten: 3 });
});
afterEach(() => vi.useRealTimers());
it("authenticates before reading policy and requires one valid week", async () => {
  expect((await invoke("?week=0", "wrong")).status).toBe(401);
  expect(mocks.policy).not.toHaveBeenCalled();
  for (const query of ["", "?week=", "?week=-1", "?week=1.5", "?week=4", "?week=bad"])
    expect((await invoke(query)).status).toBe(400);
  mocks.env.CRON_SECRET = undefined;
  expect((await invoke()).status).toBe(503);
  expect(mocks.run).not.toHaveBeenCalled();
});
it("does no work when disabled or before the prospective cutover", async () => {
  mocks.policy.mockReturnValue(null);
  expect(await (await invoke()).json()).toEqual({ enabled: false });
  mocks.policy.mockReturnValue(policy);
  expect(await (await invoke("?week=1")).json()).toMatchObject({
    skipped: "before_prospective_cutover",
    periodStart: "2026-09-13",
  });
  expect(mocks.run).not.toHaveBeenCalled();
  expect(mocks.limited).not.toHaveBeenCalled();
});
it("publishes one policy-bound source/week and reports failed publication as failure", async () => {
  expect((await invoke()).status).toBe(200);
  expect(mocks.run).toHaveBeenCalledWith(
    expect.anything(),
    { dataSourceId: "source", organizationId: "org" },
    { weekOffset: 0 }
  );
  mocks.run.mockResolvedValue({ success: false, valuesWritten: 0 });
  expect((await invoke()).status).toBe(503);
  mocks.run.mockRejectedValue(new Error("synthetic failure"));
  expect((await invoke()).status).toBe(503);
});
it("honors source cooldown and never falls back from invalid policy", async () => {
  mocks.limited.mockResolvedValue(true);
  expect((await invoke()).status).toBe(429);
  expect(mocks.run).not.toHaveBeenCalled();
  mocks.policy.mockImplementation(() => {
    throw new Error("invalid policy");
  });
  expect((await invoke()).status).toBe(503);
  expect(mocks.run).not.toHaveBeenCalled();
});

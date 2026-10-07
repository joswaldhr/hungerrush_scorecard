// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  env: { CRON_SECRET: "synthetic-secret" as string | undefined },
  collection: vi.fn(),
  releases: vi.fn(),
  read: vi.fn(),
  batch: vi.fn(),
  updater: vi.fn(),
  assignee: vi.fn(),
  sync: vi.fn(),
  cooldown: vi.fn(),
  week: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@/lib/connectors/zendesk-solved-config", () => ({
  configuredReportEventCollectionPolicy: mocks.collection,
  configuredSolvedReportReleases: mocks.releases,
}));
vi.mock("@/lib/connectors/zendesk-report-event-worker", () => ({
  createReportEventReader: mocks.read,
  runReportEventBatch: mocks.batch,
}));
vi.mock("@/lib/connectors/zendesk-updater-solved-publisher", () => ({
  createLiveUpdaterSolvedPublisher: mocks.updater,
}));
vi.mock("@/lib/connectors/zendesk-assignee-solved-publisher", () => ({
  createLiveAssigneeSolvedPublisher: mocks.assignee,
}));
vi.mock("@/lib/connectors/sync-engine", () => ({ runSync: mocks.sync }));
vi.mock("@/lib/rate-limit", () => ({ isSyncRateLimited: mocks.cooldown }));
vi.mock("@/lib/utils", () => ({ weekDates: mocks.week }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { GET as collect } from "@/app/api/cron/ticket-events/route";
import { GET as publish } from "@/app/api/cron/solved-tickets/route";
const scope = {
  organizationId: "org",
  dataSourceId: "source",
  accountReference: "zendesk-account:synthetic",
};
const updater = { ...scope, kind: "updater", effectivePeriodStart: "2026-09-27" };
const assignee = { ...scope, kind: "assignee-solved", effectivePeriodStart: "2026-09-27" };
const invoke = (
  handler: (request: Request) => Promise<Response>,
  query = "",
  secret = "synthetic-secret"
) =>
  handler(
    new Request(`https://synthetic.test/api/cron/test${query}`, {
      headers: { authorization: `Bearer ${secret}` },
    })
  );
beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.CRON_SECRET = "synthetic-secret";
  mocks.collection.mockReturnValue({ scope, bootstrapStart: 1000 });
  mocks.releases.mockReturnValue([updater, assignee]);
  mocks.read.mockReturnValue("reader");
  mocks.updater.mockReturnValue("updater");
  mocks.assignee.mockReturnValue("assignee");
  mocks.batch.mockResolvedValue({ status: "collected", streamExhausted: true, pages: 2 });
  mocks.sync.mockResolvedValue({ success: true });
  mocks.cooldown.mockResolvedValue(false);
  mocks.week.mockReturnValue({ periodStart: "2026-10-04", periodEnd: "2026-10-10" });
});
it("authenticates both endpoints before inspecting policy or performing any work", async () => {
  for (const handler of [collect, publish])
    expect((await invoke(handler, "", "bad")).status).toBe(401);
  mocks.env.CRON_SECRET = undefined;
  for (const handler of [collect, publish]) expect((await invoke(handler)).status).toBe(503);
  expect(mocks.collection).not.toHaveBeenCalled();
  expect(mocks.releases).not.toHaveBeenCalled();
  expect(mocks.sync).not.toHaveBeenCalled();
  expect(mocks.batch).not.toHaveBeenCalled();
});
it("rejects arbitrary controls and repeated parameters without reading source policy", async () => {
  for (const query of ["?week=0", "?bootstrap=0", "?publish=true"])
    expect((await invoke(collect, query)).status).toBe(400);
  for (const query of [
    "",
    "?kind=updater",
    "?kind=updater&week=4",
    "?kind=human&week=0",
    "?kind=updater&week=0&week=1",
    "?kind=updater&week=0&kind=assignee-solved",
    "?kind=updater&week=0&source=other",
  ])
    expect((await invoke(publish, query)).status).toBe(400);
  expect(mocks.collection).not.toHaveBeenCalled();
  expect(mocks.releases).not.toHaveBeenCalled();
});
it("keeps both endpoints inert without their separate explicit policies", async () => {
  mocks.collection.mockReturnValue(null);
  mocks.releases.mockReturnValue([]);
  expect(await (await invoke(collect)).json()).toEqual({ enabled: false });
  expect(await (await invoke(publish, "?kind=updater&week=0")).json()).toEqual({ enabled: false });
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.updater).not.toHaveBeenCalled();
  expect(mocks.sync).not.toHaveBeenCalled();
  expect(mocks.batch).not.toHaveBeenCalled();
});
it("collection never publishes metrics and distinguishes partial, busy and delayed work", async () => {
  expect(await (await invoke(collect)).json()).toMatchObject({
    metricsPublished: false,
    joinedMetricCoverageCertified: false,
  });
  expect(mocks.batch).toHaveBeenCalledWith(scope, 1000, "reader");
  mocks.batch.mockResolvedValue({ status: "collected", streamExhausted: false });
  expect((await invoke(collect)).status).toBe(202);
  mocks.batch.mockResolvedValue({ status: "busy" });
  expect((await invoke(collect)).status).toBe(409);
  for (const status of ["waiting", "rate_limited"]) {
    mocks.batch.mockResolvedValue({ status, waitMs: 11500 });
    const response = await invoke(collect);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("12");
  }
  expect(mocks.sync).not.toHaveBeenCalled();
});
it("publishes only one requested kind/week through the common sync transaction", async () => {
  expect((await invoke(publish, "?kind=updater&week=0")).status).toBe(200);
  expect(mocks.sync).toHaveBeenLastCalledWith(
    "updater",
    { organizationId: "org", dataSourceId: "source" },
    { weekOffset: 0 }
  );
  expect((await invoke(publish, "?kind=assignee-solved&week=1")).status).toBe(200);
  expect(mocks.sync).toHaveBeenLastCalledWith(
    "assignee",
    { organizationId: "org", dataSourceId: "source" },
    { weekOffset: 1 }
  );
  expect(mocks.batch).not.toHaveBeenCalled();
});
it("skips pre-cutover weeks, preserves cooldown, and reports failures", async () => {
  mocks.week.mockReturnValueOnce({ periodStart: "2026-09-20", periodEnd: "2026-09-26" });
  expect(await (await invoke(publish, "?kind=updater&week=2")).json()).toMatchObject({
    skipped: "before_release_cutover",
  });
  expect(mocks.sync).not.toHaveBeenCalled();
  mocks.cooldown.mockResolvedValueOnce(true);
  expect((await invoke(publish, "?kind=updater&week=0")).status).toBe(429);
  expect(mocks.sync).not.toHaveBeenCalled();
  mocks.sync.mockResolvedValueOnce({ success: false });
  expect((await invoke(publish, "?kind=updater&week=0")).status).toBe(503);
  mocks.collection.mockImplementation(() => {
    throw Error("bad policy");
  });
  expect((await invoke(collect)).status).toBe(503);
  mocks.releases.mockImplementation(() => {
    throw Error("bad policy");
  });
  expect((await invoke(publish, "?kind=updater&week=0")).status).toBe(503);
});

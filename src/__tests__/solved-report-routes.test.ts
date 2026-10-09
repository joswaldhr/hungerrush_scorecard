// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  env: {
    CRON_SECRET: "synthetic-secret" as string | undefined,
    ZENDESK_REPORT_RECOVERY: undefined as string | undefined,
    ZENDESK_CSAT_RECOVERY: undefined as string | undefined,
    ZENDESK_FIRST_REPLY_RECOVERY: undefined as string | undefined,
  },
  recovery: vi.fn(),
  csat: vi.fn(),
  firstReply: vi.fn(),
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
vi.mock("@/lib/connectors/zendesk-csat-config", () => ({ configuredCsatPolicy: mocks.csat }));
vi.mock("@/lib/connectors/zendesk-first-reply-config", () => ({
  configuredFirstReplyPolicy: mocks.firstReply,
}));
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
vi.mock("@/lib/connectors/zendesk-report-recovery", () => ({
  runLiveReportRecovery: mocks.recovery,
}));
vi.mock("@/lib/rate-limit", () => ({ isSyncRateLimited: mocks.cooldown }));
vi.mock("@/lib/utils", () => ({ weekDates: mocks.week }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { GET as collect } from "@/app/api/cron/ticket-events/route";
import { GET as publish } from "@/app/api/cron/solved-tickets/route";
import { GET as recover } from "@/app/api/cron/report-recovery/route";
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
  mocks.env.ZENDESK_REPORT_RECOVERY = undefined;
  mocks.env.ZENDESK_CSAT_RECOVERY = undefined;
  mocks.env.ZENDESK_FIRST_REPLY_RECOVERY = undefined;
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
  for (const handler of [collect, publish, recover])
    expect((await invoke(handler, "", "bad")).status).toBe(401);
  mocks.env.CRON_SECRET = undefined;
  for (const handler of [collect, publish, recover])
    expect((await invoke(handler)).status).toBe(503);
  expect(mocks.collection).not.toHaveBeenCalled();
  expect(mocks.releases).not.toHaveBeenCalled();
  expect(mocks.sync).not.toHaveBeenCalled();
  expect(mocks.batch).not.toHaveBeenCalled();
});
it("requires the independent recovery switch and validates daily slot inputs", async () => {
  for (const query of [
    "",
    "?slot=24",
    "?slot=-1",
    "?slot=01",
    "?slot=1&slot=2",
    "?slot=1&source=other",
  ])
    expect((await invoke(recover, query)).status).toBe(400);
  expect(await (await invoke(recover, "?slot=0")).json()).toEqual({ enabled: false });
  expect(mocks.collection).not.toHaveBeenCalled();
  expect(mocks.recovery).not.toHaveBeenCalled();
  mocks.env.ZENDESK_REPORT_RECOVERY = "1";
  for (const [status, http] of [
    ["complete", 200],
    ["deferred", 202],
    ["failed", 503],
    ["idle_or_deferred", 200],
  ] as const) {
    mocks.recovery.mockResolvedValueOnce({ status });
    expect((await invoke(recover, "?slot=23")).status).toBe(http);
  }
  mocks.collection.mockReturnValue(null);
  expect((await invoke(recover, "?slot=0")).status).toBe(503);
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

it.each([
  ["CSAT", "ZENDESK_CSAT_RECOVERY", "csat", 3, "csat_score"],
  ["first reply", "ZENDESK_FIRST_REPLY_RECOVERY", "firstReply", 5, "avg_response_time"],
] as const)(
  "requires both recovery switches and a source-bound %s policy",
  async (_label, flag, mockName, argument, metricKey) => {
    const configuredPolicy = mocks[mockName];
    mocks.env[flag] = "1";
    expect(await (await invoke(recover, "?slot=0")).json()).toEqual({ enabled: false });
    expect(configuredPolicy).not.toHaveBeenCalled();
    mocks.env.ZENDESK_REPORT_RECOVERY = "1";
    configuredPolicy.mockReturnValue(null);
    expect((await invoke(recover, "?slot=0")).status).toBe(503);
    expect(mocks.recovery).not.toHaveBeenCalled();
    // Configuration parsing is mocked here; this fixture must still carry the actual
    // organization/source/account fields independently checked by the recovery gate.
    const policy = {
      ...scope,
      schemaVersion: 1,
      reportingTimeZone: "America/Chicago",
      effectivePeriodStart: "2026-09-27",
      teams: [
        { teamId: "synthetic-team", groupIds: [10], brandIds: null, metricKeys: [metricKey] },
      ],
    };
    configuredPolicy.mockReturnValue(policy);
    mocks.recovery.mockResolvedValue({ status: "complete" });
    expect((await invoke(recover, "?slot=0")).status).toBe(200);
    expect(mocks.recovery.mock.calls.at(-1)?.[argument]).toBe(policy);
    for (const field of ["organizationId", "dataSourceId", "accountReference"] as const) {
      mocks.recovery.mockClear();
      configuredPolicy.mockReturnValue({ ...policy, [field]: "foreign-binding" });
      expect((await invoke(recover, "?slot=0")).status).toBe(503);
      expect(mocks.recovery).not.toHaveBeenCalled();
    }
    mocks.env[flag] = undefined;
    configuredPolicy.mockClear();
    expect((await invoke(recover, "?slot=0")).status).toBe(200);
    expect(configuredPolicy).not.toHaveBeenCalled();
    expect(mocks.recovery.mock.calls.at(-1)?.[argument]).toBeUndefined();
  }
);
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
    { period: { periodStart: "2026-10-04", periodEnd: "2026-10-10" } }
  );
  expect((await invoke(publish, "?kind=assignee-solved&week=1")).status).toBe(200);
  expect(mocks.sync).toHaveBeenLastCalledWith(
    "assignee",
    { organizationId: "org", dataSourceId: "source" },
    { period: { periodStart: "2026-10-04", periodEnd: "2026-10-10" } }
  );
  expect(mocks.batch).not.toHaveBeenCalled();
});
it("pins response and publication dates if Sunday rolls over while checking cooldown", async () => {
  mocks.week.mockReturnValue({ periodStart: "2026-09-27", periodEnd: "2026-10-03" });
  mocks.cooldown.mockImplementation(async () => {
    mocks.week.mockReturnValue({ periodStart: "2026-10-04", periodEnd: "2026-10-10" });
    return false;
  });
  const response = await invoke(publish, "?kind=updater&week=0");
  const period = { periodStart: "2026-09-27", periodEnd: "2026-10-03" };
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject(period);
  expect(mocks.sync).toHaveBeenCalledWith("updater", expect.anything(), { period });
  expect(mocks.week).toHaveBeenCalledTimes(1);
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

// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  claim: vi.fn(),
  finish: vi.fn(),
  cooldown: vi.fn(),
  collect: vi.fn(),
  reader: vi.fn(),
  sync: vi.fn(),
  updater: vi.fn(),
  assignee: vi.fn(),
  csat: vi.fn(),
}));
vi.mock("@/lib/connectors/zendesk-report-jobs", () => ({
  requestReportJobs: mocks.request,
  claimReportJob: mocks.claim,
  finishReportJob: mocks.finish,
}));
vi.mock("@/lib/rate-limit", () => ({ isSyncRateLimited: mocks.cooldown }));
vi.mock("@/lib/connectors/zendesk-report-event-worker", () => ({
  runReportEventBatch: mocks.collect,
  createReportEventReader: mocks.reader,
}));
vi.mock("@/lib/connectors/sync-engine", () => ({ runSync: mocks.sync }));
vi.mock("@/lib/connectors/zendesk-csat-connector", () => ({ createCsatConnector: mocks.csat }));
vi.mock("@/lib/connectors/zendesk-updater-solved-publisher", () => ({
  createLiveUpdaterSolvedPublisher: mocks.updater,
}));
vi.mock("@/lib/connectors/zendesk-assignee-solved-publisher", () => ({
  createLiveAssigneeSolvedPublisher: mocks.assignee,
}));
import {
  planReportRecovery,
  runLiveReportRecovery,
} from "@/lib/connectors/zendesk-report-recovery";
import { solvedPublicationFixture } from "./fixtures/solved-publication";
import type { ZendeskCsatPolicy } from "@/lib/connectors/zendesk-csat-policy";
const f = solvedPublicationFixture();
const policy = { ...f.policy, effectivePeriodStart: "2020-01-05" };
const csat: ZendeskCsatPolicy = {
  ...f.config,
  schemaVersion: 1,
  accountReference: f.policy.accountReference,
  reportingTimeZone: "UTC",
  effectivePeriodStart: "2020-01-05",
  teams: [{ teamId: f.policy.teamId, groupIds: [10], brandIds: [20], metricKeys: ["csat_score"] }],
};
const collection = {
  scope: { ...f.config, accountReference: f.policy.accountReference },
  bootstrapStart: 1578182400,
};
const credentials = {
  subdomain: "synthetic",
  email: "source@example.invalid",
  apiKey: "fictional",
};
const plan = () => planReportRecovery(collection, [policy]);
const run = () => runLiveReportRecovery(collection, [policy], credentials);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.cooldown.mockResolvedValue(false);
  mocks.updater.mockReturnValue("updater");
  mocks.assignee.mockReturnValue("assignee");
  mocks.csat.mockReturnValue("csat");
  mocks.reader.mockReturnValue("GET-only reader");
  mocks.collect.mockResolvedValue({ status: "collected", streamExhausted: true });
  mocks.sync.mockResolvedValue({ success: true });
  mocks.claim.mockResolvedValue({
    definition: plan().requests[0]!.definition,
    token: "owned",
    desiredAt: "2021-01-03T00:00:00.000Z",
  });
});

it("plans exact four-week periods, skips pre-cutover dates and keeps policy hashes stable across rollover", () => {
  const before = planReportRecovery(collection, [policy], new Date("2026-10-03T23:59:59Z"));
  const after = planReportRecovery(collection, [policy], new Date("2026-10-04T00:00:01Z"));
  expect(
    before.requests
      .slice(1)
      .map((r) => r.definition.kind !== "collection" && r.definition.periodStart)
  ).toEqual(["2026-09-27", "2026-09-20", "2026-09-13", "2026-09-06"]);
  expect(after.requests[1]?.definition).toMatchObject({
    periodStart: "2026-10-04",
    periodEnd: "2026-10-10",
  });
  expect(before.currentPolicyHashes).toEqual(after.currentPolicyHashes);
  expect(before.requests[0]?.desiredAt).toBe("2026-10-03T18:00:00.000Z");
  expect(after.requests[0]?.desiredAt).toBe("2026-10-04T00:00:00.000Z");
  expect(
    planReportRecovery(
      collection,
      [{ ...policy, effectivePeriodStart: "2026-09-27" }],
      new Date("2026-10-07T12:00:00Z")
    ).requests
  ).toHaveLength(3);
});

it("rejects cross-source policies before scheduling any work", () => {
  expect(() =>
    planReportRecovery(collection, [
      { ...policy, dataSourceId: "20000000-0000-4000-8000-000000000002" },
    ])
  ).toThrow("share one");
  expect(() => planReportRecovery(collection, [policy, policy])).toThrow("share one");
});

it("retains work during cooldown and makes no vendor request", async () => {
  mocks.cooldown.mockResolvedValue(true);
  expect(await run()).toMatchObject({ status: "deferred", kind: "collection" });
  expect(mocks.collect).not.toHaveBeenCalled();
  expect(mocks.sync).not.toHaveBeenCalled();
  expect(mocks.finish).toHaveBeenCalledWith(
    collection.scope,
    expect.anything(),
    expect.objectContaining({ status: "deferred" })
  );
});

it.each([
  { status: "collected", streamExhausted: false },
  { status: "waiting", waitMs: 20000 },
  { status: "rate_limited", waitMs: 3600000 },
  { status: "busy", retryAt: "2099-01-01T00:00:00.000Z" },
])("never acknowledges incomplete/delayed collection: %j", async (result) => {
  mocks.collect.mockResolvedValue(result);
  expect(await run()).toMatchObject({ status: "deferred" });
  expect(mocks.sync).not.toHaveBeenCalled();
});

it("acknowledges exhaustion, while a thrown collector failure stays queued", async () => {
  expect(await run()).toMatchObject({ status: "complete" });
  mocks.collect.mockRejectedValueOnce(Error("Synthetic failed request"));
  expect(await run()).toMatchObject({ status: "failed" });
});

it("retries saved dates outside the current four-week planning horizon without shifting their meaning", async () => {
  const selected = {
    kind: "updater",
    policyHash: plan().publicationPolicies[0]!.policyHash,
    periodStart: "2021-01-03",
    periodEnd: "2021-01-09",
  };
  mocks.claim.mockResolvedValue({
    definition: selected,
    token: "owned",
    desiredAt: "2021-01-10T00:00:00.000Z",
  });
  expect(await run()).toMatchObject({
    status: "complete",
    periodStart: selected.periodStart,
    periodEnd: selected.periodEnd,
  });
  expect(mocks.sync).toHaveBeenCalledWith("updater", collection.scope, {
    period: { periodStart: selected.periodStart, periodEnd: selected.periodEnd },
  });
  mocks.sync.mockResolvedValueOnce({ success: false, skipped: true });
  expect(await run()).toMatchObject({ status: "deferred" });
  mocks.sync.mockResolvedValueOnce({ success: false });
  expect(await run()).toMatchObject({ status: "failed" });
});

it("does not run work without ownership or claim success when acknowledgment fails", async () => {
  mocks.claim.mockResolvedValueOnce(null);
  expect(await run()).toEqual({ status: "idle_or_deferred" });
  expect(mocks.collect).not.toHaveBeenCalled();
  mocks.finish.mockRejectedValueOnce(Error("Synthetic lost acknowledgment"));
  await expect(run()).rejects.toThrow("lost acknowledgment");
});

it("only adds CSAT demand when explicitly supplied, with a policy-specific cutover", () => {
  expect(plan().requests.some((r) => r.definition.kind === "csat")).toBe(false);
  const p = planReportRecovery(collection, [policy], new Date("2026-10-08T12:00:00Z"), {
    ...csat,
    effectivePeriodStart: "2026-09-27",
  });
  expect(p.requests.filter((r) => r.definition.kind === "csat").map((r) => r.definition)).toEqual([
    {
      kind: "csat",
      policyHash: p.csatPolicy!.policyHash,
      periodStart: "2026-10-04",
      periodEnd: "2026-10-10",
    },
    {
      kind: "csat",
      policyHash: p.csatPolicy!.policyHash,
      periodStart: "2026-09-27",
      periodEnd: "2026-10-03",
    },
  ]);
  expect(p.currentPolicyHashes).toContain(p.csatPolicy!.policyHash);
  expect(() =>
    planReportRecovery(collection, [policy], undefined, {
      ...csat,
      organizationId: "20000000-0000-4000-8000-000000000002",
    })
  ).toThrow("share");
  expect(() =>
    planReportRecovery(collection, [policy], undefined, {
      ...csat,
      accountReference: "zendesk-account:foreign",
    })
  ).toThrow("binding");
});

it("resumes CSAT's saved interval after rollover and retains source retry-after", async () => {
  const p = planReportRecovery(collection, [policy], undefined, csat);
  const selected = {
    kind: "csat",
    policyHash: p.csatPolicy!.policyHash,
    periodStart: "2021-01-03",
    periodEnd: "2021-01-09",
  };
  mocks.claim.mockResolvedValue({
    definition: selected,
    token: "owned",
    desiredAt: "2021-01-10T00:00:00.000Z",
  });
  const retryAt = new Date(Date.now() + 7200000).toISOString();
  mocks.sync.mockResolvedValueOnce({ success: false, retryAt });
  expect(await runLiveReportRecovery(collection, [policy], credentials, csat)).toMatchObject({
    status: "failed",
    kind: "csat",
    periodStart: selected.periodStart,
    periodEnd: selected.periodEnd,
  });
  expect(mocks.sync).toHaveBeenCalledWith("csat", collection.scope, {
    period: { periodStart: selected.periodStart, periodEnd: selected.periodEnd },
  });
  expect(mocks.finish).toHaveBeenLastCalledWith(
    collection.scope,
    expect.anything(),
    expect.objectContaining({ status: "failed", retryAt })
  );
  expect(mocks.collect).not.toHaveBeenCalled();
  expect(mocks.updater).not.toHaveBeenCalled();
  mocks.sync.mockClear();
  expect(await run()).toMatchObject({ status: "failed" });
  expect(mocks.sync).not.toHaveBeenCalled();
});

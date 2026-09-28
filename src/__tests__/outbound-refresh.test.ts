// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { outboundObservationFixture } from "./fixtures/outbound-observation";
import { outboundTalkKeys } from "@/lib/connectors/zendesk-talk-policy";

const mocks = vi.hoisted(() => ({
  where: vi.fn(),
  snapshot: vi.fn(),
  batch: vi.fn(),
  reader: vi.fn(),
  support: vi.fn(),
  collect: vi.fn(),
}));
vi.mock("@/lib/env", () => ({
  env: { ZENDESK_SUBDOMAIN: "synthetic", ZENDESK_EMAIL: "synthetic", ZENDESK_API_KEY: "synthetic" },
}));
vi.mock("@/lib/db", () => {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: mocks.where,
  };
  return { db: { select: () => chain } };
});
vi.mock("@/lib/connectors/zendesk", () => ({
  ZendeskConnector: class {},
  MAX_WEEKS_BACK: 4,
}));
vi.mock("@/lib/connectors/zendesk-talk-store", () => ({
  readTalkCollectionSnapshot: mocks.snapshot,
}));
vi.mock("@/lib/connectors/zendesk-talk-worker", () => ({
  runTalkCollectionBatch: mocks.batch,
  createTalkExportReader: mocks.reader,
}));
vi.mock("@/lib/connectors/zendesk-csat-reader", () => ({ createBoundedCsatReader: mocks.support }));
vi.mock("@/lib/connectors/zendesk-outbound-collection", () => ({
  collectOutboundRecords: mocks.collect,
}));
import { createOutboundConnector } from "@/lib/connectors/zendesk-outbound-connector";
const f = outboundObservationFixture();
const collection = {
  scope: { ...f.config, accountReference: f.policy.accountReference },
  bootstrapStart: f.snapshot.bootstrapStart,
};
const invoke = () =>
  createOutboundConnector(f.policy, collection).fetchRecords(f.config, {
    ...f.config,
    syncRunId: "synthetic",
    cursor: "0",
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(f.now);
  mocks.where
    .mockResolvedValueOnce([
      {
        id: f.config.dataSourceId,
        organizationId: f.config.organizationId,
        type: "zendesk",
        status: "configured",
        configurationReference: f.policy.accountReference,
      },
    ])
    .mockResolvedValueOnce([{ id: f.identity.teamId }])
    .mockResolvedValueOnce(
      outboundTalkKeys.map((key) => ({
        assignment: { teamId: f.identity.teamId, effectiveFrom: "2026-09-20", effectiveTo: null },
        definition: {
          key,
          effectiveFrom: "2026-09-20",
          effectiveTo: null,
          sourceStrategy: "zendesk",
          unit: key.startsWith("avg_") ? "s" : "calls",
          valueType: key.startsWith("avg_") ? "duration" : "count",
          calculationType: key.startsWith("avg_") ? "average" : "sum",
        },
      }))
    )
    .mockResolvedValueOnce([
      {
        employeeId: f.identity.employeeId,
        teamId: f.identity.teamId,
        externalId: f.identity.externalId,
      },
    ]);
  mocks.batch.mockResolvedValue({
    status: "collected",
    callsExhausted: true,
    legsExhausted: true,
    pages: 2,
  });
  mocks.snapshot.mockResolvedValue({ status: "ready_for_qualification", snapshot: f.snapshot });
  mocks.support.mockReturnValue({ read: vi.fn(), stats: () => ({ requests: 2 }) });
  mocks.collect.mockResolvedValue({ records: [], diagnostics: { activeEmployees: 1 } });
});
afterEach(() => vi.useRealTimers());

it("rejects a foreign collection source before opening any source or database operation", () => {
  expect(() =>
    createOutboundConnector(f.policy, {
      ...collection,
      scope: { ...collection.scope, dataSourceId: "foreign" },
    })
  ).toThrow("same source");
  expect(mocks.where).not.toHaveBeenCalled();
  expect(mocks.batch).not.toHaveBeenCalled();
});

it("refreshes Talk before reading its snapshot and reserves a bounded Support phase", async () => {
  await invoke();
  expect(mocks.batch).toHaveBeenCalledWith(collection.scope, collection.bootstrapStart, undefined, {
    maxPages: 22,
    maxDurationMs: 150000,
  });
  expect(mocks.batch.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.snapshot.mock.invocationCallOrder[0]!
  );
  expect(mocks.snapshot.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.support.mock.invocationCallOrder[0]!
  );
  expect(mocks.support).toHaveBeenCalledWith(expect.anything(), {
    elapsedMs: 90000,
    requestBudget: 80,
  });
  expect(mocks.collect).toHaveBeenCalledOnce();
});

it.each([
  { status: "collected", callsExhausted: true, legsExhausted: false },
  { status: "busy" },
  { status: "waiting", waitMs: 15000 },
  { status: "rate_limited", waitMs: 60000 },
])(
  "never publishes or requests Support data after incomplete collection: $status",
  async (outcome) => {
    mocks.batch.mockResolvedValue(outcome);
    await expect(invoke()).rejects.toThrow("collection incomplete");
    expect(mocks.snapshot).not.toHaveBeenCalled();
    expect(mocks.support).not.toHaveBeenCalled();
    expect(mocks.collect).not.toHaveBeenCalled();
  }
);

it("rejects invalid employee bindings before consuming Talk quota", async () => {
  mocks.where.mockReset().mockResolvedValueOnce([]);
  await expect(invoke()).rejects.toThrow("source is unavailable");
  expect(mocks.batch).not.toHaveBeenCalled();
});

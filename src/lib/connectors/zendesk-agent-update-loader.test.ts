// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createLiveAgentUpdatePublisher } from "./zendesk-agent-update-loader";
import { createAgentUpdatePublisher } from "./zendesk-agent-update-publisher";
import { createReportJoinReader } from "./zendesk-report-join-reader";
import { readReportEventSnapshot } from "./zendesk-report-event-store";
import { joinAgentUpdateReport } from "./zendesk-updater-solved-join";
import { initialReportEventCursor } from "./zendesk-report-event-cursor";
import type { AgentUpdateRelease } from "./zendesk-agent-update-publication-record";
vi.mock("./zendesk-agent-update-publisher", () => ({ createAgentUpdatePublisher: vi.fn() }));
vi.mock("./zendesk-report-join-reader", () => ({ createReportJoinReader: vi.fn() }));
vi.mock("./zendesk-report-event-store", () => ({ readReportEventSnapshot: vi.fn() }));
vi.mock("./zendesk-updater-solved-join", () => ({ joinAgentUpdateReport: vi.fn() }));
const source = "00000000-0000-4000-8000-000000000001";
const policy: AgentUpdateRelease = {
  kind: "agent-updates",
  organizationId: source,
  dataSourceId: source,
  teamId: source,
  accountReference: "zendesk-account:synthetic",
  subdomain: "synthetic",
  groupIds: [10],
  brandIds: [20],
  timeZone: "America/Chicago",
  effectivePeriodStart: "2026-09-27",
  maxObservationAgeSeconds: 3600,
  releaseEvidenceSha256: "a".repeat(64),
};
const credentials = {
  subdomain: "synthetic",
  email: "source@example.invalid",
  apiKey: "synthetic-token",
};
const current = () => ({
  status: "ready" as const,
  snapshot: {
    events: [],
    coverage: {
      start: "2026-10-04T05:00:00.000Z",
      endExclusive: "2026-10-07T11:58:00.000Z",
      complete: true,
    },
    state: {
      version: 1 as const,
      cycle: 1,
      observationStartedAt: "2026-10-07T11:55:00.000Z",
      lastPageAt: "2026-10-07T11:59:00.000Z",
      cursor: {
        ...initialReportEventCursor(
          policy.accountReference,
          Date.parse("2026-09-27T05:00:00Z") / 1000
        ),
        watermark: Date.parse("2026-10-07T11:58:00Z") / 1000,
        status: "exhausted" as const,
      },
    },
  },
});
function load() {
  createLiveAgentUpdatePublisher(policy, credentials);
  return vi.mocked(createAgentUpdatePublisher).mock.calls.at(-1)![1];
}
const config = { organizationId: source, dataSourceId: source, credentials: {} };
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
  vi.mocked(createReportJoinReader).mockReturnValue(
    vi.fn().mockResolvedValue({
      users: [
        { id: 42, email: "staff@example.invalid", role: "agent", active: true, suspended: false },
      ],
      meta: { has_more: false },
      links: { next: null },
    })
  );
  vi.mocked(readReportEventSnapshot).mockResolvedValue(current());
  vi.mocked(joinAgentUpdateReport).mockResolvedValue({
    events: [],
    tickets: [],
    deletedTickets: [],
    identities: [{ id: 42, role: "agent" }],
    coverage: current().snapshot.coverage,
    observedAt: "2026-10-07T12:00:00Z",
  });
});
afterEach(() => vi.useRealTimers());
it("carries explicit current cutoff, exact local week bounds and oldest observation", async () => {
  const result = await load()(config, "2026-10-04", "2026-10-10", ["staff@example.invalid"]);
  expect(result.observationStartedAt).toBe("2026-10-07T11:55:00.000Z");
  expect(result.identities.get("staff@example.invalid")).toBe(42);
  expect(readReportEventSnapshot).toHaveBeenCalledWith(
    policy,
    new Date("2026-10-04T05:00:00Z"),
    new Date("2026-10-11T05:00:00Z"),
    [42],
    { capAtWatermark: true }
  );
  expect(vi.mocked(joinAgentUpdateReport).mock.calls[0]?.[0]).toMatchObject({
    coverage: { asOf: "2026-10-07T11:58:00.000Z" },
    identities: [{ id: 42, role: "agent" }],
  });
});
it("refuses stale or incomplete stream instead of laundering it with fresh parents", async () => {
  vi.mocked(readReportEventSnapshot).mockResolvedValueOnce({
    status: "collecting",
    snapshot: null,
  });
  await expect(
    load()(config, "2026-10-04", "2026-10-10", ["staff@example.invalid"])
  ).rejects.toThrow("incomplete");
  const stale = current();
  stale.snapshot.state.observationStartedAt = "2026-10-06T12:00:00.000Z";
  vi.mocked(readReportEventSnapshot).mockResolvedValueOnce(stale);
  await expect(
    load()(config, "2026-10-04", "2026-10-10", ["staff@example.invalid"])
  ).rejects.toThrow("stale");
  expect(joinAgentUpdateReport).not.toHaveBeenCalled();
});
it("does not mark a truncated past week as current progress", async () => {
  const incomplete = current();
  incomplete.snapshot.coverage = {
    start: "2026-09-27T05:00:00Z",
    endExclusive: "2026-10-03T12:00:00Z",
    complete: true,
  };
  vi.mocked(readReportEventSnapshot).mockResolvedValueOnce(incomplete);
  await expect(
    load()(config, "2026-09-27", "2026-10-03", ["staff@example.invalid"])
  ).rejects.toThrow("cutoff");
  expect(joinAgentUpdateReport).not.toHaveBeenCalled();
});
it("keeps a closed week unmarked by progress and blocks mismatched policy kind", async () => {
  const closed = current();
  closed.snapshot.coverage = {
    start: "2026-09-27T05:00:00Z",
    endExclusive: "2026-10-04T05:00:00Z",
    complete: true,
  };
  vi.mocked(readReportEventSnapshot).mockResolvedValueOnce(closed);
  await load()(config, "2026-09-27", "2026-10-03", ["staff@example.invalid"]);
  expect(
    (vi.mocked(joinAgentUpdateReport).mock.calls[0]?.[0] as { coverage: object }).coverage
  ).not.toHaveProperty("asOf");
  expect(() =>
    createLiveAgentUpdatePublisher({ ...policy, kind: "assignee-solved" as never }, credentials)
  ).toThrow();
});

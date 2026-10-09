// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  env: {
    ROSTER_DISCOVERY_RECOVERY: undefined as string | undefined,
    ZENDESK_REPORT_RECOVERY: "1",
    ROSTER_DISCOVERY_SOURCE_ID: "source",
  },
  collection: vi.fn(),
  releases: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@/lib/connectors/zendesk-solved-config", () => ({
  configuredReportEventCollectionPolicy: mocks.collection,
  configuredSolvedReportReleases: mocks.releases,
}));
import {
  configuredRosterRecovery,
  planRosterRecovery,
} from "@/lib/connectors/zendesk-roster-recovery";
const scope = {
  organizationId: "org",
  dataSourceId: "source",
  accountReference: "zendesk-account:synthetic",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.ROSTER_DISCOVERY_RECOVERY = undefined;
  mocks.env.ZENDESK_REPORT_RECOVERY = "1";
  mocks.env.ROSTER_DISCOVERY_SOURCE_ID = "source";
  mocks.collection.mockReturnValue({ scope });
  mocks.releases.mockReturnValue([scope]);
});
it("is default-off without inspecting any source policy", () => {
  expect(configuredRosterRecovery()).toBeUndefined();
  expect(mocks.collection).not.toHaveBeenCalled();
});
it("requires explicit dispatcher, roster source and matching released policies", () => {
  mocks.env.ROSTER_DISCOVERY_RECOVERY = "1";
  expect(configuredRosterRecovery()).toEqual(scope);
  mocks.env.ZENDESK_REPORT_RECOVERY = "";
  expect(() => configuredRosterRecovery()).toThrow("source-bound");
  mocks.env.ZENDESK_REPORT_RECOVERY = "1";
  mocks.env.ROSTER_DISCOVERY_SOURCE_ID = "foreign";
  expect(() => configuredRosterRecovery()).toThrow("source-bound");
  mocks.env.ROSTER_DISCOVERY_SOURCE_ID = "source";
  mocks.releases.mockReturnValue([]);
  expect(() => configuredRosterRecovery()).toThrow("source-bound");
});
it.each(["organizationId", "dataSourceId", "accountReference"])("rejects foreign %s", (key) => {
  mocks.env.ROSTER_DISCOVERY_RECOVERY = "1";
  mocks.releases.mockReturnValue([{ ...scope, [key]: "different" }]);
  expect(() => configuredRosterRecovery()).toThrow("source-bound");
});
it.each([
  ["2027-01-01T00:00:00Z", "2026-12-31T16:10:00.000Z"],
  ["2026-11-01T16:09:59Z", "2026-10-31T16:10:00.000Z"],
  ["2026-11-01T16:10:00Z", "2026-11-01T16:10:00.000Z"],
  ["2026-11-01T23:59:59Z", "2026-11-01T16:10:00.000Z"],
])("preserves the daily UTC slot through boundaries %s", (at, expected) => {
  const plan = planRosterRecovery(scope, new Date(at));
  expect(plan.requests).toHaveLength(1);
  expect(plan.requests[0]!.desiredAt).toBe(expected);
  expect(plan.requests[0]!.definition).not.toHaveProperty("periodStart");
});

// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  env: {
    ZENDESK_LEGACY_SYNC_RECOVERY: undefined as string | undefined,
    ZENDESK_REPORT_RECOVERY: undefined as string | undefined,
    ZENDESK_LEGACY_TALK_RESUME: undefined as string | undefined,
    ROSTER_DISCOVERY_SOURCE_ID: undefined as string | undefined,
  },
  collection: vi.fn(),
  releases: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("./zendesk-solved-config", () => ({
  configuredReportEventCollectionPolicy: mocks.collection,
  configuredSolvedReportReleases: mocks.releases,
}));
import {
  configuredLegacySyncRecovery,
  planLegacySyncRecovery,
} from "./zendesk-legacy-sync-recovery";
const scope = {
  organizationId: "10000000-0000-4000-8000-000000000001",
  dataSourceId: "10000000-0000-4000-8000-000000000002",
  accountReference: "zendesk-account:synthetic",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.ZENDESK_LEGACY_SYNC_RECOVERY = undefined;
  mocks.env.ZENDESK_REPORT_RECOVERY = undefined;
  mocks.env.ZENDESK_LEGACY_TALK_RESUME = undefined;
  mocks.env.ROSTER_DISCOVERY_SOURCE_ID = undefined;
  mocks.collection.mockReturnValue({ scope });
  mocks.releases.mockReturnValue([{ kind: "updater" }]);
});
it("is inert unless separately enabled and never removes roster work without its own schedule", () => {
  expect(configuredLegacySyncRecovery()).toBeUndefined();
  expect(mocks.collection).not.toHaveBeenCalled();
  mocks.env.ZENDESK_LEGACY_SYNC_RECOVERY = "1";
  expect(() => configuredLegacySyncRecovery()).toThrow("active dispatcher");
  mocks.env.ZENDESK_REPORT_RECOVERY = "1";
  expect(() => configuredLegacySyncRecovery()).toThrow("separate roster");
  mocks.env.ROSTER_DISCOVERY_SOURCE_ID = scope.dataSourceId;
  expect(() => configuredLegacySyncRecovery()).toThrow("resumable Talk");
  mocks.env.ZENDESK_LEGACY_TALK_RESUME = "1";
  expect(configuredLegacySyncRecovery()).toEqual(scope);
  mocks.releases.mockReturnValue([]);
  expect(() => configuredLegacySyncRecovery()).toThrow();
  mocks.releases.mockReturnValue([{ kind: "updater" }]);
  mocks.collection.mockReturnValue(null);
  expect(() => configuredLegacySyncRecovery()).toThrow();
});
it("keeps Saturday demand pinned through Sunday until the next 06:00 generation", () => {
  const sat = planLegacySyncRecovery(scope, new Date("2026-10-03T23:59:59Z"));
  const sun = planLegacySyncRecovery(scope, new Date("2026-10-04T05:59:59Z"));
  expect(sun).toEqual(sat);
  expect(sun.requests[0]).toMatchObject({
    desiredAt: "2026-10-03T06:00:00.000Z",
    definition: { kind: "legacy-sync", periodStart: "2026-09-27", periodEnd: "2026-10-03" },
  });
  const next = planLegacySyncRecovery(scope, new Date("2026-10-04T06:00:00Z"));
  expect(next.policyHash).toBe(sat.policyHash);
  expect(next.requests[0]).toMatchObject({
    desiredAt: "2026-10-04T06:00:00.000Z",
    definition: { periodStart: "2026-10-04", periodEnd: "2026-10-10" },
  });
  expect(next.requests).toHaveLength(4);
  expect(
    planLegacySyncRecovery({ ...scope, accountReference: "zendesk-account:foreign" }).policyHash
  ).not.toBe(next.policyHash);
});

// @vitest-environment node
import { expect, it } from "vitest";
import { reportJobHealth } from "@/lib/connectors/report-job-health";
const desiredAt = "2026-10-08T00:00:00.000Z";
const request = {
  definition: {
    kind: "updater" as const,
    policyHash: "a".repeat(64),
    periodStart: "2026-09-27",
    periodEnd: "2026-10-03",
  },
  desiredAt,
};
const base = {
  version: 1,
  accountReference: "zendesk-account:synthetic",
  definition: request.definition,
  desiredAt,
  completedThrough: null,
  notBefore: desiredAt,
  lastAttemptAt: desiredAt,
  lastOutcome: "pending",
  attempts: 0,
  failures: 0,
  lease: null,
};
const now = Date.parse("2026-10-08T12:00:00Z");
const health = (patch: Record<string, unknown>) =>
  reportJobHealth(request, { ...base, ...patch }, base.accountReference, now);

it("distinguishes missing, malformed and incorrectly bound records", () => {
  expect(reportJobHealth(request, undefined, base.accountReference, now).status).toBe("waiting");
  expect(reportJobHealth(request, null, base.accountReference, now).status).toBe("unknown");
  expect(health({ accountReference: "zendesk-account:other" }).status).toBe("unknown");
  expect(health({ definition: { ...request.definition, periodEnd: "2026-10-10" } }).status).toBe(
    "unknown"
  );
  expect(health({ definition: { ...request.definition, policyHash: "b".repeat(64) } }).status).toBe(
    "unknown"
  );
  expect(health({ definition: { ...request.definition, kind: "assignee-solved" } }).status).toBe(
    "unknown"
  );
  expect(
    reportJobHealth({ ...request, desiredAt: "bad" }, base, base.accountReference, now).status
  ).toBe("unknown");
});

it("does not call an earlier successful generation complete when newer work is required", () => {
  expect(
    health({ completedThrough: "2026-10-07T00:00:00.000Z", lastOutcome: "complete" }).status
  ).toBe("queued");
  expect(health({ completedThrough: desiredAt, lastOutcome: "complete" }).status).toBe("complete");
  expect(
    health({ completedThrough: desiredAt, desiredAt: "2026-10-08T06:00:00.000Z" }).status
  ).toBe("queued");
});

it("expires abandoned leases and preserves failed/deferred outcomes without claiming success", () => {
  const lease = {
    token: "10000000-0000-4000-8000-000000000001",
    desiredAt,
    expiresAt: "2026-10-08T12:05:00.000Z",
  };
  expect(health({ lease, lastOutcome: "running" }).status).toBe("running");
  expect(health({ lease: { ...lease, expiresAt: "2026-10-08T12:00:00.000Z" } }).status).toBe(
    "interrupted"
  );
  expect(health({ lastOutcome: "running" }).status).toBe("interrupted");
  expect(health({ lastOutcome: "failed", notBefore: lease.expiresAt })).toMatchObject({
    status: "failed",
    retryAt: lease.expiresAt,
  });
  expect(health({ lastOutcome: "deferred", notBefore: lease.expiresAt })).toMatchObject({
    status: "deferred",
    retryAt: lease.expiresAt,
  });
});

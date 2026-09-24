import { expect, it } from "vitest";
import { syncRunHealth } from "./sync-run-health";
const start = new Date("2026-09-24T00:00:00Z");
it("recognizes lease expiry even while the stored row remains running", () => {
  const run = {
    status: "running",
    startedAt: start,
    metadataJson: { leaseExpiresAt: "2026-09-24T00:20:00Z" },
  };
  expect(syncRunHealth(run, Date.parse("2026-09-24T00:19:59.999Z")).status).toBe("running");
  expect(syncRunHealth(run, Date.parse("2026-09-24T00:20:00Z"))).toMatchObject({
    status: "lease_expired",
    label: "Interrupted",
  });
  expect(run.status).toBe("running");
});
it("bounds legacy running jobs and does not infer activity from invalid lease metadata", () => {
  const run = { status: "running", startedAt: start };
  expect(syncRunHealth(run, start.getTime() + 599_999).status).toBe("running");
  expect(syncRunHealth(run, start.getTime() + 600_000).status).toBe("lease_expired");
  expect(
    syncRunHealth({ ...run, metadataJson: { leaseExpiresAt: "invalid" } }, start.getTime()).status
  ).toBe("unknown");
  expect(
    syncRunHealth({ ...run, metadataJson: { leaseExpiresAt: null } }, start.getTime()).status
  ).toBe("unknown");
});
it("distinguishes publication from metric verification and skipped or unrecognized runs", () => {
  expect(syncRunHealth({ status: "completed", startedAt: start }, start.getTime()).label).toBe(
    "Published"
  );
  expect(syncRunHealth({ status: "skipped", startedAt: start }, start.getTime()).label).toBe(
    "Skipped"
  );
  expect(syncRunHealth({ status: "constructor", startedAt: start }, start.getTime()).status).toBe(
    "unknown"
  );
  expect(syncRunHealth(null, start.getTime()).label).toBe("Never synced");
});

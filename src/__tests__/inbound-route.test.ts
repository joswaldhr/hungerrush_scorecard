// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  env: {
    CRON_SECRET: "synthetic-secret" as string | undefined,
    ZENDESK_SUBDOMAIN: "synthetic",
    ZENDESK_INBOUND_REPORT_RELEASE: undefined as string | undefined,
  },
  collection: vi.fn(),
  factory: vi.fn(),
  run: vi.fn(),
  limited: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@/lib/connectors/zendesk-talk-config", () => ({
  configuredTalkCollectionPolicy: mocks.collection,
}));
vi.mock("@/lib/connectors/zendesk-inbound-publisher", () => ({
  createLiveInboundPublisher: mocks.factory,
}));
vi.mock("@/lib/connectors/sync-engine", () => ({ runSync: mocks.run }));
vi.mock("@/lib/rate-limit", () => ({ isSyncRateLimited: mocks.limited }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { GET } from "@/app/api/cron/inbound/route";
import { inboundPublicationFixture } from "./fixtures/inbound-publication";
const invoke = (query = "?week=0", secret = "synthetic-secret") =>
  GET(
    new Request(`https://synthetic.test/api/cron/inbound${query}`, {
      headers: { authorization: `Bearer ${secret}` },
    })
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.CRON_SECRET = "synthetic-secret";
  mocks.env.ZENDESK_INBOUND_REPORT_RELEASE = JSON.stringify(inboundPublicationFixture().release);
  mocks.collection.mockReturnValue({});
  mocks.factory.mockReturnValue({ sourceType: "zendesk" });
  mocks.run.mockResolvedValue({ success: true, valuesWritten: 3 });
  mocks.limited.mockResolvedValue(false);
});
it("requires authentication and exactly one allowed offset before doing work", async () => {
  expect((await invoke("?week=0", "wrong")).status).toBe(401);
  for (const q of ["", "?week=4", "?week=-1", "?week=0&week=1", "?week=0&extra=1"])
    expect((await invoke(q)).status).toBe(400);
  expect(mocks.run).not.toHaveBeenCalled();
  expect(mocks.collection).not.toHaveBeenCalled();
});
it("stays disabled without opt-in and skips dates before the prospective cutover", async () => {
  mocks.env.ZENDESK_INBOUND_REPORT_RELEASE = undefined;
  expect(await (await invoke()).json()).toEqual({ enabled: false });
  mocks.env.ZENDESK_INBOUND_REPORT_RELEASE = JSON.stringify(inboundPublicationFixture().release);
  expect(await (await invoke("?week=1")).json()).toMatchObject({
    skipped: "before_prospective_cutover",
  });
  expect(mocks.run).not.toHaveBeenCalled();
  expect(mocks.collection).not.toHaveBeenCalled();
});
it("requires valid release evidence, account binding and collection; never falls back", async () => {
  for (const value of [
    "{}",
    "not-json",
    JSON.stringify({ ...inboundPublicationFixture().release, releaseEvidenceSha256: "" }),
  ]) {
    mocks.env.ZENDESK_INBOUND_REPORT_RELEASE = value;
    expect((await invoke()).status).toBe(503);
  }
  const release = inboundPublicationFixture().release;
  release.policy.accountReference = "zendesk-account:foreign";
  mocks.env.ZENDESK_INBOUND_REPORT_RELEASE = JSON.stringify(release);
  expect((await invoke()).status).toBe(503);
  expect(mocks.run).not.toHaveBeenCalled();
});
it("reports publication failure instead of a false success and honors source cooldown", async () => {
  expect((await invoke()).status).toBe(200);
  mocks.run.mockResolvedValue({ success: false, valuesWritten: 0 });
  expect((await invoke()).status).toBe(503);
  mocks.limited.mockResolvedValue(true);
  expect((await invoke()).status).toBe(429);
  mocks.collection.mockReturnValue(null);
  expect((await invoke()).status).toBe(503);
});

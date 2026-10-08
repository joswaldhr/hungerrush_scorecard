// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  env: {
    CRON_SECRET: "synthetic-secret" as string | undefined,
    ZENDESK_SUBDOMAIN: "synthetic",
    ZENDESK_POS_INBOUND_RELEASE: undefined as string | undefined,
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
vi.mock("@/lib/connectors/zendesk-pos-inbound-publisher", () => ({
  createLivePosInboundPublisher: mocks.factory,
}));
vi.mock("@/lib/connectors/sync-engine", () => ({ runSync: mocks.run }));
vi.mock("@/lib/rate-limit", () => ({ isSyncRateLimited: mocks.limited }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { GET } from "@/app/api/cron/pos-inbound/route";
import { posInboundPublicationFixture } from "./fixtures/pos-inbound-publication";
const invoke = (query = "?week=0", secret = "synthetic-secret") =>
  GET(
    new Request(`https://synthetic.test/api/cron/pos-inbound${query}`, {
      headers: { authorization: `Bearer ${secret}` },
    })
  );
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T23:59:59Z"));
  mocks.env.CRON_SECRET = "synthetic-secret";
  mocks.env.ZENDESK_POS_INBOUND_RELEASE = JSON.stringify(posInboundPublicationFixture().release);
  mocks.collection.mockReturnValue({});
  mocks.factory.mockReturnValue({ sourceType: "zendesk", supportsFixedPeriod: true });
  mocks.run.mockResolvedValue({ success: true, valuesWritten: 7 });
  mocks.limited.mockResolvedValue(false);
});
afterEach(() => vi.useRealTimers());

it("authenticates before parsing or performing any source work", async () => {
  expect((await invoke("?week=0", "wrong")).status).toBe(401);
  mocks.env.CRON_SECRET = undefined;
  expect((await invoke()).status).toBe(503);
  expect(mocks.collection).not.toHaveBeenCalled();
  expect(mocks.factory).not.toHaveBeenCalled();
  expect(mocks.run).not.toHaveBeenCalled();
});
it("rejects missing, duplicate, additional and invalid query parameters", async () => {
  for (const q of ["", "?week=4", "?week=-1", "?week=01", "?week=0&week=1", "?week=0&extra=1"])
    expect((await invoke(q)).status).toBe(400);
  expect(mocks.collection).not.toHaveBeenCalled();
  expect(mocks.run).not.toHaveBeenCalled();
});
it("stays off without its separate release and skips weeks before cutover", async () => {
  mocks.env.ZENDESK_POS_INBOUND_RELEASE = undefined;
  expect(await (await invoke()).json()).toEqual({ enabled: false });
  mocks.env.ZENDESK_POS_INBOUND_RELEASE = JSON.stringify(posInboundPublicationFixture().release);
  expect(await (await invoke("?week=2")).json()).toMatchObject({
    skipped: "before_prospective_cutover",
    periodStart: "2026-09-20",
    periodEnd: "2026-09-26",
  });
  expect(mocks.collection).not.toHaveBeenCalled();
  expect(mocks.run).not.toHaveBeenCalled();
});
it("fails closed on invalid evidence, foreign accounts and absent or mismatched collection", async () => {
  const release = posInboundPublicationFixture().release;
  for (const raw of [
    "{}",
    "not-json",
    JSON.stringify({ ...release, releaseEvidenceSha256: "" }),
    JSON.stringify({
      ...release,
      policy: { ...release.policy, accountReference: "zendesk-account:foreign" },
    }),
  ]) {
    mocks.env.ZENDESK_POS_INBOUND_RELEASE = raw;
    expect((await invoke()).status).toBe(503);
  }
  mocks.env.ZENDESK_POS_INBOUND_RELEASE = JSON.stringify(release);
  mocks.collection.mockReturnValue(null);
  expect((await invoke()).status).toBe(503);
  mocks.collection.mockReturnValue({});
  mocks.factory.mockImplementation(() => {
    throw Error("Mismatched source");
  });
  expect((await invoke()).status).toBe(503);
  expect(mocks.run).not.toHaveBeenCalled();
});
it("preserves resolved dates across a Sunday rollover during cooldown checks", async () => {
  mocks.limited.mockImplementation(async () => {
    vi.setSystemTime(new Date("2026-10-11T00:00:01Z"));
    return false;
  });
  const response = await invoke();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    periodStart: "2026-10-04",
    periodEnd: "2026-10-10",
  });
  expect(mocks.run.mock.calls[0]![2]).toEqual({
    period: { periodStart: "2026-10-04", periodEnd: "2026-10-10" },
  });
});
it("reports failed or busy publication honestly and honors source cooldown", async () => {
  mocks.run.mockResolvedValue({ success: false, valuesWritten: 0, skipped: true });
  expect((await invoke()).status).toBe(503);
  mocks.run.mockClear();
  mocks.limited.mockResolvedValue(true);
  expect((await invoke()).status).toBe(429);
  expect(mocks.run).not.toHaveBeenCalled();
});

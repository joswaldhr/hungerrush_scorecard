// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  policy: vi.fn(),
  run: vi.fn(),
  reader: vi.fn(),
  env: { CRON_SECRET: "synthetic-secret" as string | undefined },
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@/lib/connectors/zendesk-talk-config", () => ({
  configuredTalkCollectionPolicy: mocks.policy,
}));
vi.mock("@/lib/connectors/zendesk-talk-worker", () => ({
  runTalkCollectionBatch: mocks.run,
  createTalkExportReader: mocks.reader,
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
import { GET } from "@/app/api/cron/talk-collect/route";
const scope = {
  organizationId: "org",
  dataSourceId: "source",
  accountReference: "zendesk-account:synthetic",
};
const read = vi.fn();
const invoke = (query = "", secret = "synthetic-secret") =>
  GET(
    new Request(`https://synthetic.test/api/cron/talk-collect${query}`, {
      headers: { authorization: `Bearer ${secret}` },
    })
  );
beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.CRON_SECRET = "synthetic-secret";
  mocks.policy.mockReturnValue({ scope, bootstrapStart: 1000 });
  mocks.reader.mockReturnValue(read);
  mocks.run.mockResolvedValue({
    status: "collected",
    pages: 2,
    callsExhausted: true,
    legsExhausted: true,
  });
});
it("rejects unauthenticated requests and unexpected controls before reading configuration", async () => {
  expect((await invoke("", "bad")).status).toBe(401);
  expect(mocks.policy).not.toHaveBeenCalled();
  for (const query of ["?probe=health", "?bootstrap=0", "?week=0"])
    expect((await invoke(query)).status).toBe(400);
  mocks.env.CRON_SECRET = undefined;
  expect((await invoke()).status).toBe(503);
  expect(mocks.run).not.toHaveBeenCalled();
});
it("does not access credentials, source or persistence when disabled or misconfigured", async () => {
  mocks.policy.mockReturnValue(null);
  expect(await (await invoke()).json()).toEqual({ enabled: false });
  mocks.policy.mockImplementation(() => {
    throw Error("bad policy");
  });
  expect((await invoke()).status).toBe(503);
  expect(mocks.reader).not.toHaveBeenCalled();
  expect(mocks.run).not.toHaveBeenCalled();
});
it("distinguishes complete streams, partial collection, account contention and vendor delays", async () => {
  expect(await (await invoke()).json()).toMatchObject({
    metricsPublished: false,
    joinedMetricCoverageCertified: false,
  });
  expect(mocks.run).toHaveBeenCalledWith(scope, 1000, read);
  mocks.run.mockResolvedValue({ status: "collected", callsExhausted: true, legsExhausted: false });
  expect((await invoke()).status).toBe(202);
  mocks.run.mockResolvedValue({ status: "busy", pages: 0 });
  expect((await invoke()).status).toBe(409);
  for (const status of ["waiting", "rate_limited"]) {
    mocks.run.mockResolvedValue({ status, pages: 0, waitMs: 6300 });
    const response = await invoke();
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("7");
    expect(await response.json()).toMatchObject({ metricsPublished: false });
  }
  mocks.run.mockRejectedValue(new Error("synthetic failure"));
  expect((await invoke()).status).toBe(503);
});

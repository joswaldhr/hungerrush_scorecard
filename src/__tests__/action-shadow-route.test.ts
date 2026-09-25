// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  next: vi.fn(),
  run: vi.fn(),
  claim: vi.fn(),
  release: vi.fn(),
  health: vi.fn(),
  env: {
    CRON_SECRET: "fixture",
    ACTION_SHADOW_SECRET: undefined as string | undefined,
    ACTION_SHADOW_SOURCE_ID: undefined as string | undefined,
    ZENDESK_SUBDOMAIN: "synthetic",
    ZENDESK_EMAIL: "fixture@example.test",
    ZENDESK_API_KEY: "fixture",
  },
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@/lib/connectors/action-shadow-lease", () => ({
  claimActionShadowLease: mocks.claim,
  releaseActionShadowLease: mocks.release,
}));
vi.mock("@/lib/db", () => ({ db: { select: mocks.select } }));
vi.mock("@/lib/connectors/action-shadow-health", () => ({ readActionShadowHealth: mocks.health }));
vi.mock("@/lib/connectors/action-shadow-worker", () => ({
  nextActionShadowScope: mocks.next,
  runActionShadowBatch: mocks.run,
}));
import { GET } from "@/app/api/cron/action-shadow/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.ACTION_SHADOW_SOURCE_ID = undefined;
  mocks.env.ACTION_SHADOW_SECRET = undefined;
  mocks.env.ZENDESK_EMAIL = "fixture@example.test";
  mocks.env.ZENDESK_API_KEY = "fixture";
  mocks.claim.mockResolvedValue({ acquired: true, token: "fixture-token" });
  mocks.release.mockResolvedValue(undefined);
});
const request = (token = "fixture") =>
  new Request("https://test.invalid/api/cron/action-shadow", {
    headers: { authorization: `Bearer ${token}` },
  });
it("rejects unauthorized triggers before database access", async () => {
  expect((await GET(request("wrong"))).status).toBe(401);
  expect(mocks.select).not.toHaveBeenCalled();
});
it("does no work without an explicit source opt-in", async () => {
  expect(await (await GET(request())).json()).toEqual({ enabled: false });
  expect(mocks.select).not.toHaveBeenCalled();
});
it("authenticates an explicit probe without source work even when ingestion is configured", async () => {
  mocks.env.ACTION_SHADOW_SOURCE_ID = "source";
  const probe = (token: string) =>
    new Request("https://test.invalid/api/cron/action-shadow?probe=auth", {
      headers: { authorization: `Bearer ${token}` },
    });
  expect((await GET(probe("wrong"))).status).toBe(401);
  expect(await (await GET(probe("fixture"))).json()).toEqual({
    authenticated: true,
    ingestionRequested: false,
  });
  expect(mocks.select).not.toHaveBeenCalled();
  expect(mocks.claim).not.toHaveBeenCalled();
  expect(mocks.run).not.toHaveBeenCalled();
});

it("rejects unknown probes rather than starting ingestion", async () => {
  mocks.env.ACTION_SHADOW_SOURCE_ID = "source";
  const response = await GET(
    new Request("https://test.invalid/api/cron/action-shadow?probe=typo", {
      headers: { authorization: "Bearer fixture" },
    })
  );
  expect(response.status).toBe(400);
  expect(mocks.select).not.toHaveBeenCalled();
  expect(mocks.run).not.toHaveBeenCalled();
});

it.each(["configured", "disabled"])(
  "reads %s checkpoint health without vendor credentials, leases or ingestion",
  async (status) => {
    mocks.env.ACTION_SHADOW_SOURCE_ID = "source";
    mocks.env.ZENDESK_EMAIL = "";
    mocks.env.ZENDESK_API_KEY = "";
    mocks.select.mockReturnValue({
      from: () => ({
        where: async () => [
          {
            id: "source",
            organizationId: "org",
            type: "zendesk",
            status,
            configurationReference: "zendesk-account:synthetic",
          },
        ],
      }),
    });
    const healthStatus = status === "disabled" ? "disabled" : "pending";
    mocks.health.mockResolvedValue({ status: healthStatus, publicationVerified: false });
    const response = await GET(
      new Request("https://test.invalid/api/cron/action-shadow?probe=health", {
        headers: { authorization: "Bearer fixture" },
      })
    );
    expect(await response.json()).toEqual({
      enabled: status === "configured",
      ingestionRequested: false,
      health: { status: healthStatus, publicationVerified: false },
    });
    expect(mocks.health).toHaveBeenCalledWith("org", "source", "zendesk-account:synthetic");
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  }
);
it.each(["disabled", "retired", "unknown"])(
  "refuses a %s shadow source before taking a lease",
  async (status) => {
    mocks.env.ACTION_SHADOW_SOURCE_ID = "source";
    mocks.select.mockReturnValue({
      from: () => ({
        where: async () => [
          {
            id: "source",
            organizationId: "org",
            type: "zendesk",
            configurationReference: "zendesk-account:synthetic",
            status,
          },
        ],
      }),
    });
    expect((await GET(request())).status).toBe(503);
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.next).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  }
);

it("accepts only the dedicated scheduler credential when configured", async () => {
  mocks.env.ACTION_SHADOW_SECRET = "dedicated-fixture-secret";
  expect((await GET(request())).status).toBe(401);
  expect(await (await GET(request("dedicated-fixture-secret"))).json()).toEqual({ enabled: false });
  expect(mocks.select).not.toHaveBeenCalled();
});
it.each([null, "zendesk-account:another"])(
  "rejects source account binding %s before lease or vendor work",
  async (configurationReference) => {
    mocks.env.ACTION_SHADOW_SOURCE_ID = "source";
    mocks.select.mockReturnValue({
      from: () => ({
        where: async () => [
          {
            id: "source",
            organizationId: "org",
            type: "zendesk",
            status: "configured",
            configurationReference,
          },
        ],
      }),
    });
    expect((await GET(request())).status).toBe(503);
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  }
);
it("uses only the configured source's organization and a bounded worker", async () => {
  mocks.env.ACTION_SHADOW_SOURCE_ID = "source";
  mocks.select.mockReturnValue({
    from: () => ({
      where: async () => [
        {
          id: "source",
          organizationId: "org",
          status: "configured",
          type: "zendesk",
          configurationReference: "zendesk-account:synthetic",
        },
      ],
    }),
  });
  mocks.next.mockResolvedValue({ dataSourceId: "source", organizationId: "org" });
  mocks.run.mockResolvedValue({ completed: false, steps: 6 });
  expect(await (await GET(request())).json()).toMatchObject({
    enabled: true,
    completed: false,
    steps: 6,
  });
  expect(mocks.next).toHaveBeenCalledWith("org", "source");
  expect(mocks.run).toHaveBeenCalledWith(
    {
      organizationId: "org",
      dataSourceId: "source",
      workerLeaseToken: "fixture-token",
      workerAccountReference: "zendesk-account:synthetic",
    },
    expect.any(Function)
  );
  expect(mocks.release).toHaveBeenCalledWith("source", "fixture-token");
});

it("does not start vendor work when another invocation owns the lease", async () => {
  mocks.env.ACTION_SHADOW_SOURCE_ID = "source";
  mocks.select.mockReturnValue({
    from: () => ({
      where: async () => [
        {
          id: "source",
          organizationId: "org",
          status: "configured",
          type: "zendesk",
          configurationReference: "zendesk-account:synthetic",
        },
      ],
    }),
  });
  mocks.claim.mockResolvedValue({ acquired: false, retryAt: "2026-09-24T14:00:00.000Z" });
  expect(await (await GET(request())).json()).toMatchObject({ busy: true });
  expect(mocks.next).not.toHaveBeenCalled();
  expect(mocks.run).not.toHaveBeenCalled();
  expect(mocks.release).not.toHaveBeenCalled();
});

it("releases the lease after worker failure", async () => {
  mocks.env.ACTION_SHADOW_SOURCE_ID = "source";
  mocks.select.mockReturnValue({
    from: () => ({
      where: async () => [
        {
          id: "source",
          organizationId: "org",
          status: "configured",
          type: "zendesk",
          configurationReference: "zendesk-account:synthetic",
        },
      ],
    }),
  });
  mocks.run.mockRejectedValue(new Error("Synthetic worker failure"));
  expect((await GET(request())).status).toBe(503);
  expect(mocks.release).toHaveBeenCalledWith("source", "fixture-token");
});

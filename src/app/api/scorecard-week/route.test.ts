import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  context: vi.fn(),
  employees: vi.fn(),
  metrics: vi.fn(),
  info: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { info: mocks.info } }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/auth/authorization", () => ({
  getEffectiveManagerContext: mocks.context,
  getAssignedEmployees: mocks.employees,
}));
vi.mock("@/lib/domain/metrics/queries", () => ({ getEmployeeMetrics: mocks.metrics }));
import { GET } from "./route";
const id = "11111111-1111-4111-8111-111111111111";
const ctx = { organizationId: "synthetic-org", userId: "synthetic-manager" };
const request = (query = `employeeId=${id}&week=2026-09-20`) =>
  new Request(`https://cadence.example/api/scorecard-week?${query}`);
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
  mocks.auth.mockResolvedValue({ user: { email: "manager@example.test" } });
  mocks.context.mockResolvedValue({ ctx });
  mocks.employees.mockResolvedValue([{ id, primaryTeamId: "authorized-team" }]);
  mocks.metrics.mockResolvedValue([
    { currentValue: 0, dataFreshnessAt: new Date("2026-09-27T01:00:00Z") },
  ]);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("authorized scorecard week reads", () => {
  it("derives the team from authorized employee scope and never caches the response", async () => {
    const result = await GET(request(`employeeId=${id}&week=2026-09-20&teamId=foreign-team`));
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.metrics).toHaveBeenCalledWith(
      ctx,
      id,
      "authorized-team",
      "2026-09-20",
      "2026-09-13"
    );
    expect(await result.json()).toEqual({
      periodStart: "2026-09-20",
      rows: [{ currentValue: 0, dataFreshnessAt: "2026-09-27T01:00:00.000Z" }],
    });
  });
  it.each(["", "&week=invalid", "&week=2026-02-30", "&week=2027-01-01"])(
    "falls back to last week for absent/invalid/future date %s",
    async (week) => {
      expect((await GET(request(`employeeId=${id}${week}`))).status).toBe(200);
      expect(mocks.metrics).toHaveBeenLastCalledWith(
        ctx,
        id,
        "authorized-team",
        "2026-09-20",
        "2026-09-13"
      );
    }
  );
  it("retains explicit current and normalized older weeks", async () => {
    await GET(request(`employeeId=${id}&week=2026-09-28`));
    expect(mocks.metrics).toHaveBeenLastCalledWith(
      ctx,
      id,
      "authorized-team",
      "2026-09-27",
      "2026-09-20"
    );
    await GET(request(`employeeId=${id}&week=2026-09-15`));
    expect(mocks.metrics).toHaveBeenLastCalledWith(
      ctx,
      id,
      "authorized-team",
      "2026-09-13",
      "2026-09-06"
    );
  });
  it("rejects unauthenticated and unauthorized reads before employee or metric access", async () => {
    mocks.auth.mockResolvedValueOnce(null);
    expect((await GET(request())).status).toBe(401);
    mocks.context.mockResolvedValueOnce({ ctx: null });
    expect((await GET(request())).status).toBe(403);
    expect(mocks.employees).not.toHaveBeenCalled();
    expect(mocks.metrics).not.toHaveBeenCalled();
  });
  it("rejects malformed, out-of-scope and teamless employees without metric reads", async () => {
    expect((await GET(request("employeeId=invalid"))).status).toBe(400);
    mocks.employees.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id, primaryTeamId: null }]);
    expect((await GET(request())).status).toBe(404);
    expect((await GET(request())).status).toBe(404);
    expect(mocks.metrics).not.toHaveBeenCalled();
  });
  it("keeps internal failure details out of the response", async () => {
    mocks.metrics.mockRejectedValue(new Error("private SQL and parameters"));
    const result = await GET(request());
    expect(result.status).toBe(500);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(await result.text()).not.toContain("private SQL");
  });
});

it("returns only bounded numeric phase timings for an authenticated request", async () => {
  const response = await GET(request());
  const timing = response.headers.get("server-timing")!;
  expect(timing.split(", ").map((part) => part.split(";")[0])).toEqual([
    "auth",
    "context",
    "employee",
    "metrics",
  ]);
  for (const part of timing.split(", ")) {
    expect(part).toMatch(/^(auth|context|employee|metrics);dur=\d+\.\d$/);
    expect(Number(part.split("=")[1])).toBeLessThanOrEqual(30_000);
  }
  expect(timing).not.toContain(id);
  expect(timing).not.toContain("synthetic");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});

it("does not expose timings before authentication and only records phases actually attempted", async () => {
  mocks.auth.mockResolvedValueOnce(null);
  const unauthenticated = await GET(request());
  expect(unauthenticated.headers.has("server-timing")).toBe(false);
  mocks.context.mockResolvedValueOnce({ ctx: null });
  const forbidden = await GET(request());
  expect(forbidden.status).toBe(403);
  expect(forbidden.headers.get("server-timing")).toMatch(/^auth;dur=\d+\.\d, context;dur=\d+\.\d$/);
  mocks.metrics.mockRejectedValueOnce(new Error("private driver data"));
  const failed = await GET(request());
  expect(failed.status).toBe(500);
  expect(failed.headers.get("server-timing")).toMatch(/metrics;dur=\d+\.\d$/);
  expect(failed.headers.get("server-timing")).not.toContain("private driver data");
});

it("does not log unauthenticated or fast reads", async () => {
  const clock = vi.spyOn(performance, "now");
  clock.mockReturnValueOnce(0).mockReturnValueOnce(2_000);
  mocks.auth.mockResolvedValueOnce(null);
  expect((await GET(request())).status).toBe(401);
  expect(mocks.info).not.toHaveBeenCalled();
  clock.mockReset().mockReturnValue(100);
  expect((await GET(request())).status).toBe(200);
  expect(mocks.info).not.toHaveBeenCalled();
});

it("logs a slow authenticated read once with only bounded numeric phases and status", async () => {
  vi.spyOn(performance, "now")
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(25)
    .mockReturnValueOnce(25)
    .mockReturnValueOnce(625)
    .mockReturnValueOnce(625)
    .mockReturnValueOnce(700)
    .mockReturnValueOnce(700)
    .mockReturnValueOnce(1_100);
  const response = await GET(request());
  expect(mocks.info).toHaveBeenCalledExactlyOnceWith("Slow scorecard week read", {
    timings: { auth: 25, context: 600, employee: 75, metrics: 400 },
    status: 200,
  });
  expect(response.headers.get("server-timing")).toBe(
    "auth;dur=25.0, context;dur=600.0, employee;dur=75.0, metrics;dur=400.0"
  );
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});

it("logs failed slow reads without error text, IDs or payloads", async () => {
  vi.spyOn(performance, "now")
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(1_000);
  mocks.metrics.mockRejectedValueOnce(new Error("private SQL"));
  expect((await GET(request())).status).toBe(500);
  expect(mocks.info).toHaveBeenCalledExactlyOnceWith("Slow scorecard week read", {
    timings: { auth: 0, context: 0, employee: 0, metrics: 1_000 },
    status: 500,
  });
});

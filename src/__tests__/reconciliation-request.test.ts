import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ run: vi.fn(), limited: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { email: "manager@example.test" } }) }));
vi.mock("@/lib/auth/authorization", () => ({
  getEffectiveManagerContext: async () => ({
    ctx: { organizationId: "org", userId: "manager", assignedEmployeeIds: [] },
  }),
}));
vi.mock("@/lib/domain/reconciliation", () => ({ runReconciliation: mocks.run }));
vi.mock("@/lib/rate-limit", () => ({ isReconciliationRateLimited: mocks.limited }));
import { POST } from "@/app/api/reconciliation/run/route";
const valid = { periodStart: "2024-02-29", periodEnd: "2024-03-06" };
const post = (body: unknown) =>
  POST(
    new Request("https://cadence.test/api/reconciliation/run", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.limited.mockResolvedValue(false);
  mocks.run.mockResolvedValue({ totalComparisons: 0 });
});
it.each([
  { periodStart: "2026-02-29" },
  { periodStart: "2024-02-30" },
  { periodStart: "2024-13-01" },
  { periodStart: "2024-03-07" },
  { periodStart: "2024-2-29" },
  { teamId: "not-a-uuid" },
  { thresholdPct: 101 },
])("rejects invalid requests before claiming work: %j", async (invalid) => {
  expect((await post({ ...valid, ...invalid })).status).toBe(400);
  expect(mocks.run).not.toHaveBeenCalled();
  expect(mocks.limited).not.toHaveBeenCalled();
});
it("preserves a valid leap-day legacy interval without normalizing it to Sunday", async () => {
  expect((await post(valid)).status).toBe(200);
  expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining(valid));
});

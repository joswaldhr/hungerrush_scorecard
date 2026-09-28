import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const session = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ auth: session }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not-found");
  },
  redirect: () => {
    throw new Error("sign-in");
  },
}));
import { getDemoWeekMetrics } from "@/app/demo/one-on-ones/[id]/actions";
describe("demo server action authorization", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.stubEnv("CADENCE_DEMO_ENABLED", "true");
    vi.stubEnv("CADENCE_DEMO_ALLOWED_EMAILS", "presenter@example.test");
    vi.stubEnv("VERCEL_ENV", "preview");
    session.mockResolvedValue({ user: { email: "presenter@example.test" } });
  });
  it("rechecks the session on every call and never accepts a client-selected real employee", async () => {
    expect(await getDemoWeekMetrics("demo-01", "2026-09-20")).toHaveLength(22);
    session.mockResolvedValue({ user: { email: "other@example.test" } });
    await expect(getDemoWeekMetrics("demo-01", "2026-09-20")).rejects.toThrow("not-found");
    session.mockResolvedValue({ user: { email: "presenter@example.test" } });
    await expect(getDemoWeekMetrics("real-employee", "2026-09-20")).rejects.toThrow("Unknown demo");
  });
  it("refuses anonymous, disabled and production access", async () => {
    session.mockResolvedValue(null);
    await expect(getDemoWeekMetrics("demo-01", "2026-09-20")).rejects.toThrow("sign-in");
    session.mockResolvedValue({ user: { email: "presenter@example.test" } });
    vi.stubEnv("CADENCE_DEMO_ENABLED", "false");
    await expect(getDemoWeekMetrics("demo-01", "2026-09-20")).rejects.toThrow("not-found");
    vi.stubEnv("CADENCE_DEMO_ENABLED", "true");
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(getDemoWeekMetrics("demo-01", "2026-09-20")).rejects.toThrow("not-found");
  });
});

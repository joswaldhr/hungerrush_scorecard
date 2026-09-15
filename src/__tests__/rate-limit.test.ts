import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/db/schema", () => ({
  syncRuns: { id: "syncRuns.id", dataSourceId: "syncRuns.dataSourceId" },
  reconciliationRuns: {
    id: "reconciliationRuns.id",
    organizationId: "reconciliationRuns.organizationId",
  },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn(), gte: vi.fn() }));

import { isSyncRateLimited, isReconciliationRateLimited } from "@/lib/rate-limit";

function setupSelect(rows: unknown[]) {
  mockDb.select.mockImplementation(() => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
      }),
    }),
  }));
}

describe("isSyncRateLimited", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when a recent sync run exists", async () => {
    setupSelect([{ id: "recent-run-id" }]);
    expect(await isSyncRateLimited("ds-1")).toBe(true);
  });

  it("returns false when no recent sync run exists", async () => {
    setupSelect([]);
    expect(await isSyncRateLimited("ds-1")).toBe(false);
  });
});

describe("isReconciliationRateLimited", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when a recent reconciliation run exists", async () => {
    setupSelect([{ id: "recent-recon-id" }]);
    expect(await isReconciliationRateLimited("org-1")).toBe(true);
  });

  it("returns false when no recent reconciliation run exists", async () => {
    setupSelect([]);
    expect(await isReconciliationRateLimited("org-1")).toBe(false);
  });
});

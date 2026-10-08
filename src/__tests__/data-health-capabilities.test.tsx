import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import type { RecoveryHealth } from "@/lib/domain/metrics/report-recovery-health";
const state = vi.hoisted(() => ({
  sourceStatus: "configured",
  run: null as Record<string, unknown> | null,
  refresh: vi.fn(),
  recovery: { state: "not_configured", rows: [] } as RecoveryHealth,
}));
beforeEach(() => {
  state.sourceStatus = "configured";
  state.run = null;
  state.refresh.mockClear();
  state.recovery = { state: "not_configured", rows: [] };
});
vi.mock("@/lib/auth", () => ({
  auth: async () => ({ user: { email: "synthetic@example.invalid" } }),
}));
vi.mock("@/lib/domain/metrics/report-recovery-health", () => ({
  getReportRecoveryHealth: async () => state.recovery,
}));
vi.mock("@/lib/domain/roster/manager-archive", () => ({ getManagerArchives: async () => [] }));
vi.mock("@/lib/auth/authorization", () => ({
  getEffectiveManagerContext: async () => ({
    ctx: { organizationId: "org", assignedTeamIds: ["synthetic-team"], assignedEmployeeIds: [] },
    isPlatformAdmin: false,
  }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () =>
          Object.assign(
            Promise.resolve(
              ["zendesk", "assembled", "entra", "unsupported-synthetic"].map((type) => ({
                id: type,
                type,
                displayName: type,
                status: state.sourceStatus,
                lastSuccessfulSyncAt: null,
              }))
            ),
            {
              orderBy: () => ({ limit: async () => (state.run ? [state.run] : []) }),
              limit: async () => [],
            }
          ),
      }),
    }),
  },
}));
vi.mock("@/app/(app)/data-health/actions", () => ({
  SyncNowButton: ({ dataSourceType }: { dataSourceType: string }) => (
    <button>Sync {dataSourceType}</button>
  ),
}));
vi.mock("@/app/(app)/data-health/auto-refresh", () => ({
  AutoRefresh: ({ active }: { active: boolean }) => {
    state.refresh(active);
    return null;
  },
}));
import DataHealthPage from "@/app/(app)/data-health/page";

it("offers sync only for the shipped connector and labels retired/unsupported sources honestly", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    const page = await DataHealthPage();
    await act(async () => root.render(page));
    expect(
      Array.from(container.querySelectorAll("button")).map((button) => button.textContent)
    ).toEqual(["Sync zendesk"]);
    expect(container.textContent).toContain("Retired");
    expect(container.textContent).toContain("Not supported");
    expect(container.textContent).toContain("Directory checks are not configured");
    expect(container.textContent).not.toContain("employees checked");
    expect(container.textContent).not.toContain("flagged as disabled");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it.each(["disabled", "configured"])(
  "does not keep polling an expired job (%s source)",
  async (sourceStatus) => {
    state.sourceStatus = sourceStatus;
    state.run = {
      id: "run",
      status: "running",
      startedAt: new Date("2020-01-01T00:00:00Z"),
      metadataJson: {},
      recordsIngested: 0,
      recordsNormalized: 0,
      recordsSkipped: 0,
      errorCount: 0,
    };
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(await DataHealthPage()));
      expect(state.refresh).toHaveBeenCalledWith(false);
      expect(container.textContent).not.toContain("Syncing");
      expect(container.textContent).toContain(
        sourceStatus === "disabled" ? "Disabled" : "Interrupted"
      );
      expect(container.querySelectorAll("button")).toHaveLength(
        sourceStatus === "disabled" ? 0 : 1
      );
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  }
);

it.each(["running", "interrupted", "failed", "complete"] as const)(
  "shows period recovery independently of the latest source run (%s)",
  async (status) => {
    state.run = {
      status: "completed",
      startedAt: new Date(),
      completedAt: new Date(),
      metadataJson: {},
      errorCount: 0,
    };
    state.recovery = {
      state: "enabled",
      rows: [
        {
          key: "synthetic",
          team: "Synthetic A",
          metric: "Tickets solved",
          periodStart: "2026-09-27",
          periodEnd: "2026-10-03",
          status,
          label: status,
          lastAttemptAt: "2026-10-08T12:00:00.000Z",
          retryAt: null,
        },
      ],
    };
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(await DataHealthPage()));
      expect(state.refresh).toHaveBeenCalledWith(status === "running");
      expect(container.textContent).toContain("2026-09-27 – 2026-10-03");
      expect(container.textContent).toContain("2026-10-08 12:00 UTC");
      expect(container.textContent).toContain("does not certify metric accuracy");
      expect(
        container
          .querySelector("[aria-label='Solved-ticket recovery requests']")
          ?.getAttribute("tabindex")
      ).toBe("0");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  }
);

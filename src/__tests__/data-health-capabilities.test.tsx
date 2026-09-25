import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  sourceStatus: "configured",
  run: null as Record<string, unknown> | null,
  refresh: vi.fn(),
}));
beforeEach(() => {
  state.sourceStatus = "configured";
  state.run = null;
  state.refresh.mockClear();
});
vi.mock("@/lib/auth", () => ({
  auth: async () => ({ user: { email: "synthetic@example.invalid" } }),
}));
vi.mock("@/lib/auth/authorization", () => ({
  getEffectiveManagerContext: async () => ({
    ctx: { organizationId: "org" },
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
              ["zendesk", "assembled", "entra"].map((type) => ({
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

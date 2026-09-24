import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
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
                lastSuccessfulSyncAt: null,
              }))
            ),
            { orderBy: () => ({ limit: async () => [] }) }
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
vi.mock("@/app/(app)/data-health/auto-refresh", () => ({ AutoRefresh: () => null }));
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

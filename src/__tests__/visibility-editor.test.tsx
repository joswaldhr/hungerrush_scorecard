import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VisibilityEditor } from "@/app/(app)/admin/metric-visibility/visibility-editor";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  count: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock("@/app/(app)/admin/metric-visibility/actions", () => ({
  setVisibilityOverrides: mocks.save,
  getManagerScorecardCount: mocks.count,
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: mocks.success } }));
let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  vi.resetAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <VisibilityEditor
        metrics={[{ id: "metric", name: "Synthetic metric", category: null }]}
        managers={[{ userId: "manager", displayName: "Synthetic manager" }]}
        employeesList={[{ id: "employee", displayName: "Synthetic employee" }]}
        menufyTeamId="menufy"
        posTeamId="pos"
      />
    )
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function choose(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

it("labels its controls and sends one atomic request for both brands and lines", async () => {
  const selects = container.querySelectorAll("select");
  expect(selects[0]).toHaveAccessibleName("Metric");
  expect(selects[1]).toHaveAccessibleName("Employee");
  const groups = container.querySelectorAll('[role="radiogroup"]');
  expect(groups[0]).toHaveAccessibleName("Scope");
  expect(groups[1]).toHaveAccessibleName("Brand");
  await choose(selects[0]!, "metric");
  await choose(selects[1]!, "employee");
  await act(async () => groups[1]!.querySelector<HTMLButtonElement>('[value="both"]')!.click());
  const lines = container.querySelectorAll('[role="radiogroup"]')[2]!;
  expect(lines).toHaveAccessibleName("Menufy line");
  await act(async () => lines.querySelector<HTMLButtonElement>('[value="both"]')!.click());
  const save = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Save"
  )!;
  expect(save).toBeEnabled();
  await act(async () => save.click());
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(mocks.save.mock.calls[0]![0]).toEqual([
    expect.objectContaining({ teamId: "menufy", line: "restaurant", targetEmployeeId: "employee" }),
    expect.objectContaining({ teamId: "menufy", line: "consumer", targetEmployeeId: "employee" }),
    expect.objectContaining({ teamId: "pos", line: null, targetEmployeeId: "employee" }),
  ]);
  expect(mocks.success).toHaveBeenCalledWith("Visibility updated");
});

it("keeps the selection and reports an uncertain save instead of claiming success", async () => {
  mocks.save.mockRejectedValue(new Error("Private transport detail"));
  const selects = container.querySelectorAll("select");
  await choose(selects[0]!, "metric");
  await choose(selects[1]!, "employee");
  await act(async () => container.querySelector<HTMLButtonElement>('[value="pos"]')!.click());
  const save = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Save"
  )!;
  await act(async () => save.click());
  expect(selects[0]!.value).toBe("metric");
  expect(selects[1]!.value).toBe("employee");
  expect(save).toBeEnabled();
  expect(mocks.success).not.toHaveBeenCalled();
  expect(mocks.error).toHaveBeenCalledWith(
    "Could not confirm that visibility changes were saved. Refresh before retrying."
  );
});

it("keeps manager scope fixed while loading the confirmation count", async () => {
  let resolveCount!: (count: number) => void;
  mocks.count.mockReturnValue(
    new Promise<number>((resolve) => {
      resolveCount = resolve;
    })
  );
  await choose(container.querySelector("select")!, "metric");
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[value="manager_override"]')!.click()
  );
  const manager = container.querySelectorAll("select")[1]!;
  expect(manager).toHaveAccessibleName("Manager");
  await choose(manager, "manager");
  await act(async () => container.querySelector<HTMLButtonElement>('[value="pos"]')!.click());
  const save = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Save"
  )!;
  await act(async () => save.click());
  expect(manager).toBeDisabled();
  expect(save).toHaveTextContent("Checking scope...");
  expect(mocks.save).not.toHaveBeenCalled();
  await act(async () => resolveCount(2));
  expect(document.querySelector('[role="dialog"]')).toHaveTextContent("2 scorecards");
});

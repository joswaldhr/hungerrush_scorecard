import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { OneOnOnesPicker, type PickerEmployee } from "@/components/one-on-ones-picker";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
function employee(
  id: string,
  line: string | null,
  primaryTeamId: string | null = "team"
): PickerEmployee {
  return { id, displayName: `Synthetic ${id}`, jobTitle: null, line, primaryTeamId };
}

it("renders every authorized employee exactly once across recognized and unexpected mappings", async () => {
  const employees = [
    employee("restaurant", "restaurant"),
    employee("consumer", "consumer"),
    employee("unexpected", "new-line"),
    employee("null-line", null),
    employee("unknown-team", "restaurant", "missing"),
    employee("no-team", null, null),
  ];
  await act(async () =>
    root.render(
      <OneOnOnesPicker teams={[{ id: "team", name: "Synthetic team" }]} employees={employees} />
    )
  );
  const hrefs = Array.from(container.querySelectorAll("a")).map((link) =>
    link.getAttribute("href")
  );
  expect(hrefs.sort()).toEqual(employees.map((person) => `/one-on-ones/${person.id}`).sort());
  expect(container.textContent).toContain("Unassigned team");
  expect(container.textContent).toContain("Other");
  expect(container.textContent).toContain("assignment review");
});

it("keeps unassigned employees visible even when there are no configured teams", async () => {
  await act(async () =>
    root.render(
      <OneOnOnesPicker teams={[]} employees={[employee("unassigned", "constructor", null)]} />
    )
  );
  expect(container.querySelector('a[href="/one-on-ones/unassigned"]')).not.toBeNull();
  expect(container.textContent).toContain("Unassigned team");
  expect(container.textContent).toContain("Other");
});

it("keeps an ordinary single-team roster flat without a mapping warning", async () => {
  await act(async () =>
    root.render(
      <OneOnOnesPicker
        teams={[{ id: "team", name: "Synthetic team" }]}
        employees={[employee("normal", null)]}
      />
    )
  );
  expect(container.querySelectorAll("a")).toHaveLength(1);
  expect(container.textContent).not.toContain("assignment review");
  expect(container.querySelector("h2, h3")).toBeNull();
});

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { WeekNavigator } from "@/components/week-navigator";
import { ScorecardExport } from "@/components/scorecard-export";

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
async function key(element: Element, value: string) {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true }));
  });
}

it("retains focus on week navigation and returns from the date picker with Escape", async () => {
  const navigate = vi.fn();
  await act(async () =>
    root.render(
      <WeekNavigator
        periodStart="2026-09-13"
        rangeLabel="Sep 13–19, 2026"
        weeksAgo={1}
        onNavigate={navigate}
      />
    )
  );
  const previous = container.querySelector<HTMLButtonElement>('[aria-label="Previous week"]')!;
  previous.focus();
  await act(async () => previous.click());
  expect(document.activeElement).toBe(previous);
  expect(navigate).toHaveBeenCalledWith("2026-09-06");
  const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Jump to a week"]')!;
  await act(async () => trigger.click());
  const date = container.querySelector<HTMLInputElement>('input[type="date"]')!;
  expect(document.activeElement).toBe(date);
  await key(date, "Escape");
  expect(container.querySelector('input[type="date"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

it("supports export menu arrow keys, Home/End and Escape focus return", async () => {
  await act(async () =>
    root.render(
      <ScorecardExport
        employeeName="Synthetic"
        periodLabel="Sep 13–19, 2026"
        previousPeriodLabel="Sep 6–12, 2026"
        metrics={[]}
      />
    )
  );
  const trigger = container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
  trigger.focus();
  await key(trigger, "ArrowDown");
  const items = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
  expect(document.activeElement).toBe(items[0]);
  await key(items[0]!, "ArrowUp");
  expect(document.activeElement).toBe(items.at(-1));
  await key(items.at(-1)!, "Home");
  expect(document.activeElement).toBe(items[0]);
  await key(items[0]!, "End");
  expect(document.activeElement).toBe(items.at(-1));
  await key(items.at(-1)!, "Escape");
  expect(container.querySelector('[role="menu"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  await key(trigger, "ArrowUp");
  expect(document.activeElement?.textContent).toBe("Print");
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  await act(async () => (document.activeElement as HTMLButtonElement).click());
  expect(print).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[role="menu"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  print.mockRestore();
});

it("closes the export menu when focus moves outside without stealing focus", async () => {
  await act(async () =>
    root.render(
      <>
        <ScorecardExport
          employeeName="Synthetic"
          periodLabel="Current"
          previousPeriodLabel="Previous"
          metrics={[]}
        />
        <button data-next>Next control</button>
      </>
    )
  );
  const trigger = container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
  await act(async () => trigger.click());
  const next = container.querySelector<HTMLButtonElement>("[data-next]")!;
  await act(async () => next.focus());
  expect(container.querySelector('[role="menu"]')).toBeNull();
  expect(document.activeElement).toBe(next);
});

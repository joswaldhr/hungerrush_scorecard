import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarClient } from "@/components/sidebar-client";

const state = vi.hoisted(() => ({ pathname: "/one-on-ones", theme: "light", setTheme: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("next/link", () => ({
  default: ({ onClick, ...props }: ComponentProps<"a">) => (
    <a
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    />
  ),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: state.theme, setTheme: state.setTheme }),
}));
let root: Root;
let container: HTMLDivElement;
let phone = false;
let narrow = false;
const listeners = new Map<string, (event: { matches: boolean }) => void>();
const props = {
  user: { name: "Synthetic Manager", email: "manager@example.test", jobTitle: "Support Manager" },
  primaryNav: [{ label: "1:1s", href: "/one-on-ones", iconName: "Calendar" }],
  secondaryNav: [
    { label: "Employees", href: "/admin/employees", iconName: "Users" },
    { label: "Admin", href: "/admin", iconName: "ShieldCheck" },
  ],
  signOutAction: vi.fn(async () => {}),
  brandLogo: <span>HungerRush</span>,
  brandIcon: <span>HR</span>,
};
async function render(overrides = {}) {
  await act(async () => {
    root.render(<SidebarClient {...props} {...overrides} />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}
async function click(label: string) {
  const element = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  expect(element).not.toBeNull();
  await act(async () => element.click());
  return element;
}
async function key(element: Element, key: string) {
  await act(async () =>
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))
  );
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.pathname = "/one-on-ones";
  state.theme = "light";
  state.setTheme.mockClear();
  phone = false;
  narrow = false;
  listeners.clear();
  localStorage.clear();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("767") ? phone : narrow,
    addEventListener: (_: string, fn: (event: { matches: boolean }) => void) =>
      listeners.set(query, fn),
    removeEventListener: vi.fn(),
  }));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("sidebar navigation", () => {
  it("keeps the employee journey active and identifies stored-period context without adding destinations", async () => {
    state.pathname = "/one-on-ones/synthetic/history";
    await render({ secondaryNav: [] });
    expect(container.querySelector('[aria-current="page"]')?.getAttribute("href")).toBe(
      "/one-on-ones"
    );
    expect(container.textContent).toContain("Stored reporting periods");
    expect(container.querySelectorAll("nav a")).toHaveLength(1);
    expect(container.textContent).not.toContain("Administration");
  });
  it("keeps the synthetic demo brand and route context inside the demo", async () => {
    state.pathname = "/demo/one-on-ones/synthetic";
    await render({
      brandHref: "/demo/one-on-ones",
      primaryNav: [{ label: "1:1s", href: "/demo/one-on-ones", iconName: "Calendar" }],
      secondaryNav: [],
    });
    expect(container.querySelector('a[aria-label^="Cadence"]')?.getAttribute("href")).toBe(
      "/demo/one-on-ones"
    );
    expect(container.textContent).toContain("Employee scorecard");
    expect(container.textContent).toContain("Choose an employee");
  });
  it("highlights only the most specific authorized admin destination", async () => {
    state.pathname = "/admin/employees/synthetic";
    await render();
    const active = container.querySelectorAll('[aria-current="page"]');
    expect(active).toHaveLength(1);
    expect(active[0]?.getAttribute("href")).toBe("/admin/employees");
  });
  it("does not activate a route with a similar prefix", async () => {
    state.pathname = "/one-on-ones-other";
    await render();
    expect(container.querySelector('[aria-current="page"]')).toBeNull();
  });
  it("persists desktop collapse while keeping icon links named", async () => {
    await render();
    await click("Collapse sidebar");
    expect(localStorage.getItem("sidebar-collapsed")).toBe("true");
    expect(container.querySelector('nav a[aria-label="1:1s"]')?.getAttribute("title")).toBe("1:1s");
    await click("Expand sidebar");
    expect(localStorage.getItem("sidebar-collapsed")).toBe("false");
  });
  it("opens a usable collapsed account disclosure and returns focus on Escape", async () => {
    narrow = true;
    await render();
    const trigger = await click("Account menu");
    const signOut = document.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(document.activeElement).toBe(signOut);
    expect(document.getElementById(trigger.getAttribute("aria-controls")!)?.textContent).toContain(
      "manager@example.test"
    );
    await key(signOut, "Escape");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
    expect(props.signOutAction).not.toHaveBeenCalled();
  });
  it("dismisses account disclosure on an outside pointer without signing out", async () => {
    await render();
    const trigger = await click("Account menu");
    await act(async () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
  it("opens mobile navigation as a modal without overwriting desktop preference", async () => {
    phone = true;
    narrow = true;
    localStorage.setItem("sidebar-collapsed", "false");
    await render();
    await click("Expand sidebar");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Choose an employee");
    expect(localStorage.getItem("sidebar-collapsed")).toBe("false");
    await click("Close navigation");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Expand sidebar");
  });
  it("dismisses mobile navigation with Escape and restores its trigger", async () => {
    phone = true;
    narrow = true;
    await render();
    await click("Expand sidebar");
    await key(document.querySelector('[role="dialog"]')!, "Escape");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Expand sidebar");
  });
  it("dismisses the account disclosure when keyboard focus leaves it", async () => {
    await render();
    const trigger = await click("Account menu");
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Switch to dark mode"]')!.focus();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
  it("closes mobile navigation after selecting a destination and labels the theme action", async () => {
    phone = true;
    narrow = true;
    await render();
    await click("Expand sidebar");
    await act(async () => {
      document.querySelector<HTMLAnchorElement>('[role="dialog"] nav a')!.click();
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await click("Switch to dark mode");
    expect(state.setTheme).toHaveBeenCalledWith("dark");
  });
});

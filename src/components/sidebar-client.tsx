"use client";

import { useState, useEffect, useRef, useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Users,
  Calendar,
  BarChart3,
  Activity,
  Scale,
  ShieldCheck,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  ChevronUp,
  ChevronRight,
  X,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Users,
  Calendar,
  BarChart3,
  Activity,
  Scale,
  ShieldCheck,
};
interface NavItem {
  label: string;
  href: string;
  iconName: string;
}
interface SidebarClientProps {
  user: { name?: string | null; email?: string | null; jobTitle?: string | null } | null;
  primaryNav: NavItem[];
  secondaryNav: NavItem[];
  signOutAction: () => Promise<void>;
  brandHref?: string;
  brandLogo: React.ReactNode;
  brandIcon: React.ReactNode;
}
const STORAGE_KEY = "sidebar-collapsed";
const focusStyle =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar-background";

export function SidebarClient({
  user,
  primaryNav,
  secondaryNav,
  signOutAction,
  brandLogo,
  brandIcon,
  brandHref = "/",
}: SidebarClientProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const signOutRef = useRef<HTMLButtonElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const accountId = useId();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 1279px)");
    const phone = window.matchMedia("(max-width: 767px)");
    let initialCollapsed = narrow.matches;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) initialCollapsed = stored === "true";
    } catch {}
    const frame = requestAnimationFrame(() => {
      setCollapsed(initialCollapsed);
      setMobile(phone.matches);
      setHydrated(true);
    });
    const onNarrow = (e: MediaQueryListEvent) => {
      if (e.matches) setCollapsed(true);
    };
    const onPhone = (e: MediaQueryListEvent) => {
      setMobile(e.matches);
      setMobileOpen(false);
      setUserMenuOpen(false);
    };
    narrow.addEventListener("change", onNarrow);
    phone.addEventListener("change", onPhone);
    return () => {
      cancelAnimationFrame(frame);
      narrow.removeEventListener("change", onNarrow);
      phone.removeEventListener("change", onPhone);
    };
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return;
    signOutRef.current?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [userMenuOpen]);

  function toggle() {
    setUserMenuOpen(false);
    if (mobile) {
      setMobileOpen(true);
      return;
    }
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {}
  }

  // Only the most specific supplied destination is active (e.g. Employees, not Admin too).
  const activeHref = [...primaryNav, ...secondaryNav]
    .filter(({ href }) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const employeeContext = /^\/(?:demo\/)?one-on-ones\/[^/]+(?:\/history)?\/?$/.test(pathname)
    ? pathname.endsWith("/history")
      ? pathname.startsWith("/demo/")
        ? "Demo reporting weeks"
        : "Stored reporting periods"
      : "Employee scorecard"
    : null;
  const dark = hydrated && resolvedTheme === "dark";

  function labelStyle(compact: boolean) {
    return cn(
      "overflow-hidden whitespace-nowrap motion-safe:transition-opacity motion-safe:duration-150",
      compact ? "invisible opacity-0" : "visible opacity-100"
    );
  }

  function navigation(items: NavItem[], compact: boolean, primary = false) {
    return items.map((item) => {
      const active = activeHref === item.href;
      const Icon = ICON_MAP[item.iconName];
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active ? "page" : undefined}
          aria-label={item.label}
          title={compact ? item.label : undefined}
          onClick={() => {
            setMobileOpen(false);
            setUserMenuOpen(false);
          }}
          className={cn(
            "group flex items-center overflow-hidden rounded-xl border text-sm transition-colors",
            focusStyle,
            primary ? "h-16" : "h-11",
            active
              ? "border-teal-300/25 bg-teal-300/10 text-white"
              : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
          )}
        >
          <span className="flex w-[46px] shrink-0 items-center justify-center" aria-hidden="true">
            {Icon && (
              <Icon
                className={cn(
                  "h-5 w-5",
                  active ? "text-teal-300" : "text-slate-400 group-hover:text-slate-200"
                )}
              />
            )}
          </span>
          <span
            aria-hidden={compact}
            className={cn("flex min-w-0 flex-1 items-center gap-2 pr-3", labelStyle(compact))}
          >
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate", active && "font-semibold")}>{item.label}</span>
              {primary && item.href.endsWith("/one-on-ones") && (
                <span className="mt-0.5 block truncate text-xs font-normal text-slate-300">
                  Choose an employee
                </span>
              )}
            </span>
            {active && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-teal-300" />}
          </span>
        </Link>
      );
    });
  }

  function contents(compact: boolean, drawer = false) {
    return (
      <>
        <div className="h-32 shrink-0 overflow-hidden border-b border-white/10">
          <Link
            href={brandHref}
            aria-label="Cadence — 1:1s"
            onClick={() => setMobileOpen(false)}
            className={cn("flex h-16 items-center rounded-md", focusStyle)}
          >
            <span className="flex w-16 shrink-0 items-center justify-center" aria-hidden="true">
              {brandIcon}
            </span>
            <span aria-hidden={compact} className={cn("pr-4", labelStyle(compact))}>
              {brandLogo}
            </span>
          </Link>
          <div className="flex h-12 items-center">
            <span className="flex w-16 shrink-0 items-center justify-center">
              <button
                ref={drawer ? undefined : expandRef}
                type="button"
                onClick={drawer ? () => setMobileOpen(false) : toggle}
                aria-label={
                  drawer ? "Close navigation" : compact ? "Expand sidebar" : "Collapse sidebar"
                }
                aria-expanded={drawer || !compact}
                title={
                  drawer ? "Close navigation" : compact ? "Expand sidebar" : "Collapse sidebar"
                }
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white",
                  focusStyle
                )}
              >
                {drawer ? (
                  <X className="h-4 w-4" />
                ) : compact ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            </span>
            <span
              aria-hidden={compact}
              className={cn(
                "text-xs font-semibold uppercase tracking-[0.22em] text-teal-200",
                labelStyle(compact)
              )}
            >
              Cadence
            </span>
          </div>
        </div>
        <nav
          className="min-h-0 flex-1 space-y-7 overflow-x-hidden overflow-y-auto px-2 py-5"
          aria-label="Main navigation"
        >
          <div className="space-y-2">
            <p
              aria-hidden={compact}
              className={cn(
                "h-4 pl-12 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400",
                labelStyle(compact)
              )}
            >
              Workspace
            </p>
            {navigation(primaryNav, compact, true)}
            {employeeContext && (
              <div
                aria-hidden={compact}
                className={cn(
                  "h-14 pl-12 py-2 text-xs leading-relaxed text-slate-300",
                  labelStyle(compact)
                )}
              >
                <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-400">
                  You are viewing
                </span>
                {employeeContext}
              </div>
            )}
          </div>
          {secondaryNav.length > 0 && (
            <div className="space-y-1">
              <p
                aria-hidden={compact}
                className={cn(
                  "mb-2 h-4 pl-12 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400",
                  labelStyle(compact)
                )}
              >
                Administration
              </p>
              {navigation(secondaryNav, compact)}
            </div>
          )}
        </nav>
        <div className="shrink-0 border-t border-white/10 bg-black/10 p-2">
          <button
            type="button"
            onClick={() => setTheme(dark ? "light" : "dark")}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            title={compact ? (dark ? "Switch to light mode" : "Switch to dark mode") : undefined}
            className={cn(
              "flex h-11 w-full items-center overflow-hidden rounded-lg text-xs text-slate-300 hover:bg-white/5 hover:text-white",
              focusStyle
            )}
          >
            <span className="flex w-12 shrink-0 items-center justify-center" aria-hidden="true">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </span>
            <span
              aria-hidden={compact}
              className={cn("flex min-w-0 flex-1 items-center gap-2 pr-3", labelStyle(compact))}
            >
              <span className="flex-1 text-left">Appearance</span>
              <span className="text-slate-400">{dark ? "Dark" : "Light"}</span>
            </span>
          </button>
          {user && (!mobileOpen || drawer) && (
            <div
              ref={accountRef}
              className="relative mt-1"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setUserMenuOpen(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && userMenuOpen) {
                  event.preventDefault();
                  event.stopPropagation();
                  setUserMenuOpen(false);
                  accountTrigger.current?.focus();
                }
              }}
            >
              <button
                ref={accountTrigger}
                type="button"
                aria-label="Account menu"
                aria-expanded={userMenuOpen}
                aria-controls={accountId}
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={cn(
                  "flex h-12 w-full items-center overflow-hidden rounded-xl text-left hover:bg-white/5",
                  focusStyle
                )}
              >
                <span className="flex w-12 shrink-0 items-center justify-center" aria-hidden="true">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-teal-200/20 bg-teal-300/10 text-xs font-semibold text-teal-200">
                    {user.name
                      ? initials(user.name)
                      : user.email
                        ? user.email[0]!.toUpperCase()
                        : "?"}
                  </span>
                </span>
                <span
                  aria-hidden={compact}
                  className={cn("flex min-w-0 flex-1 items-center gap-2 pr-3", labelStyle(compact))}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">
                      {user.name ?? user.email ?? "User"}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                      {user.jobTitle || "Account"}
                    </span>
                  </span>
                  <ChevronUp
                    className={cn("h-4 w-4 shrink-0 text-slate-400", userMenuOpen && "rotate-180")}
                  />
                </span>
              </button>
              {userMenuOpen && (
                <div
                  id={accountId}
                  className={cn(
                    "absolute bottom-full left-0 z-50 mb-2 rounded-xl border border-slate-600 bg-slate-900 p-2 shadow-xl",
                    compact ? "w-60" : "w-full"
                  )}
                >
                  <p className="break-words px-2 py-2 text-xs leading-relaxed text-slate-300">
                    {user.email}
                  </p>
                  <form action={signOutAction}>
                    <button
                      ref={signOutRef}
                      type="submit"
                      className={cn(
                        "flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-sm text-rose-300 hover:bg-white/5",
                        focusStyle
                      )}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <Dialog.Root
      open={mobileOpen}
      onOpenChange={(open) => {
        setMobileOpen(open);
        setUserMenuOpen(false);
      }}
    >
      <aside
        data-sidebar
        aria-label="Cadence sidebar"
        className={cn(
          "flex h-dvh shrink-0 flex-col border-r border-white/10 bg-sidebar-background text-sidebar-foreground motion-safe:transition-[width] motion-safe:duration-200 print:hidden",
          mobile || collapsed ? "w-16" : "w-[var(--sidebar-width)]"
        )}
      >
        {contents(mobile || collapsed)}
      </aside>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            expandRef.current?.focus();
          }}
          className="fixed inset-y-0 left-0 z-50 flex h-dvh w-72 max-w-[calc(100vw-3rem)] flex-col bg-sidebar-background text-sidebar-foreground shadow-2xl outline-none"
        >
          <Dialog.Title className="sr-only">Cadence navigation</Dialog.Title>
          {contents(false, true)}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

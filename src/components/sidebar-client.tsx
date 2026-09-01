"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Home,
  Users,
  Calendar,
  Activity,
  Scale,
  ShieldCheck,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Home,
  Users,
  Calendar,
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
  user: { name?: string | null } | null;
  primaryNav: NavItem[];
  secondaryNav: NavItem[];
  signOutAction: () => Promise<void>;
  brandMark: React.ReactNode;
}

const STORAGE_KEY = "sidebar-collapsed";

export function SidebarClient({
  user,
  primaryNav,
  secondaryNav,
  signOutAction,
  brandMark,
}: SidebarClientProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 1279px)").matches;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setCollapsed(stored !== null ? stored === "true" : narrow);
    } catch {
      setCollapsed(narrow);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const mq = window.matchMedia("(max-width: 1279px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setCollapsed(true);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [hydrated]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {}
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside
      className={cn(
        "flex h-screen flex-col bg-sidebar-background text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-14" : "w-[var(--sidebar-width)]"
      )}
    >
      {/* Brand */}
      <div className={cn("py-6", collapsed ? "px-3" : "px-5")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          {brandMark}
          {!collapsed && (
            <div className="leading-none">
              <span className="text-xs font-semibold tracking-widest text-white">HUNGERRUSH</span>
              <span className="mt-0.5 block text-[10px] font-semibold tracking-widest text-sidebar-primary">
                CADENCE
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-2" aria-label="Main navigation">
        <div className="space-y-1">
          {primaryNav.map((item) => {
            const active = isActive(item.href);
            const Icon = ICON_MAP[item.iconName];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center rounded-md py-2 text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-0" : "gap-3 px-3",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                {!collapsed && item.label}
              </Link>
            );
          })}
        </div>

        {/* Secondary nav */}
        {secondaryNav.length > 0 && (
          <div className="mt-8 space-y-1">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                Operations
              </p>
            )}
            {secondaryNav.map((item) => {
              const active = isActive(item.href);
              const Icon = ICON_MAP[item.iconName];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center rounded-md py-2 text-sm font-medium transition-colors",
                    collapsed ? "justify-center px-0" : "gap-3 px-3",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  {!collapsed && item.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Theme toggle */}
      <div className="px-2 py-2">
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label={
            hydrated && resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
          title={collapsed ? "Toggle theme" : undefined}
          className={cn(
            "flex w-full items-center rounded-md py-2 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed ? "justify-center px-0" : "gap-3 px-3"
          )}
        >
          {hydrated && resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          {!collapsed && (
            <span className="text-xs">
              {hydrated && resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
            </span>
          )}
        </button>
      </div>

      {/* Collapse toggle */}
      <div className="px-2 py-2">
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center rounded-md py-2 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed ? "justify-center px-0" : "gap-3 px-3"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* User */}
      {user && (
        <div className="border-t border-sidebar-border px-2 py-4">
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 px-3")}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
              {user.name ? initials(user.name) : "?"}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 truncate">
                  <div className="text-sm font-medium">{user.name}</div>
                </div>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    aria-label="Sign out"
                    className="rounded-md p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

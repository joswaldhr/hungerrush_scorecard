"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Home,
  Users,
  Calendar,
  BarChart3,
  Settings,
  Link2,
  Activity,
  Scale,
  ShieldCheck,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  ChevronDown,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Home,
  Users,
  Calendar,
  BarChart3,
  Settings,
  Link2,
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
  user: { name?: string | null; email?: string | null } | null;
  primaryNav: NavItem[];
  utilityNav?: NavItem[];
  secondaryNav: NavItem[];
  signOutAction: () => Promise<void>;
  brandMark: React.ReactNode;
}

const STORAGE_KEY = "sidebar-collapsed";

export function SidebarClient({
  user,
  primaryNav,
  utilityNav = [],
  secondaryNav,
  signOutAction,
  brandMark,
}: SidebarClientProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 1279px)").matches;
    let initialCollapsed = narrow;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) initialCollapsed = stored === "true";
    } catch {}

    // Set hydrated and initial state
    requestAnimationFrame(() => {
      setCollapsed(initialCollapsed);
      setHydrated(true);
    });
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
        "flex h-screen flex-col bg-sidebar-background text-sidebar-foreground transition-[width] duration-200 shrink-0 border-r border-sidebar-border/40 select-none",
        collapsed ? "w-16" : "w-[var(--sidebar-width)]"
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex items-center pt-6 pb-6",
          collapsed ? "flex-col gap-2 px-3" : "justify-between px-5"
        )}
      >
        <Link href="/" className={cn("flex items-center gap-3 group")}>
          {brandMark}
          {!collapsed && (
            <div className="leading-tight">
              <span className="block text-sm font-bold tracking-widest text-white">
                HUNGER<span className="font-extrabold text-white">RUSH</span>
              </span>
              <span className="block text-[11px] font-semibold tracking-wider text-[#00c4cc]">
                CADENCE
              </span>
            </div>
          )}
        </Link>

        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : undefined}
          className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-slate-400 hover:bg-sidebar-accent hover:text-white transition-colors"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto" aria-label="Main navigation">
        <div className="space-y-1.5">
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
                  "flex items-center rounded-lg py-2.5 text-sm font-medium transition-all",
                  collapsed ? "justify-center px-0" : "gap-3.5 px-3.5",
                  active
                    ? "bg-[#009ca6] text-white shadow-sm font-semibold"
                    : "text-slate-300/80 hover:bg-sidebar-accent hover:text-white"
                )}
              >
                {Icon && (
                  <Icon
                    className={cn("h-4.5 w-4.5 shrink-0", active ? "text-white" : "text-slate-400")}
                  />
                )}
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Secondary / Admin nav if present */}
        {secondaryNav.length > 0 && (
          <div className="pt-6 space-y-1">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400/60">
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
                    "flex items-center rounded-lg py-2 text-sm font-medium transition-colors",
                    collapsed ? "justify-center px-0" : "gap-3.5 px-3.5",
                    active
                      ? "bg-[#009ca6] text-white font-semibold"
                      : "text-slate-400 hover:bg-sidebar-accent hover:text-slate-200"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Utility Nav: Settings, Connections, Theme */}
      <div className="px-3 py-2 space-y-1 border-t border-sidebar-border/50">
        {utilityNav.map((item) => {
          const active = isActive(item.href);
          const Icon = ICON_MAP[item.iconName];
          return (
            <Link
              key={item.label}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg py-2 text-sm font-medium transition-colors text-slate-400 hover:bg-sidebar-accent hover:text-white",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                active && "text-white"
              )}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        <div className="flex items-center pt-1">
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label={
              hydrated && resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            title={collapsed ? "Toggle theme" : undefined}
            className={cn(
              "flex items-center rounded-md p-1.5 text-slate-400 hover:bg-sidebar-accent hover:text-white transition-colors",
              collapsed ? "w-full justify-center" : ""
            )}
          >
            {hydrated && resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* User profile card */}
      {user && (
        <div className="border-t border-sidebar-border/70 p-3 relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={cn(
              "w-full flex items-center rounded-lg p-1.5 text-left transition-colors hover:bg-sidebar-accent/80",
              collapsed ? "justify-center" : "gap-3"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#009ca6] text-xs font-bold text-white shadow-xs">
              {user.name ? initials(user.name) : "JS"}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {user.name ?? "James Smith"}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">Support Manager</div>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-slate-400 transition-transform",
                    userMenuOpen && "rotate-180"
                  )}
                />
              </>
            )}
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 rounded-lg bg-slate-900 border border-slate-700 p-1.5 shadow-xl z-50">
              <div className="px-2 py-1 text-xs text-slate-400 truncate">{user.email}</div>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs text-rose-400 hover:bg-slate-800 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

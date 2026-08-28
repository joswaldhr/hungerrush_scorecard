import Link from "next/link";
import { Home, Users, Calendar, Activity, Scale, LogOut, ShieldCheck } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { headers } from "next/headers";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { initials } from "@/lib/utils";

const primaryNav = [
  { label: "Home", href: "/", icon: Home },
  { label: "Team", href: "/team", icon: Users },
  { label: "1:1s", href: "/one-on-ones", icon: Calendar },
];

const secondaryNav = [
  { label: "Data Health", href: "/data-health", icon: Activity },
  { label: "Reconciliation", href: "/reconciliation", icon: Scale },
];

function BrandMark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 21V7l8-4 8 4v14l-8-4-8 4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 17V3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export async function Sidebar() {
  const session = await auth();
  const user = session?.user;
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "/";
  const isAdmin = user?.email ? await isPlatformAdmin(user.email) : false;
  const secondary = isAdmin
    ? [...secondaryNav, { label: "Admin", href: "/admin", icon: ShieldCheck }]
    : secondaryNav;

  return (
    <aside className="flex h-screen w-[var(--sidebar-width)] flex-col bg-sidebar-background text-sidebar-foreground">
      {/* Brand */}
      <div className="px-5 py-6">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div className="leading-none">
            <span className="text-xs font-semibold tracking-widest text-white">HUNGERRUSH</span>
            <span className="mt-0.5 block text-[10px] font-semibold tracking-widest text-sidebar-primary">
              CADENCE
            </span>
          </div>
        </div>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-3" aria-label="Main navigation">
        <div className="space-y-1">
          {primaryNav.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-primary/15 text-white"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Secondary nav */}
        <div className="mt-8 space-y-1">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Operations
          </p>
          {secondary.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-primary/15 text-white"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User */}
      {user && (
        <div className="border-t border-sidebar-border px-3 py-4">
          <div className="flex items-center gap-3 px-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
              {user.name ? initials(user.name) : "?"}
            </div>
            <div className="flex-1 truncate">
              <div className="text-sm font-medium">{user.name}</div>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                aria-label="Sign out"
                className="rounded-md p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}

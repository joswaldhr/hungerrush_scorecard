import Link from "next/link";
import { Home, Users, Calendar, Activity, Scale, LogOut, ShieldCheck } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { headers } from "next/headers";
import { isPlatformAdmin } from "@/lib/auth/authorization";

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Team", href: "/team", icon: Users },
  { label: "1:1s", href: "/one-on-ones", icon: Calendar },
  { label: "Data Health", href: "/data-health", icon: Activity },
  { label: "Reconciliation", href: "/reconciliation", icon: Scale },
];

export async function Sidebar() {
  const session = await auth();
  const user = session?.user;
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "/";
  const isAdmin = user?.email ? await isPlatformAdmin(user.email) : false;
  const items = isAdmin
    ? [...navItems, { label: "Admin", href: "/admin", icon: ShieldCheck }]
    : navItems;

  return (
    <aside className="flex h-screen w-[var(--sidebar-width)] flex-col bg-sidebar-background text-sidebar-foreground">
      <div className="px-5 py-6">
        <span className="text-lg font-bold tracking-tight text-white">CADENCE</span>
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Main navigation">
        {items.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="border-t border-sidebar-border px-3 py-4">
          <div className="flex items-center gap-3 px-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
              {user.name
                ?.split(" ")
                .map((n) => n[0])
                .join("") ?? "?"}
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

import Link from "next/link";
import { Home, Users, Calendar, LogOut } from "lucide-react";
import { auth, signOut } from "@/lib/auth";

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Team", href: "/team", icon: Users },
  { label: "1:1s", href: "/one-on-ones", icon: Calendar },
];

export async function Sidebar() {
  const session = await auth();
  const user = session?.user;

  return (
    <aside className="flex h-screen w-[var(--sidebar-width)] flex-col bg-sidebar-background text-sidebar-foreground">
      <div className="px-5 py-6">
        <span className="text-lg font-bold tracking-tight text-white">CADENCE</span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
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

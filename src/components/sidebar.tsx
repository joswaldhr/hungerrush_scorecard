import { auth, signOut } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { SidebarClient } from "./sidebar-client";

const primaryNav = [
  { label: "Team", href: "/team", iconName: "Users" },
  { label: "1:1s", href: "/one-on-ones", iconName: "Calendar" },
];

const utilityNav = [
  { label: "Settings", href: "/admin", iconName: "Settings" },
  { label: "Connections", href: "/data-health", iconName: "Link2" },
];

const adminNav = [
  { label: "Data Health", href: "/data-health", iconName: "Activity" },
  { label: "Reconciliation", href: "/reconciliation", iconName: "Scale" },
  { label: "Employees", href: "/admin/employees", iconName: "Users" },
  { label: "Teams", href: "/admin/teams", iconName: "Users" },
  { label: "Roster Review", href: "/admin/roster-review", iconName: "Users" },
  { label: "Admin", href: "/admin", iconName: "ShieldCheck" },
];

function BrandLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/hungerrush-logo-reversed.png" alt="HungerRush" className="h-5 w-auto shrink-0" />
  );
}

function BrandIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/hungerrush-mark-reversed.png"
      alt="HungerRush"
      className="h-7 w-7 shrink-0 object-contain"
    />
  );
}

export async function Sidebar() {
  const session = await auth();
  const user = session?.user;
  const isAdmin = user?.email ? await isPlatformAdmin(user.email) : false;
  const secondary = isAdmin ? adminNav : [];

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <SidebarClient
      user={user ? { name: user.name, email: user.email } : null}
      primaryNav={primaryNav}
      utilityNav={utilityNav}
      secondaryNav={secondary}
      signOutAction={handleSignOut}
      brandLogo={<BrandLogo />}
      brandIcon={<BrandIcon />}
    />
  );
}

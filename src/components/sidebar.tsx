import { auth, signOut } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { SidebarClient } from "./sidebar-client";

const primaryNav = [
  { label: "Home", href: "/", iconName: "Home" },
  { label: "Team", href: "/team", iconName: "Users" },
  { label: "1:1s", href: "/one-on-ones", iconName: "Calendar" },
  { label: "Reports", href: "/data-health", iconName: "BarChart3" },
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
  { label: "Entra Identities", href: "/admin/entra-identities", iconName: "Users" },
  { label: "Admin", href: "/admin", iconName: "ShieldCheck" },
];

function BrandMark() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0 text-[#009ca6]"
    >
      <path d="M8 26L22 12L20 28L8 26Z" fill="currentColor" opacity="0.8" />
      <path d="M14 18L32 6L26 24L14 18Z" fill="#00c4cc" />
      <path d="M18 30L34 16L30 32L18 30Z" fill="#007f87" />
    </svg>
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
      brandMark={<BrandMark />}
    />
  );
}

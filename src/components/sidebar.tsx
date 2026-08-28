import { auth, signOut } from "@/lib/auth";
import { headers } from "next/headers";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { SidebarClient } from "./sidebar-client";

const primaryNav = [
  { label: "Home", href: "/", iconName: "Home" },
  { label: "Team", href: "/team", iconName: "Users" },
  { label: "1:1s", href: "/one-on-ones", iconName: "Calendar" },
];

const adminNav = [
  { label: "Data Health", href: "/data-health", iconName: "Activity" },
  { label: "Reconciliation", href: "/reconciliation", iconName: "Scale" },
  { label: "Admin", href: "/admin", iconName: "ShieldCheck" },
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
  const secondary = isAdmin ? adminNav : [];

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <SidebarClient
      pathname={pathname}
      user={user ? { name: user.name } : null}
      primaryNav={primaryNav}
      secondaryNav={secondary}
      signOutAction={handleSignOut}
      brandMark={<BrandMark />}
    />
  );
}

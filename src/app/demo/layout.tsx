import { SidebarClient } from "@/components/sidebar-client";
import { requireDemoAccess } from "@/lib/demo/authorization";
import { signOut } from "@/lib/auth";

export default async function DemoLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDemoAccess();
  async function leaveDemo() {
    "use server";
    await signOut({ redirectTo: "/login?destination=demo" });
  }
  return (
    <div className="flex h-screen overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-background focus:p-3"
      >
        Skip to content
      </a>
      <SidebarClient
        user={{
          name: user.name ?? "Presenter",
          email: user.email ?? "",
          jobTitle: "",
        }}
        primaryNav={[{ label: "1:1s", href: "/demo/one-on-ones", iconName: "Users" }]}
        secondaryNav={[]}
        signOutAction={leaveDemo}
        brandHref="/demo/one-on-ones"
        brandLogo={
          // The sidebar has a consistently dark surface in both themes.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/hungerrush-logo-reversed.png"
            alt="HungerRush"
            className="h-6 w-auto max-w-40"
          />
        }
        brandIcon={
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/hungerrush-mark-reversed.png"
            alt="HungerRush"
            className="h-7 w-7 shrink-0 object-contain"
          />
        }
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="relative min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8"
      >
        <div className="mx-auto max-w-7xl space-y-6">{children}</div>
      </main>
    </div>
  );
}

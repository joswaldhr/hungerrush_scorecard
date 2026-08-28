import { Sidebar } from "@/components/sidebar";
import { ViewAsBanner } from "@/components/view-as-banner";
import { auth } from "@/lib/auth";
import { getEffectiveManagerContext } from "@/lib/auth/authorization";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const viewingAs = session?.user?.email
    ? (await getEffectiveManagerContext(session.user.email)).viewingAs
    : null;

  return (
    <div className="flex h-full">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {viewingAs && <ViewAsBanner displayName={viewingAs.displayName} />}
        <main id="main-content" className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

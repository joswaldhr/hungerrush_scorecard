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
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {viewingAs && <ViewAsBanner displayName={viewingAs.displayName} />}
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}

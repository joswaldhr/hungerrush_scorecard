import { Sidebar } from "@/components/sidebar";
import { ViewAsBanner } from "@/components/view-as-banner";
import { SyncStalenessBanner } from "@/components/sync-staleness-banner";
import { auth } from "@/lib/auth";
import { getEffectiveManagerContext } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { dataSources } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const { ctx, viewingAs } = session?.user?.email
    ? await getEffectiveManagerContext(session.user.email)
    : { ctx: null, viewingAs: null };

  const zendeskSource = ctx
    ? await db
        .select({ lastSuccessfulSyncAt: dataSources.lastSuccessfulSyncAt })
        .from(dataSources)
        .where(
          and(eq(dataSources.organizationId, ctx.organizationId), eq(dataSources.type, "zendesk"))
        )
        .then((r) => r[0])
    : null;

  return (
    <div className="flex h-full print:h-auto">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden print:overflow-visible">
        {viewingAs && (
          <div className="print:hidden">
            <ViewAsBanner displayName={viewingAs.displayName} />
          </div>
        )}
        {zendeskSource && (
          <div className="print:hidden">
            <SyncStalenessBanner lastSuccessfulSyncAt={zendeskSource.lastSuccessfulSyncAt} />
          </div>
        )}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-6 lg:p-8 print:overflow-visible print:p-0"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

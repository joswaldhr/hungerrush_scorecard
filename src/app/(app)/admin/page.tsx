import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  isPlatformAdmin,
  listManagersForViewAs,
  getEffectiveManagerContext,
} from "@/lib/auth/authorization";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { setViewAs, clearViewAs } from "./actions";

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const isAdmin = await isPlatformAdmin(session.user.email);
  if (!isAdmin) redirect("/");

  const [{ viewingAs }, managers] = await Promise.all([
    getEffectiveManagerContext(session.user.email),
    listManagersForViewAs(),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View as a manager to see and test their real pages and data.
        </p>
      </header>

      {viewingAs && (
        <Card>
          <CardContent className="flex items-center justify-between py-3 px-4">
            <p className="text-sm text-foreground">
              Currently viewing as{" "}
              <span className="font-medium">{viewingAs.displayName}</span>
            </p>
            <form action={clearViewAs}>
              <button type="submit" className="text-sm text-accent hover:underline">
                Exit
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Managers</h2>
        {managers.length === 0 ? (
          <EmptyState title="No managers" description="No manager assignments exist yet." />
        ) : (
          <div className="divide-y divide-border rounded-lg border">
            {managers.map((m) => (
              <div key={m.userId} className="flex items-center gap-3 px-4 py-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-[10px]">{initials(m.displayName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{m.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.teamNames.length > 0 ? m.teamNames.join(", ") : m.email}
                  </p>
                </div>
                <form action={setViewAs}>
                  <input type="hidden" name="userId" value={m.userId} />
                  <button type="submit" className="text-sm text-accent hover:underline">
                    View as →
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2 pt-2">
        <h2 className="text-sm font-semibold text-foreground">Platform tools</h2>
        <p className="text-xs text-muted-foreground">
          Data Health and Reconciliation are scoped to the organization of whichever manager
          you&apos;re viewing as. View as a manager first, then open them from the sidebar.
        </p>
      </section>
    </div>
  );
}

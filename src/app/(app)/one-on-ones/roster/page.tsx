import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAssignedEmployees, getEffectiveManagerContext } from "@/lib/auth/authorization";
import { getManagerArchives } from "@/lib/domain/roster/manager-archive";
import { ManagerArchiveForm } from "@/components/manager-archive-form";

export default async function MeetingRosterPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const { ctx, isPlatformAdmin, viewingAs } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) redirect(isPlatformAdmin ? "/admin" : "/");
  const [employees, archives] = await Promise.all([
    getAssignedEmployees(ctx),
    getManagerArchives(ctx),
  ]);
  const ordered = employees.toSorted((a, b) => a.displayName.localeCompare(b.displayName));
  return (
    <main className="mx-auto max-w-5xl space-y-6 pb-12">
      <Link href="/one-on-ones" className="text-sm text-accent underline">
        Back to 1:1s
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Manage 1:1 roster</h1>
        {viewingAs && <p>Managing the roster for {viewingAs.displayName}.</p>}
        <p className="text-sm text-muted-foreground">
          Archive a confirmed former team member from your active 1:1 list. The decision takes
          effect today (UTC) and stays in place until you restore them, even if Zendesk still lists
          them.
        </p>
        <p className="text-sm text-muted-foreground">
          This changes your meeting roster only. Employment status, other managers’ rosters, source
          assignments and saved metrics remain unchanged. Existing scorecard access is preserved
          while your assignment permits it.
        </p>
      </header>
      {([false, true] as const).map((archived) => {
        const members = ordered.filter(
          (e) => archives.some((a) => a.employeeId === e.id) === archived
        );
        return (
          <section
            key={String(archived)}
            className="space-y-3"
            aria-label={archived ? "Archived employees" : "Active employees"}
          >
            <h2 className="text-lg font-semibold">
              {archived ? "Archived" : "Active"} · {members.length}
            </h2>
            {!members.length && (
              <p className="text-sm text-muted-foreground">
                No {archived ? "archived" : "active"} employees.
              </p>
            )}
            {members.map((employee) => {
              const archive = archives.find((a) => a.employeeId === employee.id);
              return (
                <article
                  key={employee.id}
                  className="grid gap-4 rounded-xl border border-border p-4 md:grid-cols-2"
                >
                  <div className="space-y-2">
                    <h3 className="font-semibold">{employee.displayName}</h3>
                    {archive && (
                      <p className="text-sm text-muted-foreground">
                        Archived from this roster on {archive.effectiveFrom} (UTC). {archive.reason}
                      </p>
                    )}
                    <Link
                      className="text-sm text-accent underline"
                      href={`/one-on-ones/${employee.id}`}
                    >
                      Review scorecard and history
                    </Link>
                  </div>
                  <ManagerArchiveForm
                    managerId={ctx.userId}
                    employeeId={employee.id}
                    employeeName={employee.displayName}
                    archiveId={archive?.id}
                  />
                </article>
              );
            })}
          </section>
        );
      })}
    </main>
  );
}

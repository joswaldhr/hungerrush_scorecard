import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getEffectiveManagerContext,
  getAssignedTeams,
  getAssignedEmployees,
} from "@/lib/auth/authorization";
import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { initials } from "@/lib/utils";

export default async function OneOnOnesPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const { ctx, isPlatformAdmin } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) {
    if (isPlatformAdmin) redirect("/admin");
    return <EmptyState title="No access" description="You are not assigned as a manager." />;
  }

  const teams = await getAssignedTeams(ctx);
  const employees = await getAssignedEmployees(ctx);
  if (teams.length === 0) {
    return <EmptyState title="No teams" description="No teams assigned." />;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">1:1 Preparation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What do I need to know before I meet this person?
        </p>
      </header>

      {teams.map((team) => {
        const teamEmployees = employees.filter((e) => e.primaryTeamId === team.id);
        return (
          <section key={team.id} className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">{team.name}</h2>
            {teamEmployees.length === 0 ? (
              <EmptyState title="No employees" description="No employees on this team." />
            ) : (
              <div className="divide-y divide-border rounded-lg border">
                {teamEmployees.map((employee) => (
                  <Link
                    key={employee.id}
                    href={`/one-on-ones/${employee.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-[10px]">
                        {initials(employee.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{employee.displayName}</p>
                      {employee.jobTitle && (
                        <p className="text-xs text-muted-foreground">{employee.jobTitle}</p>
                      )}
                    </div>
                    <span className="text-xs text-accent">Prepare →</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

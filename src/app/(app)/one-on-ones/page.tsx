import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getEffectiveManagerContext, getAssignedTeams, getAssignedEmployees } from "@/lib/auth/authorization";
import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ChevronRight, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { initials } from "@/lib/utils";

export default async function OneOnOnesPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const { ctx, isPlatformAdmin } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) {
    if (isPlatformAdmin) redirect("/admin");
    return (
      <EmptyState
        icon={ShieldAlert}
        title="No access"
        description="You are not assigned as a manager."
      />
    );
  }

  const teams = await getAssignedTeams(ctx);
  const employees = await getAssignedEmployees(ctx);
  if (teams.length === 0) {
    return <EmptyState icon={Users} title="No teams" description="No teams assigned." />;
  }

  const employeesByTeam = new Map<string, typeof employees>();
  for (const emp of employees) {
    if (!emp.primaryTeamId) continue;
    const forTeam = employeesByTeam.get(emp.primaryTeamId) ?? [];
    forTeam.push(emp);
    employeesByTeam.set(emp.primaryTeamId, forTeam);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <header>
        <h1 className="text-2xl sm:text-[28px] font-bold text-foreground tracking-tight">1:1s</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Pick someone to view their scorecard.
        </p>
      </header>

      {teams.map((team) => {
        const teamEmps = employeesByTeam.get(team.id) ?? [];
        return (
          <div key={team.id} className="space-y-3">
            {teams.length > 1 && <h2 className="text-sm font-bold text-foreground px-1">{team.name}</h2>}

            {teamEmps.length === 0 ? (
              <EmptyState icon={Users} title="No employees" description="No employees on this team." />
            ) : (
              <Card className="overflow-hidden divide-y divide-border/60">
                {teamEmps.map((emp) => (
                  <Link
                    key={emp.id}
                    href={`/one-on-ones/${emp.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9 ring-1 ring-border shrink-0">
                        <AvatarFallback className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-foreground">
                          {initials(emp.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground group-hover:text-[#009ca6] transition-colors truncate">
                          {emp.displayName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {emp.jobTitle ?? "Support Specialist"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </Card>
            )}
          </div>
        );
      })}
    </div>
  );
}

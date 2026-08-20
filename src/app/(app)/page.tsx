import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getManagerContext,
  getAssignedTeams,
  getAssignedEmployees,
} from "@/lib/auth/authorization";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const ctx = await getManagerContext(session.user.email);

  if (!ctx) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">No access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account is not configured as a manager. Contact your administrator.
        </p>
      </div>
    );
  }

  const [assignedTeams, assignedEmployees] = await Promise.all([
    getAssignedTeams(ctx),
    getAssignedEmployees(ctx),
  ]);

  const employeesByTeam = new Map<string, typeof assignedEmployees>();
  for (const team of assignedTeams) {
    employeesByTeam.set(
      team.id,
      assignedEmployees.filter((e) => e.primaryTeamId === team.id)
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Good morning{session.user.name ? `, ${session.user.name}` : ""}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Your weekly manager briefing</p>

      <div className="mt-8 space-y-6">
        {assignedTeams.map((team) => {
          const teamEmployees = employeesByTeam.get(team.id) ?? [];
          return (
            <section key={team.id}>
              <h2 className="text-lg font-medium tracking-tight">{team.name}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {teamEmployees.length} {teamEmployees.length === 1 ? "employee" : "employees"}
              </p>
              {teamEmployees.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {teamEmployees.map((emp) => (
                    <li
                      key={emp.id}
                      className="flex items-center gap-3 rounded-md border px-4 py-2.5 text-sm"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {emp.displayName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <span className="font-medium">{emp.displayName}</span>
                        {emp.jobTitle && (
                          <span className="ml-2 text-muted-foreground">{emp.jobTitle}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No employees assigned.</p>
              )}
            </section>
          );
        })}

        {assignedTeams.length === 0 && (
          <p className="text-sm text-muted-foreground">No teams assigned to you.</p>
        )}
      </div>
    </div>
  );
}

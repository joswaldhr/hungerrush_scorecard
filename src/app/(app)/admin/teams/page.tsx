import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { teams, organizations, employees } from "@/lib/db/schema";
import { createTeam } from "../roster-actions";

export default async function AdminTeamsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  if (!(await isPlatformAdmin(session.user.email))) redirect("/");

  const [allTeams, allOrgs, allEmployees] = await Promise.all([
    db.select().from(teams),
    db.select().from(organizations),
    db.select().from(employees),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Teams</h1>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Add team</h2>
        <form action={createTeam} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-muted-foreground mb-1">
              Name
            </label>
            <input
              id="name"
              name="name"
              required
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          {allOrgs.length > 1 && (
            <div>
              <label htmlFor="organizationId" className="block text-xs font-medium text-muted-foreground mb-1">
                Organization
              </label>
              <select
                id="organizationId"
                name="organizationId"
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              >
                {allOrgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {allOrgs.length === 1 && (
            <input type="hidden" name="organizationId" value={allOrgs[0]!.id} />
          )}
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
          >
            Add
          </button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">All teams ({allTeams.length})</h2>
        <div className="divide-y divide-border rounded-lg border">
          {allTeams.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-medium text-foreground">{t.name}</p>
              <p className="text-xs text-muted-foreground">
                {allEmployees.filter((e) => e.primaryTeamId === t.id).length} employees
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

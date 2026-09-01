import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { employees, teams, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { createEmployee } from "../roster-actions";

export default async function AdminEmployeesPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  if (!(await isPlatformAdmin(session.user.email))) redirect("/");

  const [allEmployees, allTeams, allOrgs] = await Promise.all([
    db.select().from(employees),
    db.select().from(teams),
    db.select().from(organizations),
  ]);

  const teamNameById = new Map(allTeams.map((t) => [t.id, t.name]));

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Employees</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add and edit the roster. Onboarding without this used to require raw SQL.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Add employee</h2>
        <form
          action={createEmployee}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
        >
          <div>
            <label
              htmlFor="displayName"
              className="block text-xs font-medium text-muted-foreground mb-1"
            >
              Name
            </label>
            <input
              id="displayName"
              name="displayName"
              required
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-muted-foreground mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <div>
            <label
              htmlFor="jobTitle"
              className="block text-xs font-medium text-muted-foreground mb-1"
            >
              Job title
            </label>
            <input
              id="jobTitle"
              name="jobTitle"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <div>
            <label
              htmlFor="teamId"
              className="block text-xs font-medium text-muted-foreground mb-1"
            >
              Team
            </label>
            <select
              id="teamId"
              name="teamId"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="">Unassigned</option>
              {allTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          {allOrgs.length > 1 && (
            <div>
              <label
                htmlFor="organizationId"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
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
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90"
          >
            Add
          </button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">
          All employees ({allEmployees.length})
        </h2>
        <div className="divide-y divide-border rounded-lg border">
          {allEmployees.map((e) => (
            <Link
              key={e.id}
              href={`/admin/employees/${e.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-accent/50"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{e.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {e.jobTitle ?? "—"} ·{" "}
                  {e.primaryTeamId
                    ? (teamNameById.get(e.primaryTeamId) ?? "Unknown team")
                    : "Unassigned"}
                </p>
              </div>
              <span
                className={`text-xs ${e.employmentStatus === "active" ? "text-status-on-track" : "text-muted-foreground"}`}
              >
                {e.employmentStatus}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

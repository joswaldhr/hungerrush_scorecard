import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isPlatformAdmin, listManagersForViewAs } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import {
  metricDefinitions,
  metricVisibilityOverrides,
  employees,
  teams,
  users,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { VisibilityEditor } from "./visibility-editor";
import { removeVisibilityOverride } from "./actions";

export default async function MetricVisibilityPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  if (!(await isPlatformAdmin(session.user.email))) redirect("/");

  const [allMetrics, allOverrides, allEmployees, allTeams, allUsers, managers] =
    await Promise.all([
      db.select().from(metricDefinitions).where(eq(metricDefinitions.status, "active")),
      db.select().from(metricVisibilityOverrides),
      db
        .select({ id: employees.id, displayName: employees.displayName })
        .from(employees)
        .where(eq(employees.employmentStatus, "active")),
      db.select().from(teams),
      db.select({ id: users.id, displayName: users.displayName }).from(users),
      listManagersForViewAs(),
    ]);

  const menufyTeam = allTeams.find((t) => t.slug === "menufy-support");
  const posTeam = allTeams.find((t) => t.slug === "pos-support");

  if (!menufyTeam || !posTeam) {
    return (
      <div className="max-w-3xl space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Metric Visibility</h1>
        <p className="text-sm text-status-attention">
          Could not find both the Menufy Support and POS Support teams (expected slugs
          &quot;menufy-support&quot; and &quot;pos-support&quot;). Brand scoping needs both to
          exist before this page can be used.
        </p>
      </div>
    );
  }

  const metricNameById = new Map(allMetrics.map((m) => [m.id, m.name]));
  const teamNameById = new Map(allTeams.map((t) => [t.id, t.name]));
  const employeeNameById = new Map(allEmployees.map((e) => [e.id, e.displayName]));
  const userNameById = new Map(allUsers.map((u) => [u.id, u.displayName]));

  function describeScope(o: (typeof allOverrides)[number]): string {
    if (o.scope === "scorecard_override") {
      return `Scorecard: ${employeeNameById.get(o.targetEmployeeId ?? "") ?? "Unknown employee"}`;
    }
    if (o.scope === "manager_override") {
      return `Manager: ${userNameById.get(o.managerUserId ?? "") ?? "Unknown manager"}`;
    }
    return "Global default";
  }

  function describeBrand(o: (typeof allOverrides)[number]): string {
    const team = o.teamId ? (teamNameById.get(o.teamId) ?? "Unknown team") : "All teams";
    const line = o.line ? ` — ${o.line}` : "";
    return `${team}${line}`;
  }

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Metric Visibility</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hide a metric row from a single scorecard, every scorecard under a manager, or
          everyone by default. Most specific scope wins.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">New override</h2>
        <VisibilityEditor
          metrics={allMetrics.map((m) => ({ id: m.id, name: m.name, category: m.category }))}
          managers={managers.map((m) => ({ userId: m.userId, displayName: m.displayName }))}
          employeesList={allEmployees}
          menufyTeamId={menufyTeam.id}
          posTeamId={posTeam.id}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Current overrides ({allOverrides.length})
        </h2>
        {allOverrides.length === 0 ? (
          <p className="text-sm text-muted-foreground">No visibility overrides configured.</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border">
            {allOverrides.map((o) => (
              <div key={o.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {metricNameById.get(o.metricDefinitionId) ?? "Unknown metric"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {describeScope(o)} · {describeBrand(o)} ·{" "}
                    <span className={o.hidden ? "text-status-attention" : "text-status-on-track"}>
                      {o.hidden ? "Hidden" : "Shown"}
                    </span>
                  </p>
                </div>
                <form action={removeVisibilityOverride}>
                  <input type="hidden" name="id" value={o.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

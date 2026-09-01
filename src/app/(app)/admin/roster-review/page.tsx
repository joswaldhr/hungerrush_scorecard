import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { dataSources, rosterSourceTeamMappings, rosterCandidates, teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  addGroupMapping,
  removeGroupMapping,
  runRosterDiscovery,
  approveNewCandidate,
  approveDeparture,
  rejectCandidate,
} from "./actions";

export default async function RosterReviewPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  if (!(await isPlatformAdmin(session.user.email))) redirect("/");

  const [allSources, allMappings, pendingCandidates, allTeams] = await Promise.all([
    db.select().from(dataSources),
    db.select().from(rosterSourceTeamMappings),
    db.select().from(rosterCandidates).where(eq(rosterCandidates.status, "pending")),
    db.select().from(teams),
  ]);

  const teamNameById = new Map(allTeams.map((t) => [t.id, t.name]));
  const newCandidates = pendingCandidates.filter((c) => c.changeType === "new");
  const departedCandidates = pendingCandidates.filter((c) => c.changeType === "departed");

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Roster Review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A stopgap for Rippling: diffs each connected source&apos;s configured groups against known
          people and surfaces new hires and departures for review. Nothing here is auto-created or
          auto-deactivated.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Sources &amp; group mappings</h2>
        {allSources.map((source) => {
          const sourceMappings = allMappings.filter((m) => m.dataSourceId === source.id);
          return (
            <div key={source.id} className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{source.displayName}</p>
                <form action={runRosterDiscovery}>
                  <input type="hidden" name="dataSourceId" value={source.id} />
                  <input type="hidden" name="dataSourceType" value={source.type} />
                  <button
                    type="submit"
                    disabled={sourceMappings.length === 0}
                    className="rounded-md border border-accent px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-40"
                  >
                    Discover roster changes
                  </button>
                </form>
              </div>

              {sourceMappings.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Not configured — add at least one group mapping below before this source can be
                  checked.
                </p>
              ) : (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {sourceMappings.map((m) => (
                    <li key={m.id} className="flex items-center justify-between">
                      <span>
                        {m.externalGroupLabel} ({m.externalGroupId}) →{" "}
                        {teamNameById.get(m.teamId) ?? "Unknown team"}
                      </span>
                      <form action={removeGroupMapping}>
                        <input type="hidden" name="mappingId" value={m.id} />
                        <button type="submit" className="text-status-attention hover:underline">
                          Remove
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <form action={addGroupMapping} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="dataSourceId" value={source.id} />
                <input
                  name="externalGroupId"
                  placeholder="Group/team ID"
                  required
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                />
                <input
                  name="externalGroupLabel"
                  placeholder="Label"
                  required
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                />
                <select
                  name="teamId"
                  required
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                >
                  <option value="">Team...</option>
                  {allTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:bg-accent/90"
                >
                  Add mapping
                </button>
              </form>
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          New hires ({newCandidates.length})
        </h2>
        {newCandidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending new-hire candidates.</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border">
            {newCandidates.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {c.externalDisplayName ?? c.externalEmail ?? c.externalId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.externalEmail} · suggested:{" "}
                    {c.suggestedTeamId
                      ? (teamNameById.get(c.suggestedTeamId) ?? "Unknown team")
                      : "None"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <form action={approveNewCandidate} className="flex items-center gap-2">
                    <input type="hidden" name="candidateId" value={c.id} />
                    <select
                      name="teamId"
                      defaultValue={c.suggestedTeamId ?? ""}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                    >
                      <option value="">Unassigned</option>
                      {allTeams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:bg-accent/90"
                    >
                      Approve
                    </button>
                  </form>
                  <form action={rejectCandidate}>
                    <input type="hidden" name="candidateId" value={c.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Possible departures ({departedCandidates.length})
        </h2>
        {departedCandidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending departure candidates.</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border">
            {departedCandidates.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {c.externalDisplayName ?? c.externalEmail ?? c.externalId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    No longer found in the mapped group — {c.externalEmail}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <form action={approveDeparture}>
                    <input type="hidden" name="candidateId" value={c.id} />
                    <button
                      type="submit"
                      className="rounded-md bg-status-attention px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
                    >
                      Mark inactive
                    </button>
                  </form>
                  <form action={rejectCandidate}>
                    <input type="hidden" name="candidateId" value={c.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

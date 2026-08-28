import { db } from "@/lib/db";
import {
  externalIdentities,
  rosterSourceTeamMappings,
  rosterCandidates,
  dataSources,
  employees,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { Connector } from "@/lib/connectors";

/**
 * Diffs a connector's discoverRoster() result against known external_identities to
 * surface new-hire and departure candidates for admin review. Never auto-creates or
 * auto-deactivates an employee -- see admin/roster-review for the approval step.
 */
export async function discoverRosterCandidates(
  connector: Connector,
  dataSourceId: string
): Promise<{ newCandidates: number; departedCandidates: number }> {
  const [source] = await db.select().from(dataSources).where(eq(dataSources.id, dataSourceId));
  if (!source) throw new Error("Data source not found");

  const mappings = await db
    .select()
    .from(rosterSourceTeamMappings)
    .where(eq(rosterSourceTeamMappings.dataSourceId, dataSourceId));

  const groupMappings = mappings.map((m) => ({
    externalGroupId: m.externalGroupId,
    teamId: m.teamId,
  }));
  const mappedTeamIds = new Set(mappings.map((m) => m.teamId));

  const discovered = await connector.discoverRoster(
    { dataSourceId, organizationId: source.organizationId },
    groupMappings
  );
  const discoveredIds = new Set(discovered.map((d) => d.externalId));

  const known = await db
    .select()
    .from(externalIdentities)
    .where(eq(externalIdentities.dataSourceId, dataSourceId));
  const knownExternalIds = new Set(known.map((k) => k.externalId));

  const existingPending = await db
    .select({ externalId: rosterCandidates.externalId })
    .from(rosterCandidates)
    .where(
      and(eq(rosterCandidates.dataSourceId, dataSourceId), eq(rosterCandidates.status, "pending"))
    );
  const pendingExternalIds = new Set(existingPending.map((c) => c.externalId));

  let newCandidates = 0;
  let departedCandidates = 0;

  for (const member of discovered) {
    if (knownExternalIds.has(member.externalId)) continue;
    if (pendingExternalIds.has(member.externalId)) continue;

    await db.insert(rosterCandidates).values({
      dataSourceId,
      externalId: member.externalId,
      externalEmail: member.externalEmail,
      externalDisplayName: member.externalDisplayName,
      changeType: "new",
      suggestedTeamId: member.teamId,
      status: "pending",
    });
    newCandidates++;
  }

  // A known identity only counts as "departed" if discovery actually checked their team
  // this run -- otherwise "not discovered" just means we never looked, not that they left.
  for (const identity of known) {
    if (discoveredIds.has(identity.externalId)) continue;
    if (pendingExternalIds.has(identity.externalId)) continue;

    const [employee] = await db
      .select({ primaryTeamId: employees.primaryTeamId })
      .from(employees)
      .where(eq(employees.id, identity.employeeId));
    if (!employee?.primaryTeamId || !mappedTeamIds.has(employee.primaryTeamId)) continue;

    await db.insert(rosterCandidates).values({
      dataSourceId,
      externalId: identity.externalId,
      externalEmail: identity.externalEmail,
      externalDisplayName: identity.externalDisplayName,
      changeType: "departed",
      employeeId: identity.employeeId,
      status: "pending",
    });
    departedCandidates++;
  }

  return { newCandidates, departedCandidates };
}

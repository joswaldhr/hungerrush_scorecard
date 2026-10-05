import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  dataSources,
  rosterCandidates,
  rosterObservations,
  rosterSourceTeamMappings,
} from "@/lib/db/schema";

export type RosterTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const rosterIdentityKey = (type: string, value: string) =>
  type === "zendesk" ? value.trim().toLowerCase() : value;
export function rosterMappingKey(
  rows: { id: string; externalGroupId: string; teamId: string; line: string | null }[]
) {
  return JSON.stringify(
    rows
      .map((row) => [row.id, row.externalGroupId, row.teamId, row.line])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  );
}

/** Caller holds the source lock before the candidate lock. Failed approval makes no writes. */
export async function assertCurrentRosterEvidence(
  tx: RosterTransaction,
  source: typeof dataSources.$inferSelect,
  candidate: typeof rosterCandidates.$inferSelect
) {
  const [latest] = await tx
    .select()
    .from(rosterObservations)
    .where(eq(rosterObservations.dataSourceId, source.id))
    .orderBy(desc(rosterObservations.observedAt))
    .limit(1);
  if (
    !latest ||
    latest.id !== candidate.observationId ||
    source.status !== "configured" ||
    latest.sourceReference !== source.configurationReference ||
    Date.now() - latest.observedAt.getTime() > 36 * 60 * 60_000 ||
    latest.observedAt.getTime() > Date.now()
  )
    throw new Error("Roster evidence is missing or outdated. Run discovery before approval.");
  const mappings = await tx
    .select()
    .from(rosterSourceTeamMappings)
    .where(eq(rosterSourceTeamMappings.dataSourceId, source.id));
  if (rosterMappingKey(mappings) !== latest.mappingKey)
    throw new Error("Roster mappings changed. Run discovery before approval.");
  const member = latest.members.find(
    (row) =>
      rosterIdentityKey(source.type, row.externalId) ===
      rosterIdentityKey(source.type, candidate.externalId)
  );
  if (candidate.changeType === "departed") {
    if (member || latest.members.length === 0)
      throw new Error("Departure lacks a valid nonempty roster observation.");
  } else if (
    !member ||
    member.teamId !== candidate.suggestedTeamId ||
    member.line !== candidate.suggestedLine
  ) {
    throw new Error("Roster proposal no longer matches observed membership.");
  }
  return latest;
}

export async function lockRosterCandidate(
  tx: RosterTransaction,
  organizationId: string,
  candidateId: string
) {
  const [observed] = await tx
    .select({ sourceId: rosterCandidates.dataSourceId })
    .from(rosterCandidates)
    .innerJoin(dataSources, eq(dataSources.id, rosterCandidates.dataSourceId))
    .where(
      and(eq(rosterCandidates.id, candidateId), eq(dataSources.organizationId, organizationId))
    );
  if (!observed) return null;
  const [source] = await tx
    .select()
    .from(dataSources)
    .where(
      and(eq(dataSources.id, observed.sourceId), eq(dataSources.organizationId, organizationId))
    )
    .for("update");
  if (!source) return null;
  const [candidate] = await tx
    .select()
    .from(rosterCandidates)
    .where(and(eq(rosterCandidates.id, candidateId), eq(rosterCandidates.dataSourceId, source.id)))
    .for("update");
  return candidate ? { source, candidate } : null;
}

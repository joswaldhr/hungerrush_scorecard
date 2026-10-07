import { and, eq, isNull, or, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  employees,
  externalIdentities,
  rosterCandidates,
  teamMemberships,
  teams,
} from "@/lib/db/schema";
import { assertCurrentRosterEvidence, lockRosterCandidate, rosterIdentityKey } from "./evidence";

/** Explicit administrator review only; never called by source discovery or the scheduler. */
export async function applyRosterTransition(
  organizationId: string,
  reviewerId: string,
  candidateId: string,
  expectedObservationId?: string
) {
  return db.transaction(async (tx) => {
    const locked = await lockRosterCandidate(tx, organizationId, candidateId);
    if (!locked || locked.candidate.status !== "pending") return;
    const { source, candidate } = locked;
    if (expectedObservationId !== undefined && candidate.observationId !== expectedObservationId)
      throw new Error("Roster proposal changed since this page loaded. Refresh before approval.");
    if (
      !["transferred", "returned", "departed"].includes(candidate.changeType) ||
      !candidate.employeeId
    )
      throw new Error("Unsupported roster transition");
    await assertCurrentRosterEvidence(tx, source, candidate);
    const [person] = await tx
      .select()
      .from(employees)
      .where(
        and(eq(employees.id, candidate.employeeId), eq(employees.organizationId, organizationId))
      )
      .for("update");
    const previous = candidate.previousEmployeeState;
    if (
      !person ||
      !previous ||
      person.primaryTeamId !== previous.primaryTeamId ||
      person.line !== previous.line ||
      person.employmentStatus !== previous.employmentStatus
    )
      throw new Error("Employee assignment changed. Run discovery before approval.");
    const bindings = await tx
      .select()
      .from(externalIdentities)
      .where(
        and(
          eq(externalIdentities.dataSourceId, source.id),
          eq(externalIdentities.employeeId, person.id)
        )
      );
    if (
      bindings.length !== 1 ||
      rosterIdentityKey(source.type, bindings[0]!.externalId) !==
        rosterIdentityKey(source.type, candidate.externalId)
    )
      throw new Error("Employee identity is ambiguous. Review the source binding.");
    const today = new Date().toISOString().slice(0, 10);
    const memberships = await tx
      .select()
      .from(teamMemberships)
      .where(
        and(
          eq(teamMemberships.employeeId, person.id),
          or(isNull(teamMemberships.effectiveTo), gt(teamMemberships.effectiveTo, today))
        )
      )
      .for("update");
    if (memberships.some((row) => row.effectiveFrom > today || row.effectiveTo !== null))
      throw new Error("A scheduled membership change requires manual reconciliation.");
    const isDeparture = candidate.changeType === "departed";
    if (isDeparture && memberships.some((row) => row.teamId !== person.primaryTeamId))
      throw new Error("Other team memberships remain. Review them before archiving.");
    if (
      candidate.changeType === "returned" &&
      (person.employmentStatus !== "inactive" || memberships.length > 0)
    )
      throw new Error("Returning employee has conflicting active memberships.");
    if (candidate.changeType !== "returned" && person.employmentStatus !== "active")
      throw new Error("Employee is no longer active.");
    const teamId = candidate.suggestedTeamId;
    if (!isDeparture) {
      const [team] = teamId
        ? await tx
            .select()
            .from(teams)
            .where(
              and(
                eq(teams.id, teamId),
                eq(teams.organizationId, organizationId),
                eq(teams.status, "active")
              )
            )
        : [];
      if (!team) throw new Error("Destination team is not active or permitted.");
    }
    // Leave unrelated memberships and all past intervals intact. Same-day boundaries
    // are exclusive at the end, matching existing authorization date comparisons.
    if (isDeparture || person.primaryTeamId !== teamId) {
      for (const membership of memberships.filter((row) => row.teamId === person.primaryTeamId))
        await tx
          .update(teamMemberships)
          .set({ effectiveTo: today })
          .where(eq(teamMemberships.id, membership.id));
    }
    if (!isDeparture && !memberships.some((row) => row.teamId === teamId))
      await tx
        .insert(teamMemberships)
        .values({ employeeId: person.id, teamId: teamId!, effectiveFrom: today });
    await tx
      .update(employees)
      .set(
        isDeparture
          ? { employmentStatus: "inactive", updatedAt: new Date() }
          : {
              employmentStatus: "active",
              primaryTeamId: teamId,
              line: candidate.suggestedLine,
              updatedAt: new Date(),
            }
      )
      .where(eq(employees.id, person.id));
    await tx
      .update(rosterCandidates)
      .set({ status: "approved", reviewedBy: reviewerId, reviewedAt: new Date() })
      .where(eq(rosterCandidates.id, candidate.id));
  });
}

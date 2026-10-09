import { db } from "@/lib/db";
import {
  externalIdentities,
  rosterSourceTeamMappings,
  rosterCandidates,
  dataSources,
  employees,
  teamMemberships,
  users,
  rosterObservations,
} from "@/lib/db/schema";
import { eq, and, inArray, desc, ne } from "drizzle-orm";
import type { Connector } from "@/lib/connectors";
import type { DiscoveredRosterMember } from "@/lib/connectors/types";
import { logger } from "@/lib/logger";
import { assertOrganizationResource } from "@/lib/auth/organization-scope";
import { rosterMappingKey } from "./evidence";

const AUTO_APPROVE_ABSOLUTE_MAX = 5;
const AUTO_APPROVE_ROSTER_PERCENT = 0.3;

export async function discoverRosterCandidates(
  connector: Connector,
  dataSourceId: string,
  options: {
    reviewOnly?: boolean;
    lockPublication?: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<void>;
    validatePublication?: (
      tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
    ) => Promise<void>;
    recordResult?: (
      tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
      result: { newCandidates: number; departedCandidates: number; autoApproved: number }
    ) => Promise<void>;
  } = {}
): Promise<{ newCandidates: number; departedCandidates: number; autoApproved: number }> {
  const [source] = await db.select().from(dataSources).where(eq(dataSources.id, dataSourceId));
  if (!source) throw new Error("Data source not found");
  // Zendesk's roster connector uses email identities. Compare them consistently
  // without rewriting stored source IDs or case-sensitive IDs from other sources.
  const identityKey = (value: string) =>
    source.type === "zendesk" ? value.trim().toLowerCase() : value;

  const mappings = await db
    .select()
    .from(rosterSourceTeamMappings)
    .where(eq(rosterSourceTeamMappings.dataSourceId, dataSourceId));

  const groupMappings = mappings.map((m) => ({
    externalGroupId: m.externalGroupId,
    teamId: m.teamId,
    line: m.line,
  }));
  const mappedTeamIds = new Set(mappings.map((m) => m.teamId));

  const assignmentFields = {
    externalId: externalIdentities.externalId,
    teamId: employees.primaryTeamId,
    line: employees.line,
  };
  const assignmentScope = and(
    eq(externalIdentities.dataSourceId, dataSourceId),
    eq(employees.organizationId, source.organizationId),
    eq(employees.employmentStatus, "active")
  );
  const existingAssignments = await db
    .select(assignmentFields)
    .from(externalIdentities)
    .innerJoin(employees, eq(employees.id, externalIdentities.employeeId))
    .where(assignmentScope);

  const observedAt = new Date();
  const discovered = await connector.discoverRoster(
    { dataSourceId, organizationId: source.organizationId },
    groupMappings,
    existingAssignments
  );
  const discoveredIds = new Set(discovered.map((d) => identityKey(d.externalId)));

  // Fetch externally before taking a database lock. Recheck configuration before writing.
  return db.transaction(async (tx) => {
    await options.lockPublication?.(tx);
    const [currentSource] = await tx
      .select()
      .from(dataSources)
      .where(eq(dataSources.id, dataSourceId))
      .for("update");
    if (
      !currentSource ||
      currentSource.status !== "configured" ||
      currentSource.type !== source.type ||
      currentSource.configurationReference !== source.configurationReference
    )
      throw new Error("Roster source changed during discovery; retry required");
    await assertOrganizationResource(source.organizationId, "source", dataSourceId, tx);
    const currentAssignments = await tx
      .select(assignmentFields)
      .from(externalIdentities)
      .innerJoin(employees, eq(employees.id, externalIdentities.employeeId))
      .where(assignmentScope)
      .for("share");
    const assignmentKey = (rows: typeof existingAssignments) =>
      JSON.stringify(rows.map((row) => JSON.stringify(row)).sort());
    const observedIds = new Set(existingAssignments.map((row) => row.externalId));
    if (
      assignmentKey(currentAssignments.filter((row) => observedIds.has(row.externalId))) !==
      assignmentKey(existingAssignments)
    )
      throw new Error("Roster assignments changed during discovery; retry required");
    const currentMappings = await tx
      .select()
      .from(rosterSourceTeamMappings)
      .where(eq(rosterSourceTeamMappings.dataSourceId, dataSourceId));
    if (rosterMappingKey(currentMappings) !== rosterMappingKey(mappings))
      throw new Error("Roster mappings changed during discovery; retry required");
    await options.validatePublication?.(tx);
    for (const teamId of mappedTeamIds)
      await assertOrganizationResource(source.organizationId, "team", teamId, tx);
    if (discovered.some((member) => !mappedTeamIds.has(member.teamId)))
      throw new Error("Discovered roster contains an unmapped team");
    if (
      discovered.some(
        (member) =>
          !mappings.some(
            (mapping) => mapping.teamId === member.teamId && mapping.line === (member.line ?? null)
          )
      )
    )
      throw new Error("Discovered roster contains an unmapped line");
    if (discoveredIds.size !== discovered.length)
      throw new Error("Discovered roster contains duplicate identities");
    const known = await tx
      .select()
      .from(externalIdentities)
      .where(eq(externalIdentities.dataSourceId, dataSourceId));
    const knownExternalIds = new Set(known.map((k) => identityKey(k.externalId)));
    if (knownExternalIds.size !== known.length)
      throw new Error("Stored roster identities are ambiguous; review required");
    const organizationEmployees = await tx
      .select()
      .from(employees)
      .where(eq(employees.organizationId, source.organizationId));
    const existingEmployeeEmails = new Set(
      organizationEmployees.flatMap((employee) =>
        employee.email ? [employee.email.trim().toLowerCase()] : []
      )
    );

    const [latest] = await tx
      .select()
      .from(rosterObservations)
      .where(eq(rosterObservations.dataSourceId, dataSourceId))
      .orderBy(desc(rosterObservations.observedAt))
      .limit(1);
    if (latest && latest.observedAt >= observedAt)
      throw new Error("A newer roster observation already exists; retry required");
    const [observation] = await tx
      .insert(rosterObservations)
      .values({
        dataSourceId,
        observedAt,
        sourceReference: source.configurationReference,
        mappingKey: rosterMappingKey(mappings),
        members: discovered.map((member) => ({
          externalId: member.externalId,
          teamId: member.teamId,
          line: member.line ?? null,
        })),
      })
      .returning();
    const observationId = observation!.id;
    const peopleById = new Map(organizationEmployees.map((person) => [person.id, person]));
    const knownByKey = new Map(
      known.map((identity) => [identityKey(identity.externalId), identity])
    );
    const previousState = (person: typeof employees.$inferSelect) => ({
      primaryTeamId: person.primaryTeamId,
      line: person.line,
      employmentStatus: person.employmentStatus,
    });
    const transitionFor = (member: DiscoveredRosterMember) => {
      const identity = knownByKey.get(identityKey(member.externalId));
      const person = identity && peopleById.get(identity.employeeId);
      if (!person) return null;
      const changeType =
        person.employmentStatus === "inactive"
          ? "returned"
          : person.employmentStatus === "active" &&
              (person.primaryTeamId !== member.teamId || person.line !== (member.line ?? null))
            ? "transferred"
            : null;
      return changeType ? { person, changeType } : null;
    };
    const pending = await tx
      .select()
      .from(rosterCandidates)
      .where(
        and(eq(rosterCandidates.dataSourceId, dataSourceId), eq(rosterCandidates.status, "pending"))
      )
      .for("update");
    for (const candidate of pending) {
      const member = discovered.find(
        (row) => identityKey(row.externalId) === identityKey(candidate.externalId)
      );
      const transition = member && transitionFor(member);
      const person = candidate.employeeId ? peopleById.get(candidate.employeeId) : undefined;
      const valid =
        candidate.changeType === "new"
          ? !!member && !knownByKey.has(identityKey(candidate.externalId))
          : candidate.changeType === "departed"
            ? !member &&
              person?.employmentStatus === "active" &&
              !!person.primaryTeamId &&
              mappedTeamIds.has(person.primaryTeamId)
            : !!transition &&
              transition.changeType === candidate.changeType &&
              transition.person.id === candidate.employeeId;
      await tx
        .update(rosterCandidates)
        .set(
          valid
            ? {
                observationId,
                ...(member
                  ? {
                      suggestedTeamId: member.teamId,
                      suggestedLine: member.line ?? null,
                      externalEmail: member.externalEmail,
                      externalDisplayName: member.externalDisplayName,
                    }
                  : {}),
                ...(person ? { previousEmployeeState: previousState(person) } : {}),
              }
            : { status: "withdrawn", withdrawnAt: observedAt }
        )
        .where(eq(rosterCandidates.id, candidate.id));
    }
    // Existing identities can return or move without becoming new employees.
    for (const member of discovered) {
      const transition = transitionFor(member);
      if (!transition) continue;
      const [prior] = await tx
        .select()
        .from(rosterCandidates)
        .where(
          and(
            eq(rosterCandidates.dataSourceId, dataSourceId),
            eq(rosterCandidates.employeeId, transition.person.id),
            eq(rosterCandidates.changeType, transition.changeType),
            inArray(rosterCandidates.status, ["pending", "rejected"])
          )
        )
        .limit(1);
      if (prior) continue;
      await tx.insert(rosterCandidates).values({
        dataSourceId,
        observationId,
        externalId: member.externalId,
        externalEmail: member.externalEmail,
        externalDisplayName: member.externalDisplayName,
        changeType: transition.changeType,
        employeeId: transition.person.id,
        previousEmployeeState: previousState(transition.person),
        suggestedTeamId: member.teamId,
        suggestedLine: member.line ?? null,
      });
    }

    const pendingDepartures = await tx
      .select({ externalId: rosterCandidates.externalId })
      .from(rosterCandidates)
      .where(
        and(
          eq(rosterCandidates.dataSourceId, dataSourceId),
          eq(rosterCandidates.changeType, "departed"),
          inArray(rosterCandidates.status, ["pending", "rejected"])
        )
      );
    const pendingDepartureIds = new Set(
      pendingDepartures.map((candidate) => identityKey(candidate.externalId))
    );
    const existingNewCandidates = await tx
      .select({ externalId: rosterCandidates.externalId })
      .from(rosterCandidates)
      .where(
        and(
          eq(rosterCandidates.dataSourceId, dataSourceId),
          eq(rosterCandidates.changeType, "new"),
          ne(rosterCandidates.status, "withdrawn")
        )
      );
    const seenNewExternalIds = new Set(existingNewCandidates.map((c) => identityKey(c.externalId)));

    const managerUsers = await tx
      .select({ email: users.email })
      .from(users)
      .where(eq(users.organizationId, source.organizationId));
    const managerEmails = new Set(managerUsers.map((u) => u.email.trim().toLowerCase()));

    let newCandidates = 0;
    let autoApproved = 0;
    let departedCandidates = 0;

    // --- Pass 1: collect eligible new-hire candidates ---
    const eligible: DiscoveredRosterMember[] = [];
    for (const member of discovered) {
      if (knownExternalIds.has(identityKey(member.externalId))) continue;
      if (seenNewExternalIds.has(identityKey(member.externalId))) continue;
      if (member.externalEmail && managerEmails.has(member.externalEmail.trim().toLowerCase()))
        continue;
      eligible.push(member);
    }

    // --- Circuit breaker: too many at once means something structural changed ---
    let shouldAutoApprove = false;
    if (eligible.length > 0 && eligible.length <= AUTO_APPROVE_ABSOLUTE_MAX) {
      const mappedTeamIdArray = [...mappedTeamIds];
      const activeEmployees =
        mappedTeamIdArray.length > 0
          ? await tx
              .select({ id: employees.id })
              .from(employees)
              .where(
                and(
                  inArray(employees.primaryTeamId, mappedTeamIdArray),
                  eq(employees.employmentStatus, "active")
                )
              )
          : [];
      const rosterSize = activeEmployees.length;
      shouldAutoApprove =
        rosterSize === 0 || eligible.length <= rosterSize * AUTO_APPROVE_ROSTER_PERCENT;
    }

    if (eligible.length > AUTO_APPROVE_ABSOLUTE_MAX) {
      logger.warn("Circuit breaker tripped: too many new candidates, falling back to pending", {
        dataSourceId,
        eligibleCount: eligible.length,
        absoluteMax: AUTO_APPROVE_ABSOLUTE_MAX,
      });
    }

    // --- Pass 2: write candidates ---
    for (const member of eligible) {
      // A matching employee may be a return, transfer or missing source binding.
      // It is not evidence for creating a second employee with a fresh history.
      const existingEmployee =
        member.externalEmail &&
        existingEmployeeEmails.has(member.externalEmail.trim().toLowerCase());
      if (shouldAutoApprove && !existingEmployee && !options.reviewOnly) {
        try {
          await tx.transaction(async (tx) => {
            const today = new Date().toISOString().split("T")[0]!;
            const [employee] = await tx
              .insert(employees)
              .values({
                organizationId: source.organizationId,
                displayName:
                  member.externalDisplayName ?? member.externalEmail ?? member.externalId,
                email: member.externalEmail,
                primaryTeamId: member.teamId,
                line: member.line ?? null,
              })
              .returning();

            if (employee) {
              await tx.insert(externalIdentities).values({
                employeeId: employee.id,
                dataSourceId,
                externalEntityType: "agent",
                externalId: member.externalId,
                externalEmail: member.externalEmail,
                externalDisplayName: member.externalDisplayName,
                matchMethod: "roster_discovery",
                matchConfidence: 1,
              });

              if (member.teamId) {
                await tx.insert(teamMemberships).values({
                  employeeId: employee.id,
                  teamId: member.teamId,
                  effectiveFrom: today,
                });
              }
            }

            await tx.insert(rosterCandidates).values({
              dataSourceId,
              observationId,
              externalId: member.externalId,
              externalEmail: member.externalEmail,
              externalDisplayName: member.externalDisplayName,
              changeType: "new",
              suggestedTeamId: member.teamId,
              suggestedLine: member.line ?? null,
              status: "auto_approved",
              reviewedAt: new Date(),
            });
          });
          autoApproved++;
        } catch (err) {
          logger.error("Failed to auto-approve candidate, inserting as pending", {
            dataSourceId,
            error: err,
          });
          await tx.insert(rosterCandidates).values({
            dataSourceId,
            observationId,
            externalId: member.externalId,
            externalEmail: member.externalEmail,
            externalDisplayName: member.externalDisplayName,
            changeType: "new",
            suggestedTeamId: member.teamId,
            suggestedLine: member.line ?? null,
            status: "pending",
          });
          newCandidates++;
        }
      } else {
        await tx.insert(rosterCandidates).values({
          dataSourceId,
          observationId,
          externalId: member.externalId,
          externalEmail: member.externalEmail,
          externalDisplayName: member.externalDisplayName,
          changeType: "new",
          suggestedTeamId: member.teamId,
          suggestedLine: member.line ?? null,
          status: "pending",
        });
        newCandidates++;
      }
    }

    for (const identity of known) {
      if (
        discoveredIds.has(identityKey(identity.externalId)) ||
        pendingDepartureIds.has(identityKey(identity.externalId))
      )
        continue;

      const [employee] = await tx
        .select({
          primaryTeamId: employees.primaryTeamId,
          employmentStatus: employees.employmentStatus,
        })
        .from(employees)
        .where(
          and(
            eq(employees.id, identity.employeeId),
            eq(employees.organizationId, source.organizationId)
          )
        );
      if (!employee?.primaryTeamId || !mappedTeamIds.has(employee.primaryTeamId)) continue;
      if (employee.employmentStatus !== "active") continue;

      await tx.insert(rosterCandidates).values({
        dataSourceId,
        observationId,
        previousEmployeeState: previousState(peopleById.get(identity.employeeId)!),
        externalId: identity.externalId,
        externalEmail: identity.externalEmail,
        externalDisplayName: identity.externalDisplayName,
        changeType: "departed",
        employeeId: identity.employeeId,
        status: "pending",
      });
      departedCandidates++;
    }

    const result = { newCandidates, departedCandidates, autoApproved };
    await options.recordResult?.(tx, result);
    return result;
  });
}

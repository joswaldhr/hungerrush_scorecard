import { db } from "@/lib/db";
import {
  externalIdentities,
  rosterSourceTeamMappings,
  rosterCandidates,
  dataSources,
  employees,
  teamMemberships,
  users,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import type { Connector } from "@/lib/connectors";
import type { DiscoveredRosterMember } from "@/lib/connectors/types";
import { logger } from "@/lib/logger";

const AUTO_APPROVE_ABSOLUTE_MAX = 5;
const AUTO_APPROVE_ROSTER_PERCENT = 0.3;

export async function discoverRosterCandidates(
  connector: Connector,
  dataSourceId: string
): Promise<{ newCandidates: number; departedCandidates: number; autoApproved: number }> {
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

  const existingNewCandidates = await db
    .select({ externalId: rosterCandidates.externalId })
    .from(rosterCandidates)
    .where(
      and(eq(rosterCandidates.dataSourceId, dataSourceId), eq(rosterCandidates.changeType, "new"))
    );
  const seenNewExternalIds = new Set(existingNewCandidates.map((c) => c.externalId));

  const managerUsers = await db.select({ email: users.email }).from(users);
  const managerEmails = new Set(managerUsers.map((u) => u.email.toLowerCase()));

  let newCandidates = 0;
  let autoApproved = 0;
  let departedCandidates = 0;

  // --- Pass 1: collect eligible new-hire candidates ---
  const eligible: DiscoveredRosterMember[] = [];
  for (const member of discovered) {
    if (knownExternalIds.has(member.externalId)) continue;
    if (seenNewExternalIds.has(member.externalId)) continue;
    if (member.externalEmail && managerEmails.has(member.externalEmail.toLowerCase())) continue;
    eligible.push(member);
  }

  // --- Circuit breaker: too many at once means something structural changed ---
  let shouldAutoApprove = false;
  if (eligible.length > 0 && eligible.length <= AUTO_APPROVE_ABSOLUTE_MAX) {
    const mappedTeamIdArray = [...mappedTeamIds];
    const activeEmployees =
      mappedTeamIdArray.length > 0
        ? await db
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

  if (shouldAutoApprove && eligible.length > 0) {
    logger.info("Auto-approving new-hire candidates", {
      dataSourceId,
      count: eligible.length,
    });
  } else if (eligible.length > AUTO_APPROVE_ABSOLUTE_MAX) {
    logger.warn("Circuit breaker tripped: too many new candidates, falling back to pending", {
      dataSourceId,
      eligibleCount: eligible.length,
      absoluteMax: AUTO_APPROVE_ABSOLUTE_MAX,
    });
  }

  // --- Pass 2: write candidates ---
  for (const member of eligible) {
    if (shouldAutoApprove) {
      try {
        const today = new Date().toISOString().split("T")[0]!;
        const [employee] = await db
          .insert(employees)
          .values({
            organizationId: source.organizationId,
            displayName: member.externalDisplayName ?? member.externalEmail ?? member.externalId,
            email: member.externalEmail,
            primaryTeamId: member.teamId,
          })
          .returning();

        if (employee) {
          await db.insert(externalIdentities).values({
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
            await db.insert(teamMemberships).values({
              employeeId: employee.id,
              teamId: member.teamId,
              effectiveFrom: today,
            });
          }
        }

        await db.insert(rosterCandidates).values({
          dataSourceId,
          externalId: member.externalId,
          externalEmail: member.externalEmail,
          externalDisplayName: member.externalDisplayName,
          changeType: "new",
          suggestedTeamId: member.teamId,
          status: "auto_approved",
          reviewedAt: new Date(),
        });
        autoApproved++;
      } catch (err) {
        logger.error("Failed to auto-approve candidate, inserting as pending", {
          externalId: member.externalId,
          error: err instanceof Error ? err.message : String(err),
        });
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
    } else {
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
  }

  for (const identity of known) {
    if (discoveredIds.has(identity.externalId)) continue;

    const [employee] = await db
      .select({
        primaryTeamId: employees.primaryTeamId,
        employmentStatus: employees.employmentStatus,
      })
      .from(employees)
      .where(eq(employees.id, identity.employeeId));
    if (!employee?.primaryTeamId || !mappedTeamIds.has(employee.primaryTeamId)) continue;
    if (employee.employmentStatus !== "active") continue;

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

  return { newCandidates, departedCandidates, autoApproved };
}

// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  employees,
  organizations,
  users,
  teams,
  teamMemberships,
  managerAssignments,
  managerRosterArchives,
  dataSources,
  externalIdentities,
  rosterCandidates,
  rosterObservations,
  rosterSourceTeamMappings,
} from "@/lib/db/schema";
import { changeManagerArchive, getManagerArchives } from "@/lib/domain/roster/manager-archive";
import { discoverRosterCandidates } from "@/lib/domain/roster/reconcile";
import type { Connector } from "@/lib/connectors/types";

let org: string,
  manager: string,
  other: string,
  admin: string,
  person: string,
  unassigned: string,
  team: string,
  source: string;
beforeEach(async () => {
  org = randomUUID();
  manager = randomUUID();
  other = randomUUID();
  admin = randomUUID();
  person = randomUUID();
  unassigned = randomUUID();
  team = randomUUID();
  source = randomUUID();
  await db.insert(organizations).values({ id: org, name: "Synthetic archive test" });
  await db.insert(users).values(
    [manager, other, admin].map((id) => ({
      id,
      organizationId: org,
      email: `${id}@example.invalid`,
      displayName: "Synthetic manager",
      isPlatformAdmin: id === admin,
    }))
  );
  await db
    .insert(teams)
    .values({ id: team, organizationId: org, name: "Synthetic team", slug: team });
  await db.insert(employees).values(
    [person, unassigned].map((id) => ({
      id,
      organizationId: org,
      primaryTeamId: team,
      displayName: "Synthetic employee",
      email: `${id}@example.invalid`,
    }))
  );
  await db
    .insert(teamMemberships)
    .values({ employeeId: person, teamId: team, effectiveFrom: "2026-01-01" });
  await db.insert(managerAssignments).values(
    [manager, other].map((id) => ({
      managerUserId: id,
      teamId: team,
      assignmentType: "team",
      effectiveFrom: "2026-01-01",
    }))
  );
  await db
    .insert(dataSources)
    .values({ id: source, organizationId: org, type: "zendesk", displayName: "Synthetic source" });
  await db.insert(externalIdentities).values({
    employeeId: person,
    dataSourceId: source,
    externalId: `${person}@example.invalid`,
    externalEntityType: "agent",
    matchMethod: "synthetic",
  });
  await db.insert(rosterSourceTeamMappings).values({
    dataSourceId: source,
    teamId: team,
    externalGroupId: "1",
    externalGroupLabel: "Synthetic",
  });
});
afterEach(async () => {
  await db.delete(managerRosterArchives).where(eq(managerRosterArchives.organizationId, org));
  await db.delete(rosterCandidates).where(eq(rosterCandidates.dataSourceId, source));
  await db.delete(rosterObservations).where(eq(rosterObservations.dataSourceId, source));
  await db.delete(externalIdentities).where(eq(externalIdentities.dataSourceId, source));
  await db
    .delete(rosterSourceTeamMappings)
    .where(eq(rosterSourceTeamMappings.dataSourceId, source));
  await db.delete(dataSources).where(eq(dataSources.id, source));
  await db
    .delete(managerAssignments)
    .where(inArray(managerAssignments.managerUserId, [manager, other, admin]));
  await db.delete(teamMemberships).where(eq(teamMemberships.teamId, team));
  await db.delete(employees).where(eq(employees.organizationId, org));
  await db.delete(teams).where(eq(teams.organizationId, org));
  await db.delete(users).where(eq(users.organizationId, org));
  await db.delete(organizations).where(eq(organizations.id, org));
});
const input = () => ({
  organizationId: org,
  actorId: manager,
  managerId: manager,
  employeeId: person,
  action: "archive" as const,
  reason: "Manager confirmed team removal",
});
const ctx = (userId = manager) => ({
  organizationId: org,
  userId,
  assignedTeamIds: [team],
  assignedEmployeeIds: [person],
});

it("archives only this manager's list, without changing employee or membership history", async () => {
  const before = await db.select().from(employees).where(eq(employees.id, person));
  const memberships = await db
    .select()
    .from(teamMemberships)
    .where(eq(teamMemberships.employeeId, person));
  const result = await changeManagerArchive(input());
  expect(result.status).toBe("archived");
  expect(await getManagerArchives(ctx())).toHaveLength(1);
  expect(await getManagerArchives(ctx(other))).toEqual([]);
  expect(await db.select().from(employees).where(eq(employees.id, person))).toEqual(before);
  expect(
    await db.select().from(teamMemberships).where(eq(teamMemberships.employeeId, person))
  ).toEqual(memberships);
});
it("serializes concurrent archive requests and retains one decision", async () => {
  const results = await Promise.all([changeManagerArchive(input()), changeManagerArchive(input())]);
  expect(results.map((r) => r.status).sort()).toEqual(["already_archived", "archived"]);
  expect(await getManagerArchives(ctx())).toHaveLength(1);
});
it("restores explicitly, retains reviewer history, and rejects stale restore after a later archive", async () => {
  const first = await changeManagerArchive(input());
  await changeManagerArchive({
    ...input(),
    action: "restore",
    archiveId: first.id,
    reason: "Confirmed team return",
  });
  expect(await getManagerArchives(ctx())).toEqual([]);
  const second = await changeManagerArchive(input());
  await expect(
    changeManagerArchive({ ...input(), action: "restore", archiveId: first.id })
  ).rejects.toThrow("Archive changed");
  expect((await getManagerArchives(ctx()))[0]!.id).toBe(second.id);
  const rows = await db
    .select()
    .from(managerRosterArchives)
    .where(eq(managerRosterArchives.organizationId, org));
  expect(rows).toHaveLength(2);
  expect(rows.find((r) => r.id === first.id)?.restoredBy).toBe(manager);
});
it("rejects another manager's mutation, even in the same organization", async () => {
  await expect(changeManagerArchive({ ...input(), actorId: other })).rejects.toThrow(
    "not permitted"
  );
});
it("allows the organization's administrator to record a manager-confirmed decision", async () => {
  await changeManagerArchive({ ...input(), actorId: admin });
  const [row] = await db
    .select()
    .from(managerRosterArchives)
    .where(eq(managerRosterArchives.organizationId, org));
  expect(row?.archivedBy).toBe(admin);
  expect(row?.managerUserId).toBe(manager);
});
it("rejects foreign organization, unassigned employee, expired and future assignments", async () => {
  await expect(
    changeManagerArchive({ ...input(), organizationId: randomUUID() })
  ).rejects.toThrow();
  await expect(changeManagerArchive({ ...input(), employeeId: unassigned })).rejects.toThrow(
    "not permitted"
  );
  await db
    .update(managerAssignments)
    .set({ effectiveTo: "2026-01-02" })
    .where(eq(managerAssignments.managerUserId, manager));
  await expect(changeManagerArchive(input())).rejects.toThrow("not permitted");
  await db
    .update(managerAssignments)
    .set({ effectiveFrom: "2099-01-01", effectiveTo: null })
    .where(eq(managerAssignments.managerUserId, manager));
  await expect(changeManagerArchive(input())).rejects.toThrow("not permitted");
  expect(await getManagerArchives(ctx())).toEqual([]);
});
it("does not expand a direct employee assignment into team-wide archive permission", async () => {
  await db
    .update(managerAssignments)
    .set({ teamId: null, employeeId: unassigned })
    .where(eq(managerAssignments.managerUserId, manager));
  await expect(changeManagerArchive(input())).rejects.toThrow("not permitted");
  await changeManagerArchive({ ...input(), employeeId: unassigned });
});
it("requires an active actor and a meaningful bounded reason", async () => {
  await expect(changeManagerArchive({ ...input(), reason: " " })).rejects.toThrow();
  await expect(changeManagerArchive({ ...input(), reason: "x".repeat(501) })).rejects.toThrow();
  await db.update(users).set({ status: "inactive" }).where(eq(users.id, manager));
  await expect(changeManagerArchive(input())).rejects.toThrow("not permitted");
});
it("intersects archived reads with current employee and organization permissions", async () => {
  await changeManagerArchive(input());
  expect(await getManagerArchives({ ...ctx(), assignedEmployeeIds: [] })).toEqual([]);
  expect(await getManagerArchives({ ...ctx(), organizationId: randomUUID() })).toEqual([]);
});
it("retains manager archive after source rediscovery of the same employee", async () => {
  await changeManagerArchive(input());
  await discoverRosterCandidates(
    {
      discoverRoster: async () => [
        {
          externalId: `${person}@example.invalid`,
          externalEmail: `${person}@example.invalid`,
          externalDisplayName: "Synthetic",
          teamId: team,
        },
      ],
    } as unknown as Connector,
    source,
    { reviewOnly: true }
  );
  expect(await getManagerArchives(ctx())).toHaveLength(1);
  expect(
    await db.select().from(rosterCandidates).where(eq(rosterCandidates.dataSourceId, source))
  ).toEqual([]);
});

// @vitest-environment node
import { randomUUID } from "node:crypto";
import { beforeEach, afterEach, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  dataSources,
  employees,
  externalIdentities,
  organizations,
  rosterCandidates,
  rosterObservations,
  rosterSourceTeamMappings,
  teamMemberships,
  teams,
  users,
} from "@/lib/db/schema";
import { discoverRosterCandidates } from "@/lib/domain/roster/reconcile";
import { applyRosterTransition } from "@/lib/domain/roster/apply-transition";
import type { Connector, DiscoveredRosterMember } from "@/lib/connectors/types";

let org: string, source: string, first: string, second: string, person: string, reviewer: string;
const email = "lifecycle@example.invalid";
const today = () => new Date().toISOString().slice(0, 10);
beforeEach(async () => {
  org = randomUUID();
  source = randomUUID();
  first = randomUUID();
  second = randomUUID();
  person = randomUUID();
  reviewer = randomUUID();
  await db.insert(organizations).values({ id: org, name: "Synthetic lifecycle" });
  await db.insert(users).values({
    id: reviewer,
    organizationId: org,
    displayName: "Synthetic reviewer",
    email: `${reviewer}@example.invalid`,
    isPlatformAdmin: true,
  });
  await db
    .insert(teams)
    .values(
      [first, second].map((id) => ({ id, organizationId: org, name: "Synthetic team", slug: id }))
    );
  await db
    .insert(dataSources)
    .values({ id: source, organizationId: org, type: "zendesk", displayName: "Synthetic source" });
  await db.insert(rosterSourceTeamMappings).values(
    [first, second].map((teamId, i) => ({
      dataSourceId: source,
      teamId,
      externalGroupId: String(i + 1),
      externalGroupLabel: "Synthetic group",
    }))
  );
  await db.insert(employees).values({
    id: person,
    organizationId: org,
    primaryTeamId: first,
    displayName: "Synthetic employee",
    email,
  });
  await db.insert(externalIdentities).values({
    employeeId: person,
    dataSourceId: source,
    externalId: email,
    externalEntityType: "agent",
    matchMethod: "synthetic",
  });
  await db
    .insert(teamMemberships)
    .values({ employeeId: person, teamId: first, effectiveFrom: "2026-01-01" });
});
afterEach(async () => {
  await db.delete(rosterCandidates).where(eq(rosterCandidates.dataSourceId, source));
  await db.delete(rosterObservations).where(eq(rosterObservations.dataSourceId, source));
  await db.delete(externalIdentities).where(eq(externalIdentities.dataSourceId, source));
  await db.delete(teamMemberships).where(eq(teamMemberships.employeeId, person));
  await db.delete(employees).where(eq(employees.organizationId, org));
  await db
    .delete(rosterSourceTeamMappings)
    .where(eq(rosterSourceTeamMappings.dataSourceId, source));
  await db.delete(dataSources).where(eq(dataSources.id, source));
  await db.delete(teams).where(eq(teams.organizationId, org));
  await db.delete(users).where(eq(users.organizationId, org));
  await db.delete(organizations).where(eq(organizations.id, org));
});
const member = (teamId: string, externalId = email): DiscoveredRosterMember => ({
  externalId,
  externalEmail: externalId,
  externalDisplayName: "Synthetic",
  teamId,
});
async function discover(members: DiscoveredRosterMember[]) {
  return discoverRosterCandidates(
    { discoverRoster: async () => members } as unknown as Connector,
    source,
    {
      reviewOnly: true,
    }
  );
}
async function candidate(kind: string) {
  const [row] = await db
    .select()
    .from(rosterCandidates)
    .where(
      and(
        eq(rosterCandidates.dataSourceId, source),
        eq(rosterCandidates.changeType, kind),
        eq(rosterCandidates.status, "pending")
      )
    );
  expect(row).toBeDefined();
  return row!;
}
async function savedPerson() {
  return (await db.select().from(employees).where(eq(employees.id, person)))[0]!;
}

it("withdraws a departure when the employee reappears and cannot apply the old proposal", async () => {
  await discover([member(second, "another@example.invalid")]);
  const old = await candidate("departed");
  await discover([member(first)]);
  await applyRosterTransition(org, reviewer, old.id);
  const [saved] = await db.select().from(rosterCandidates).where(eq(rosterCandidates.id, old.id));
  expect(saved?.status).toBe("withdrawn");
  expect(saved?.withdrawnAt).not.toBeNull();
  expect((await savedPerson()).employmentStatus).toBe("active");
});

it("transfers exactly once, preserving employee identity and historical membership", async () => {
  await discover([member(second)]);
  const proposal = await candidate("transferred");
  await Promise.all([
    applyRosterTransition(org, reviewer, proposal.id),
    applyRosterTransition(org, reviewer, proposal.id),
  ]);
  expect((await savedPerson()).primaryTeamId).toBe(second);
  const memberships = await db
    .select()
    .from(teamMemberships)
    .where(eq(teamMemberships.employeeId, person));
  expect(memberships).toHaveLength(2);
  expect(memberships.find((m) => m.teamId === first)).toMatchObject({
    effectiveFrom: "2026-01-01",
    effectiveTo: today(),
  });
  expect(memberships.find((m) => m.teamId === second)).toMatchObject({
    effectiveFrom: today(),
    effectiveTo: null,
  });
  expect(
    await db.select().from(externalIdentities).where(eq(externalIdentities.employeeId, person))
  ).toHaveLength(1);
});

it("returns an archived employee using the original identity and a new membership interval", async () => {
  await db.update(employees).set({ employmentStatus: "inactive" }).where(eq(employees.id, person));
  await db
    .update(teamMemberships)
    .set({ effectiveTo: "2026-09-01" })
    .where(eq(teamMemberships.employeeId, person));
  await discover([member(first)]);
  await applyRosterTransition(org, reviewer, (await candidate("returned")).id);
  expect(await savedPerson()).toMatchObject({
    id: person,
    employmentStatus: "active",
    primaryTeamId: first,
  });
  const memberships = await db
    .select()
    .from(teamMemberships)
    .where(eq(teamMemberships.employeeId, person));
  expect(memberships).toHaveLength(2);
  expect(memberships.find((m) => m.effectiveFrom === "2026-01-01")?.effectiveTo).toBe("2026-09-01");
  expect(memberships.find((m) => m.effectiveTo === null)?.effectiveFrom).toBe(today());
});

it("archives a reviewed departure without deleting history", async () => {
  await discover([member(second, "another@example.invalid")]);
  await applyRosterTransition(org, reviewer, (await candidate("departed")).id);
  expect((await savedPerson()).employmentStatus).toBe("inactive");
  expect(
    (await db.select().from(teamMemberships).where(eq(teamMemberships.employeeId, person)))[0]
  ).toMatchObject({ effectiveFrom: "2026-01-01", effectiveTo: today() });
  expect(
    await db.select().from(externalIdentities).where(eq(externalIdentities.employeeId, person))
  ).toHaveLength(1);
});

it("does not archive an employee with another team membership", async () => {
  await db
    .insert(teamMemberships)
    .values({ employeeId: person, teamId: second, effectiveFrom: "2026-01-01" });
  await discover([member(second, "another@example.invalid")]);
  await expect(
    applyRosterTransition(org, reviewer, (await candidate("departed")).id)
  ).rejects.toThrow("Other team memberships");
  expect((await savedPerson()).employmentStatus).toBe("active");
});

it("blocks an empty source roster and old evidence from approving departures", async () => {
  await discover([]);
  const proposal = await candidate("departed");
  await expect(applyRosterTransition(org, reviewer, proposal.id)).rejects.toThrow("nonempty");
  await db
    .update(rosterObservations)
    .set({ observedAt: new Date(Date.now() - 37 * 60 * 60_000) })
    .where(eq(rosterObservations.dataSourceId, source));
  await expect(applyRosterTransition(org, reviewer, proposal.id)).rejects.toThrow("outdated");
  expect((await savedPerson()).employmentStatus).toBe("active");
});

it("refuses changed mappings or assignments and preserves all rows", async () => {
  await discover([member(second)]);
  const proposal = await candidate("transferred");
  await db.update(employees).set({ line: "manual-change" }).where(eq(employees.id, person));
  await expect(applyRosterTransition(org, reviewer, proposal.id)).rejects.toThrow(
    "assignment changed"
  );
  await db
    .update(rosterSourceTeamMappings)
    .set({ externalGroupId: "changed" })
    .where(eq(rosterSourceTeamMappings.teamId, second));
  await expect(applyRosterTransition(org, reviewer, proposal.id)).rejects.toThrow(
    "mappings changed"
  );
  expect((await savedPerson()).primaryTeamId).toBe(first);
});

it("withdraws missing new candidates and preserves explicit rejection", async () => {
  await discover([member(first), member(second, "new@example.invalid")]);
  const old = await candidate("new");
  await discover([member(first)]);
  expect(
    (await db.select().from(rosterCandidates).where(eq(rosterCandidates.id, old.id)))[0]?.status
  ).toBe("withdrawn");
  await discover([member(first), member(second, "new@example.invalid")]);
  const replacement = await candidate("new");
  expect(replacement.id).not.toBe(old.id);
  await db
    .update(rosterCandidates)
    .set({ status: "rejected" })
    .where(eq(rosterCandidates.id, replacement.id));
  await discover([member(first), member(second, "new@example.invalid")]);
  expect(
    await db
      .select()
      .from(rosterCandidates)
      .where(and(eq(rosterCandidates.dataSourceId, source), eq(rosterCandidates.status, "pending")))
  ).toHaveLength(0);
});

it("enforces organization scope before touching candidates", async () => {
  await discover([member(second)]);
  const proposal = await candidate("transferred");
  await applyRosterTransition(randomUUID(), reviewer, proposal.id);
  expect((await savedPerson()).primaryTeamId).toBe(first);
});

it("rolls membership and employee changes back if final review recording fails", async () => {
  await discover([member(second)]);
  const proposal = await candidate("transferred");
  const before = await db
    .select()
    .from(teamMemberships)
    .where(eq(teamMemberships.employeeId, person));
  await expect(applyRosterTransition(org, randomUUID(), proposal.id)).rejects.toThrow();
  expect((await savedPerson()).primaryTeamId).toBe(first);
  expect(
    await db.select().from(teamMemberships).where(eq(teamMemberships.employeeId, person))
  ).toEqual(before);
  expect((await candidate("transferred")).id).toBe(proposal.id);
});

it("refuses a review submitted from an older loaded observation", async () => {
  await discover([member(second)]);
  const old = await candidate("transferred");
  await discover([member(second)]);
  await expect(applyRosterTransition(org, reviewer, old.id, old.observationId!)).rejects.toThrow(
    "page loaded"
  );
  expect((await savedPerson()).primaryTeamId).toBe(first);
});

it("retains observation and proposal evidence when source collection fails", async () => {
  await discover([member(second)]);
  const observations = await db
    .select()
    .from(rosterObservations)
    .where(eq(rosterObservations.dataSourceId, source));
  const proposal = await candidate("transferred");
  await expect(
    discoverRosterCandidates(
      {
        discoverRoster: async () => {
          throw new Error("Synthetic failure");
        },
      } as unknown as Connector,
      source,
      { reviewOnly: true }
    )
  ).rejects.toThrow("Synthetic failure");
  expect(
    await db.select().from(rosterObservations).where(eq(rosterObservations.dataSourceId, source))
  ).toEqual(observations);
  expect(await candidate("transferred")).toEqual(proposal);
});

it("changes a line in the same team without duplicating membership", async () => {
  await db
    .update(rosterSourceTeamMappings)
    .set({ line: "restaurant" })
    .where(eq(rosterSourceTeamMappings.teamId, first));
  await discover([{ ...member(first), line: "restaurant" }]);
  await applyRosterTransition(org, reviewer, (await candidate("transferred")).id);
  expect((await savedPerson()).line).toBe("restaurant");
  expect(
    await db.select().from(teamMemberships).where(eq(teamMemberships.employeeId, person))
  ).toHaveLength(1);
});

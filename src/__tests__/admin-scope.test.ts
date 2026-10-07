// @vitest-environment node
import { randomUUID } from "node:crypto";
import { getAdminEmployeeDetail } from "@/lib/domain/roster/admin-queries";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { db } from "@/lib/db";
import {
  organizations,
  users,
  teams,
  employees,
  dataSources,
  metricDefinitions,
  metricVisibilityOverrides,
  teamMemberships,
  externalIdentities,
  rosterCandidates,
  rosterObservations,
  rosterSourceTeamMappings,
  reconciliationRuns,
  reconciliationResults,
  managerAssignments,
} from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { rosterMappingKey } from "@/lib/domain/roster/evidence";
import {
  createEmployee,
  createTeam,
  updateEmployee,
  setEmployeeTeam,
} from "@/app/(app)/admin/roster-actions";
import {
  setVisibilityOverride,
  removeVisibilityOverride,
  getManagerScorecardCount,
} from "@/app/(app)/admin/metric-visibility/actions";
import {
  addGroupMapping,
  removeGroupMapping,
  runRosterDiscovery,
  approveNewCandidate,
  approveDeparture,
  rejectCandidate,
  restoreRejectedCandidate,
} from "@/app/(app)/admin/roster-review/actions";
import { runReconciliation } from "@/lib/domain/reconciliation/engine";
import {
  getScopedReconciliationRun,
  getScopedReconciliationRuns,
} from "@/lib/domain/reconciliation/queries";
import {
  getManagerContext,
  getAssignedEmployees,
  type ManagerContext,
} from "@/lib/auth/authorization";

const a = {
  org: randomUUID(),
  user: randomUUID(),
  team: randomUUID(),
  employee: randomUUID(),
  source: randomUUID(),
  metric: randomUUID(),
};
const b = {
  org: randomUUID(),
  user: randomUUID(),
  team: randomUUID(),
  employee: randomUUID(),
  source: randomUUID(),
  metric: randomUUID(),
};
const coworker = randomUUID();
const orgIds = [a.org, b.org];
const sourceIds = [a.source, b.source];
const metricIds = [a.metric, b.metric];
const email = `admin-${a.user}@test.cadence.internal`;
const ctx: ManagerContext = {
  userId: a.user,
  organizationId: a.org,
  assignedTeamIds: [],
  assignedEmployeeIds: [a.employee],
};
function form(values: Record<string, string>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
}
async function qualifyCandidates(ids: string[]) {
  const candidates = await db
    .select()
    .from(rosterCandidates)
    .where(inArray(rosterCandidates.id, ids));
  const mappings = await db
    .select()
    .from(rosterSourceTeamMappings)
    .where(eq(rosterSourceTeamMappings.dataSourceId, a.source));
  const [source] = await db.select().from(dataSources).where(eq(dataSources.id, a.source));
  const [observation] = await db
    .insert(rosterObservations)
    .values({
      dataSourceId: a.source,
      sourceReference: source!.configurationReference,
      mappingKey: rosterMappingKey(mappings),
      members: candidates.map((c) => ({
        externalId: c.externalId,
        teamId: c.suggestedTeamId ?? a.team,
        line: c.suggestedLine,
      })),
    })
    .returning();
  for (const candidate of candidates)
    await db
      .update(rosterCandidates)
      .set({ observationId: observation!.id, suggestedTeamId: candidate.suggestedTeamId ?? a.team })
      .where(eq(rosterCandidates.id, candidate.id));
}
beforeAll(async () => {
  for (const fixture of [a, b]) {
    await db.insert(organizations).values({ id: fixture.org, name: "Scope test" });
    await db.insert(users).values({
      id: fixture.user,
      organizationId: fixture.org,
      displayName: "Admin",
      email: fixture === a ? email : `admin-${fixture.user}@test.cadence.internal`,
      isPlatformAdmin: true,
    });
    await db.insert(teams).values({
      id: fixture.team,
      organizationId: fixture.org,
      name: "Scope team",
      slug: `scope-${fixture.team}`,
    });
    await db.insert(employees).values({
      id: fixture.employee,
      organizationId: fixture.org,
      displayName: "Original",
      primaryTeamId: fixture.team,
    });
    await db.insert(dataSources).values({
      id: fixture.source,
      organizationId: fixture.org,
      type: "zendesk",
      displayName: "Test source",
    });
    await db.insert(metricDefinitions).values({
      id: fixture.metric,
      organizationId: fixture.org,
      key: "scope_test",
      name: "Scope test",
      valueType: "count",
      sourceStrategy: "zendesk",
      calculationType: "sum",
    });
  }
  await db.insert(employees).values({
    id: coworker,
    organizationId: a.org,
    displayName: "Coworker",
    primaryTeamId: a.team,
  });
  await db.insert(teamMemberships).values(
    [a.employee, coworker].map((employeeId) => ({
      employeeId,
      teamId: a.team,
      effectiveFrom: "2026-01-01",
    }))
  );
  authMock.mockResolvedValue({ user: { email } });
});
afterAll(async () => {
  const runs = db
    .select({ id: reconciliationRuns.id })
    .from(reconciliationRuns)
    .where(inArray(reconciliationRuns.organizationId, orgIds));
  await db
    .delete(reconciliationResults)
    .where(inArray(reconciliationResults.reconciliationRunId, runs));
  await db.delete(reconciliationRuns).where(inArray(reconciliationRuns.organizationId, orgIds));
  await db
    .delete(metricVisibilityOverrides)
    .where(inArray(metricVisibilityOverrides.metricDefinitionId, metricIds));
  await db.delete(rosterCandidates).where(inArray(rosterCandidates.dataSourceId, sourceIds));
  await db.delete(rosterObservations).where(inArray(rosterObservations.dataSourceId, sourceIds));
  await db
    .delete(rosterSourceTeamMappings)
    .where(inArray(rosterSourceTeamMappings.dataSourceId, sourceIds));
  await db.delete(externalIdentities).where(inArray(externalIdentities.dataSourceId, sourceIds));
  const employeeIds = db
    .select({ id: employees.id })
    .from(employees)
    .where(inArray(employees.organizationId, orgIds));
  await db.delete(teamMemberships).where(inArray(teamMemberships.employeeId, employeeIds));
  await db
    .delete(managerAssignments)
    .where(inArray(managerAssignments.managerUserId, [a.user, b.user]));
  await db.delete(employees).where(inArray(employees.organizationId, orgIds));
  await db.delete(metricDefinitions).where(inArray(metricDefinitions.organizationId, orgIds));
  await db.delete(dataSources).where(inArray(dataSources.organizationId, orgIds));
  await db.delete(teams).where(inArray(teams.organizationId, orgIds));
  await db.delete(users).where(inArray(users.organizationId, orgIds));
  await db.delete(organizations).where(inArray(organizations.id, orgIds));
});

describe("organization-scoped admin actions", () => {
  it("does not expose foreign employee details, teams, or manager names", async () => {
    expect(await getAdminEmployeeDetail(a.org, b.employee)).toBeNull();
    const [assignment] = await db
      .insert(managerAssignments)
      .values({
        managerUserId: b.user,
        teamId: a.team,
        assignmentType: "team",
        effectiveFrom: "2020-01-01",
      })
      .returning();
    try {
      const detail = await getAdminEmployeeDetail(a.org, a.employee);
      expect(detail?.employee.id).toBe(a.employee);
      expect(detail?.allTeams.map((t) => t.id)).toContain(a.team);
      expect(detail?.allTeams.map((t) => t.id)).not.toContain(b.team);
      expect(detail?.currentManager).toBeNull();
      await db
        .update(managerAssignments)
        .set({ managerUserId: a.user, effectiveFrom: "2999-01-01" })
        .where(eq(managerAssignments.id, assignment!.id));
      expect((await getAdminEmployeeDetail(a.org, a.employee))?.currentManager).toBeNull();
      await db
        .update(managerAssignments)
        .set({ effectiveFrom: "2020-01-01", effectiveTo: "2999-01-01" })
        .where(eq(managerAssignments.id, assignment!.id));
      expect((await getAdminEmployeeDetail(a.org, a.employee))?.currentManager?.displayName).toBe(
        "Admin"
      );
    } finally {
      await db.delete(managerAssignments).where(eq(managerAssignments.id, assignment!.id));
    }
  });
  it("preserves same-team history and clears the old line on a real transfer", async () => {
    const employeeId = randomUUID();
    const newTeamId = randomUUID();
    await db
      .insert(teams)
      .values({ id: newTeamId, organizationId: a.org, name: "Transfer team", slug: newTeamId });
    await db.insert(employees).values({
      id: employeeId,
      organizationId: a.org,
      displayName: "Synthetic transfer",
      primaryTeamId: a.team,
      line: "restaurant",
    });
    const [membership] = await db
      .insert(teamMemberships)
      .values({
        employeeId,
        teamId: a.team,
        effectiveFrom: "2020-01-01",
        effectiveTo: "2999-01-01",
      })
      .returning();
    await setEmployeeTeam(form({ employeeId, teamId: a.team }));
    expect((await getAdminEmployeeDetail(a.org, employeeId))?.currentMembership?.id).toBe(
      membership!.id
    );
    expect(
      await db.select().from(teamMemberships).where(eq(teamMemberships.employeeId, employeeId))
    ).toEqual([membership]);
    expect((await db.select().from(employees).where(eq(employees.id, employeeId)))[0]?.line).toBe(
      "restaurant"
    );
    await setEmployeeTeam(form({ employeeId, teamId: newTeamId }));
    const [transferred] = await db.select().from(employees).where(eq(employees.id, employeeId));
    expect(transferred).toMatchObject({ primaryTeamId: newTeamId, line: null });
    const memberships = await db
      .select()
      .from(teamMemberships)
      .where(eq(teamMemberships.employeeId, employeeId));
    expect(memberships.find((m) => m.id === membership!.id)?.effectiveTo).toBe(
      new Date().toISOString().slice(0, 10)
    );
    expect(memberships.filter((m) => m.effectiveTo === null)).toMatchObject([
      { teamId: newTeamId },
    ]);
  });
  it("derives create ownership from the session even with a foreign organizationId", async () => {
    await createEmployee(
      form({ displayName: "Created here", organizationId: b.org, teamId: a.team })
    );
    const [row] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.organizationId, a.org), eq(employees.displayName, "Created here")));
    expect(row?.organizationId).toBe(a.org);
    await updateEmployee(
      form({
        employeeId: row!.id,
        displayName: "Created here",
        employmentStatus: "terminated",
      })
    );
    const [updated] = await db.select().from(employees).where(eq(employees.id, row!.id));
    expect(updated?.employmentStatus).toBe("terminated");
    await createTeam(form({ name: "Created team", organizationId: b.org }));
    const created = await db
      .select()
      .from(teams)
      .where(and(eq(teams.organizationId, a.org), eq(teams.name, "Created team")));
    expect(created).toHaveLength(1);
  });
  it("rejects foreign employees and team references without mutation", async () => {
    await expect(
      updateEmployee(
        form({ employeeId: b.employee, displayName: "Hacked", employmentStatus: "inactive" })
      )
    ).rejects.toThrow();
    await expect(
      setEmployeeTeam(form({ employeeId: b.employee, teamId: a.team }))
    ).rejects.toThrow();
    await expect(
      setEmployeeTeam(form({ employeeId: a.employee, teamId: b.team }))
    ).rejects.toThrow();
    await expect(
      createEmployee(form({ displayName: "Rejected", teamId: b.team }))
    ).rejects.toThrow();
    const [foreign] = await db.select().from(employees).where(eq(employees.id, b.employee));
    expect(foreign?.displayName).toBe("Original");
    const [local] = await db.select().from(employees).where(eq(employees.id, a.employee));
    expect(local?.primaryTeamId).toBe(a.team);
  });
  it.each(["metric", "employee", "team", "user"] as const)(
    "rejects foreign visibility %s references",
    async (resource) => {
      await expect(
        setVisibilityOverride({
          scope: resource === "user" ? "manager_override" : "scorecard_override",
          managerUserId: resource === "user" ? b.user : null,
          targetEmployeeId:
            resource === "user" ? null : resource === "employee" ? b.employee : a.employee,
          metricDefinitionId: resource === "metric" ? b.metric : a.metric,
          teamId: resource === "team" ? b.team : null,
          line: null,
          hidden: true,
        })
      ).rejects.toThrow();
    }
  );
  it("does not delete foreign visibility rules or reveal a foreign manager's count", async () => {
    const [rule] = await db
      .insert(metricVisibilityOverrides)
      .values({
        scope: "global_default",
        metricDefinitionId: b.metric,
        hidden: true,
        hiddenBy: b.user,
      })
      .returning();
    await removeVisibilityOverride(form({ id: rule!.id }));
    expect(
      await db
        .select()
        .from(metricVisibilityOverrides)
        .where(eq(metricVisibilityOverrides.id, rule!.id))
    ).toHaveLength(1);
    await expect(getManagerScorecardCount(b.user)).rejects.toThrow();
  });
  it("scopes group mappings and discovery before any vendor request", async () => {
    await expect(
      addGroupMapping(
        form({
          dataSourceId: b.source,
          externalGroupId: "group",
          externalGroupLabel: "Group",
          teamId: a.team,
        })
      )
    ).rejects.toThrow();
    await expect(
      addGroupMapping(
        form({
          dataSourceId: a.source,
          externalGroupId: "group",
          externalGroupLabel: "Group",
          teamId: b.team,
        })
      )
    ).rejects.toThrow();
    await expect(
      runRosterDiscovery(form({ dataSourceId: b.source, dataSourceType: "zendesk" }))
    ).rejects.toThrow();
    const [mapping] = await db
      .insert(rosterSourceTeamMappings)
      .values({
        dataSourceId: b.source,
        externalGroupId: "foreign",
        externalGroupLabel: "Foreign",
        teamId: b.team,
      })
      .returning();
    await removeGroupMapping(form({ mappingId: mapping!.id }));
    expect(
      await db
        .select()
        .from(rosterSourceTeamMappings)
        .where(eq(rosterSourceTeamMappings.id, mapping!.id))
    ).toHaveLength(1);
  });
  it("cannot approve, reject, restore or depart a foreign candidate", async () => {
    const [candidate] = await db
      .insert(rosterCandidates)
      .values({ dataSourceId: b.source, externalId: "foreign-candidate", changeType: "new" })
      .returning();
    await approveNewCandidate(form({ candidateId: candidate!.id, teamId: a.team }));
    await rejectCandidate(form({ candidateId: candidate!.id }));
    let [current] = await db
      .select()
      .from(rosterCandidates)
      .where(eq(rosterCandidates.id, candidate!.id));
    expect(current?.status).toBe("pending");
    await db
      .update(rosterCandidates)
      .set({ status: "rejected" })
      .where(eq(rosterCandidates.id, candidate!.id));
    await restoreRejectedCandidate(form({ candidateId: candidate!.id }));
    [current] = await db
      .select()
      .from(rosterCandidates)
      .where(eq(rosterCandidates.id, candidate!.id));
    expect(current?.status).toBe("rejected");
    await db
      .update(rosterCandidates)
      .set({ status: "pending", changeType: "departed", employeeId: b.employee })
      .where(eq(rosterCandidates.id, candidate!.id));
    await approveDeparture(form({ candidateId: candidate!.id }));
    const [person] = await db.select().from(employees).where(eq(employees.id, b.employee));
    expect(person?.employmentStatus).toBe("active");
  });
  it("approves a local candidate atomically once and records the reviewer", async () => {
    const [candidate] = await db
      .insert(rosterCandidates)
      .values({
        dataSourceId: a.source,
        externalId: "local-candidate",
        externalDisplayName: "New person",
        changeType: "new",
        suggestedTeamId: a.team,
        suggestedLine: "synthetic-line",
      })
      .returning();
    await qualifyCandidates([candidate!.id]);
    await Promise.all([
      approveNewCandidate(form({ candidateId: candidate!.id, teamId: a.team })),
      approveNewCandidate(form({ candidateId: candidate!.id, teamId: a.team })),
    ]);
    const [current] = await db
      .select()
      .from(rosterCandidates)
      .where(eq(rosterCandidates.id, candidate!.id));
    expect(current?.reviewedBy).toBe(a.user);
    expect(current?.status).toBe("approved");
    const [approvedPerson] = await db
      .select()
      .from(employees)
      .where(eq(employees.displayName, "New person"));
    expect(approvedPerson?.line).toBe("synthetic-line");
    expect(
      await db
        .select()
        .from(externalIdentities)
        .where(
          and(
            eq(externalIdentities.dataSourceId, a.source),
            eq(externalIdentities.externalId, "local-candidate")
          )
        )
    ).toHaveLength(1);
  });

  it("keeps an existing inactive employee intact when a new candidate uses the same email", async () => {
    const email = "return-existing@example.invalid";
    const [person] = await db
      .insert(employees)
      .values({
        organizationId: a.org,
        displayName: "Existing inactive employee",
        email,
        employmentStatus: "inactive",
        primaryTeamId: a.team,
      })
      .returning();
    const [candidate] = await db
      .insert(rosterCandidates)
      .values({
        dataSourceId: a.source,
        externalId: "return-unbound",
        externalEmail: email.toUpperCase(),
        changeType: "new",
        suggestedTeamId: a.team,
      })
      .returning();
    await qualifyCandidates([candidate!.id]);
    await expect(
      approveNewCandidate(form({ candidateId: candidate!.id, teamId: a.team }))
    ).rejects.toThrow("already exists");
    expect(await db.select().from(employees).where(eq(employees.id, person!.id))).toEqual([person]);
    const [unchanged] = await db
      .select()
      .from(rosterCandidates)
      .where(eq(rosterCandidates.id, candidate!.id));
    expect(unchanged?.status).toBe("pending");
  });

  it("serializes different candidates for the same normalized source identity", async () => {
    const candidates = await db
      .insert(rosterCandidates)
      .values([
        { dataSourceId: a.source, externalId: "same-source@example.invalid", changeType: "new" },
        { dataSourceId: a.source, externalId: "SAME-SOURCE@example.invalid", changeType: "new" },
      ])
      .returning();
    await qualifyCandidates(candidates.map((c) => c.id));
    const results = await Promise.allSettled(
      candidates.map((candidate) =>
        approveNewCandidate(form({ candidateId: candidate.id, teamId: a.team }))
      )
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const saved = await db
      .select()
      .from(rosterCandidates)
      .where(
        inArray(
          rosterCandidates.id,
          candidates.map((candidate) => candidate.id)
        )
      );
    expect(saved.map((candidate) => candidate.status).sort()).toEqual(["approved", "pending"]);
  });
});

it("clears the suggested line when manual approval changes the suggested team", async () => {
  const [candidate] = await db
    .insert(rosterCandidates)
    .values({
      dataSourceId: a.source,
      externalId: "unassigned-line-candidate",
      externalDisplayName: "Unassigned line candidate",
      changeType: "new",
      suggestedTeamId: a.team,
      suggestedLine: "synthetic-line",
    })
    .returning();
  await qualifyCandidates([candidate!.id]);
  await approveNewCandidate(form({ candidateId: candidate!.id, teamId: "" }));
  const [person] = await db
    .select()
    .from(employees)
    .where(eq(employees.displayName, "Unassigned line candidate"));
  expect(person?.primaryTeamId).toBeNull();
  expect(person?.line).toBeNull();
});

describe("reconciliation employee boundary", () => {
  it("rejects a triggering user from another organization before creating a run", async () => {
    await expect(
      runReconciliation({
        organizationId: a.org,
        triggeredBy: b.user,
        employeeIds: [a.employee],
        periodStart: "2026-09-13",
        periodEnd: "2026-09-19",
      })
    ).rejects.toThrow("not permitted");
    expect(
      await db.select().from(reconciliationRuns).where(eq(reconciliationRuns.organizationId, a.org))
    ).toHaveLength(0);
  });
  it("intersects the team with permitted employees, rather than expanding to coworkers", async () => {
    const result = await runReconciliation({
      organizationId: a.org,
      triggeredBy: a.user,
      teamId: a.team,
      employeeIds: [a.employee, b.employee],
      periodStart: "2026-09-13",
      periodEnd: "2026-09-19",
    });
    expect(result.totalComparisons).toBe(1);
    const results = await db
      .select()
      .from(reconciliationResults)
      .where(eq(reconciliationResults.reconciliationRunId, result.runId));
    expect(results.map((r) => r.employeeId)).toEqual([a.employee]);
  });
  it("filters legacy broad-run counts as well as detail on list and detail reads", async () => {
    const [run] = await db
      .insert(reconciliationRuns)
      .values({
        organizationId: a.org,
        triggeredBy: a.user,
        teamId: a.team,
        periodStart: "2026-09-13",
        periodEnd: "2026-09-19",
        status: "completed",
        totalComparisons: 2,
        mismatchCount: 1,
        matchCount: 1,
      })
      .returning();
    await db.insert(reconciliationResults).values(
      [a.employee, coworker].map((employeeId, i) => ({
        reconciliationRunId: run!.id,
        metricDefinitionId: a.metric,
        employeeId,
        periodStart: "2026-09-13",
        periodEnd: "2026-09-19",
        metricKey: "scope_test",
        factType: "scope_test",
        status: i === 0 ? "match" : "mismatch",
      }))
    );
    const detail = await getScopedReconciliationRun(ctx, run!.id);
    expect(detail?.results).toHaveLength(1);
    expect(detail?.run.totalComparisons).toBe(1);
    expect(detail?.run.mismatchCount).toBe(0);
    const listed = (await getScopedReconciliationRuns(ctx)).find((r) => r.id === run!.id);
    expect(listed?.totalComparisons).toBe(1);
    expect(listed?.mismatchCount).toBe(0);
    const foreign = {
      ...ctx,
      organizationId: b.org,
      userId: b.user,
      assignedEmployeeIds: [b.employee],
    };
    expect(await getScopedReconciliationRun(foreign, run!.id)).toBeNull();
    expect(await getScopedReconciliationRuns(foreign)).toHaveLength(0);
  });
  it("does not grant access from a future manager assignment", async () => {
    await db.insert(managerAssignments).values({
      managerUserId: a.user,
      employeeId: a.employee,
      assignmentType: "direct",
      effectiveFrom: "2999-01-01",
    });
    expect(await getManagerContext(email)).toBeNull();
    expect(await getManagerScorecardCount(a.user)).toBe(0);
  });

  it("does not retain access through a membership closed today", async () => {
    await db.insert(managerAssignments).values({
      managerUserId: a.user,
      teamId: a.team,
      assignmentType: "team",
      effectiveFrom: "2026-01-01",
    });
    await db
      .update(teamMemberships)
      .set({ effectiveTo: new Date().toISOString().slice(0, 10) })
      .where(eq(teamMemberships.employeeId, a.employee));
    const current = await getManagerContext(email);
    expect(current?.assignedEmployeeIds).not.toContain(a.employee);
    expect(current?.assignedEmployeeIds).toContain(coworker);
    expect(await getManagerScorecardCount(a.user)).toBe(
      (await getAssignedEmployees(current!)).length
    );
  });
});

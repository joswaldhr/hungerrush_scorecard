// Integration tests against a real Postgres database (see vitest.config.mts's
// test.env, which points DATABASE_URL at the docker-compose db by default).
// Locally: `docker compose up -d && pnpm db:migrate` before `pnpm test`.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  organizations,
  users,
  teams,
  employees,
  teamMemberships,
  managerAssignments,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

let mockViewAsCookie: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "cadence_view_as" && mockViewAsCookie !== undefined
        ? { name, value: mockViewAsCookie }
        : undefined,
  }),
}));

// requireAdmin() (added 2026-09-21) calls next-auth's auth() directly from
// authorization.ts -- importing the real module fails to resolve under
// Vitest ("Cannot find module '.../next-auth/.../next/server'"), the same
// issue metric-visibility-actions.test.ts already works around. Mocked here
// purely so this file's module graph loads; no test below exercises
// requireAdmin's actual session, so the return value is never asserted on.
vi.mock("@/lib/auth", () => ({ auth: async () => null }));

const {
  getManagerContext,
  getUserJobTitle,
  getEffectiveManagerContext,
  isPlatformAdmin,
  assertCanAccessEmployee,
  assertCanAccessTeam,
  listManagersForViewAs,
  getAssignedEmployees,
  getVisibleTeamsForManager,
} = await import("@/lib/auth/authorization");

const ORG_ID = "99999999-0000-4000-8000-000000000001";
const TEAM_ID = "99999999-0000-4000-8000-000000000002";
const OTHER_TEAM_ID = "99999999-0000-4000-8000-000000000003";
const EMPLOYEE_ID = "99999999-0000-4000-8000-000000000004";
const OTHER_EMPLOYEE_ID = "99999999-0000-4000-8000-000000000005";
// A second organization, entirely separate from ORG_ID, to prove admin
// operations (view-as, listManagersForViewAs) can't cross the org boundary.
const OTHER_ORG_ID = "99999999-0000-4000-8000-000000000006";
const OTHER_ORG_TEAM_ID = "99999999-0000-4000-8000-000000000007";

const MANAGER_ID = "99999999-0000-4000-8000-0000000000a1";
const ADMIN_ID = "99999999-0000-4000-8000-0000000000a2";
const OUTSIDER_ID = "99999999-0000-4000-8000-0000000000a3";
const INACTIVE_MANAGER_ID = "99999999-0000-4000-8000-0000000000a4";
const ADMIN_WITH_OWN_TEAM_ID = "99999999-0000-4000-8000-0000000000a5";
const OTHER_ORG_MANAGER_ID = "99999999-0000-4000-8000-0000000000a6";
// A sub-manager whose access comes entirely from an employee-level
// assignment, no team-level grant at all -- the real shape Jacob Murray,
// James Maynard, and Norvel Crawford have in production (see FOLLOWUPS.md
// item 16).
const SUB_MANAGER_ID = "99999999-0000-4000-8000-0000000000a7";

// Deliberately suffixed (unlike the other constants below) -- roster-reconcile.test.ts
// independently defines its own MANAGER_EMAIL = "test-manager@test.cadence.internal".
// Both files' fixtures hit the same shared CI Postgres database with no isolation between
// test files, and a bare "test-manager@..." collided across the two on 2026-09-21 (a
// pre-existing latent bug this session's larger insert batch happened to newly expose as
// a `users_email_unique` violation, not something introduced by these changes).
const MANAGER_EMAIL = "test-manager-auth@test.cadence.internal";
const ADMIN_EMAIL = "test-admin@test.cadence.internal";
const OUTSIDER_EMAIL = "test-outsider@test.cadence.internal";
const INACTIVE_MANAGER_EMAIL = "test-inactive@test.cadence.internal";
const ADMIN_WITH_OWN_TEAM_EMAIL = "test-admin-own-team@test.cadence.internal";
const OTHER_ORG_MANAGER_EMAIL = "test-other-org-manager@test.cadence.internal";
const SUB_MANAGER_EMAIL = "test-sub-manager@test.cadence.internal";

const ALL_TEST_USER_IDS = [
  MANAGER_ID,
  ADMIN_ID,
  OUTSIDER_ID,
  INACTIVE_MANAGER_ID,
  ADMIN_WITH_OWN_TEAM_ID,
  OTHER_ORG_MANAGER_ID,
  SUB_MANAGER_ID,
];

async function cleanup() {
  await db
    .delete(managerAssignments)
    .where(inArray(managerAssignments.managerUserId, ALL_TEST_USER_IDS));
  await db.delete(users).where(inArray(users.id, ALL_TEST_USER_IDS));
  await db
    .delete(teamMemberships)
    .where(inArray(teamMemberships.employeeId, [EMPLOYEE_ID, OTHER_EMPLOYEE_ID]));
  await db.delete(employees).where(inArray(employees.id, [EMPLOYEE_ID, OTHER_EMPLOYEE_ID]));
  await db.delete(teams).where(inArray(teams.id, [TEAM_ID, OTHER_TEAM_ID, OTHER_ORG_TEAM_ID]));
  await db.delete(organizations).where(inArray(organizations.id, [ORG_ID, OTHER_ORG_ID]));
}

beforeAll(async () => {
  await cleanup();

  await db.insert(organizations).values([
    { id: ORG_ID, name: "Test Org" },
    { id: OTHER_ORG_ID, name: "Other Test Org" },
  ]);
  await db.insert(teams).values([
    { id: TEAM_ID, organizationId: ORG_ID, name: "Test Team", slug: "test-team" },
    { id: OTHER_TEAM_ID, organizationId: ORG_ID, name: "Other Team", slug: "other-team" },
    {
      id: OTHER_ORG_TEAM_ID,
      organizationId: OTHER_ORG_ID,
      name: "Other Org Team",
      slug: "other-org-team",
    },
  ]);
  await db.insert(employees).values([
    {
      id: EMPLOYEE_ID,
      organizationId: ORG_ID,
      primaryTeamId: TEAM_ID,
      displayName: "Test Employee",
    },
    {
      id: OTHER_EMPLOYEE_ID,
      organizationId: ORG_ID,
      primaryTeamId: OTHER_TEAM_ID,
      displayName: "Other Employee",
    },
  ]);
  // getManagerContext resolves assignedEmployeeIds via team_memberships, not
  // employees.primary_team_id directly — both must be set for a team-scoped
  // manager assignment to see the employee.
  await db.insert(teamMemberships).values([
    { employeeId: EMPLOYEE_ID, teamId: TEAM_ID, effectiveFrom: "2020-01-01" },
    { employeeId: OTHER_EMPLOYEE_ID, teamId: OTHER_TEAM_ID, effectiveFrom: "2020-01-01" },
  ]);
  await db.insert(users).values([
    { id: MANAGER_ID, organizationId: ORG_ID, email: MANAGER_EMAIL, displayName: "Test Manager" },
    {
      id: ADMIN_ID,
      organizationId: ORG_ID,
      email: ADMIN_EMAIL,
      displayName: "Test Admin",
      isPlatformAdmin: true,
    },
    {
      id: OUTSIDER_ID,
      organizationId: ORG_ID,
      email: OUTSIDER_EMAIL,
      displayName: "Test Outsider",
    },
    {
      id: INACTIVE_MANAGER_ID,
      organizationId: ORG_ID,
      email: INACTIVE_MANAGER_EMAIL,
      displayName: "Test Inactive Manager",
      status: "inactive",
    },
    {
      id: ADMIN_WITH_OWN_TEAM_ID,
      organizationId: ORG_ID,
      email: ADMIN_WITH_OWN_TEAM_EMAIL,
      displayName: "Test Admin With Own Team",
      isPlatformAdmin: true,
    },
    {
      id: OTHER_ORG_MANAGER_ID,
      organizationId: OTHER_ORG_ID,
      email: OTHER_ORG_MANAGER_EMAIL,
      displayName: "Test Other Org Manager",
    },
    {
      id: SUB_MANAGER_ID,
      organizationId: ORG_ID,
      email: SUB_MANAGER_EMAIL,
      displayName: "Test Sub Manager",
    },
  ]);
  await db.insert(managerAssignments).values([
    {
      managerUserId: MANAGER_ID,
      teamId: TEAM_ID,
      assignmentType: "team",
      effectiveFrom: "2020-01-01",
    },
    {
      managerUserId: INACTIVE_MANAGER_ID,
      teamId: TEAM_ID,
      assignmentType: "team",
      effectiveFrom: "2020-01-01",
    },
    {
      managerUserId: ADMIN_WITH_OWN_TEAM_ID,
      teamId: OTHER_TEAM_ID,
      assignmentType: "team",
      effectiveFrom: "2020-01-01",
    },
    {
      managerUserId: OTHER_ORG_MANAGER_ID,
      teamId: OTHER_ORG_TEAM_ID,
      assignmentType: "team",
      effectiveFrom: "2020-01-01",
    },
    {
      // Employee-only -- no teamId at all, the exact shape a real
      // sub-manager has (see FOLLOWUPS.md item 16).
      managerUserId: SUB_MANAGER_ID,
      employeeId: EMPLOYEE_ID,
      assignmentType: "employee",
      effectiveFrom: "2020-01-01",
    },
  ]);
});

afterAll(async () => {
  await cleanup();
});

describe("getManagerContext", () => {
  it("returns the manager's scoped context for a real assignment", async () => {
    const ctx = await getManagerContext(MANAGER_EMAIL);
    expect(ctx).not.toBeNull();
    expect(ctx!.userId).toBe(MANAGER_ID);
    expect(ctx!.organizationId).toBe(ORG_ID);
    expect(ctx!.assignedTeamIds).toEqual([TEAM_ID]);
    expect(ctx!.assignedEmployeeIds).toEqual([EMPLOYEE_ID]);
    expect(ctx!.assignedEmployeeIds).not.toContain(OTHER_EMPLOYEE_ID);
  });

  it("returns null for a user with no assignment", async () => {
    expect(await getManagerContext(OUTSIDER_EMAIL)).toBeNull();
  });

  it("returns null for an unknown email", async () => {
    expect(await getManagerContext("nobody@test.cadence.internal")).toBeNull();
  });

  it("returns null for an inactive user even with a real assignment", async () => {
    expect(await getManagerContext(INACTIVE_MANAGER_EMAIL)).toBeNull();
  });
});

describe("isPlatformAdmin", () => {
  it("is true for a platform admin", async () => {
    expect(await isPlatformAdmin(ADMIN_EMAIL)).toBe(true);
  });

  it("is false for a regular manager", async () => {
    expect(await isPlatformAdmin(MANAGER_EMAIL)).toBe(false);
  });

  it("is false for an unknown email", async () => {
    expect(await isPlatformAdmin("nobody@test.cadence.internal")).toBe(false);
  });
});

describe("getEffectiveManagerContext", () => {
  it("returns the manager's own context, ignoring any view-as cookie", async () => {
    mockViewAsCookie = ADMIN_ID;
    const result = await getEffectiveManagerContext(MANAGER_EMAIL);
    expect(result.ctx?.userId).toBe(MANAGER_ID);
    expect(result.isPlatformAdmin).toBe(false);
    expect(result.viewingAs).toBeNull();
  });

  it("a platform admin's own assignment wins over view-as, but isPlatformAdmin stays true", async () => {
    mockViewAsCookie = MANAGER_ID;
    const result = await getEffectiveManagerContext(ADMIN_WITH_OWN_TEAM_EMAIL);
    expect(result.ctx?.userId).toBe(ADMIN_WITH_OWN_TEAM_ID);
    expect(result.isPlatformAdmin).toBe(true);
    expect(result.viewingAs).toBeNull();
  });

  it("a non-admin with no assignment gets nothing, regardless of cookie", async () => {
    mockViewAsCookie = MANAGER_ID;
    const result = await getEffectiveManagerContext(OUTSIDER_EMAIL);
    expect(result.ctx).toBeNull();
    expect(result.isPlatformAdmin).toBe(false);
    expect(result.viewingAs).toBeNull();
  });

  it("a platform admin with no assignment and no cookie gets nothing", async () => {
    mockViewAsCookie = undefined;
    const result = await getEffectiveManagerContext(ADMIN_EMAIL);
    expect(result.ctx).toBeNull();
    expect(result.isPlatformAdmin).toBe(true);
    expect(result.viewingAs).toBeNull();
  });

  it("a platform admin with a valid view-as cookie gets that manager's real context", async () => {
    mockViewAsCookie = MANAGER_ID;
    const result = await getEffectiveManagerContext(ADMIN_EMAIL);
    expect(result.ctx?.userId).toBe(MANAGER_ID);
    expect(result.ctx?.assignedTeamIds).toEqual([TEAM_ID]);
    expect(result.isPlatformAdmin).toBe(true);
    expect(result.viewingAs).toEqual({ userId: MANAGER_ID, displayName: "Test Manager" });
  });

  it("a platform admin with a bogus view-as cookie value gets nothing, not a crash", async () => {
    mockViewAsCookie = "not-a-real-user-id";
    const result = await getEffectiveManagerContext(ADMIN_EMAIL);
    expect(result.ctx).toBeNull();
    expect(result.isPlatformAdmin).toBe(true);
    expect(result.viewingAs).toBeNull();
  });

  it("a platform admin cannot view-as an inactive manager", async () => {
    mockViewAsCookie = INACTIVE_MANAGER_ID;
    const result = await getEffectiveManagerContext(ADMIN_EMAIL);
    expect(result.ctx).toBeNull();
    expect(result.viewingAs).toBeNull();
  });

  it("a platform admin cannot view-as a manager in a different organization", async () => {
    mockViewAsCookie = OTHER_ORG_MANAGER_ID;
    const result = await getEffectiveManagerContext(ADMIN_EMAIL);
    expect(result.ctx).toBeNull();
    expect(result.isPlatformAdmin).toBe(true);
    expect(result.viewingAs).toBeNull();
  });
});

describe("assertCanAccessEmployee / assertCanAccessTeam", () => {
  it("does not throw for an employee/team in scope", async () => {
    const ctx = await getManagerContext(MANAGER_EMAIL);
    expect(() => assertCanAccessEmployee(ctx!, EMPLOYEE_ID)).not.toThrow();
    expect(() => assertCanAccessTeam(ctx!, TEAM_ID)).not.toThrow();
  });

  it("throws for an employee/team outside scope", async () => {
    const ctx = await getManagerContext(MANAGER_EMAIL);
    expect(() => assertCanAccessEmployee(ctx!, OTHER_EMPLOYEE_ID)).toThrow();
    expect(() => assertCanAccessTeam(ctx!, OTHER_TEAM_ID)).toThrow();
  });
});

it("does not use another organization's employee profile for a matching email", async () => {
  const foreign = randomUUID();
  const local = randomUUID();
  try {
    await db
      .insert(employees)
      .values({
        id: foreign,
        organizationId: OTHER_ORG_ID,
        displayName: "Synthetic foreign profile",
        email: MANAGER_EMAIL,
        jobTitle: "Foreign title",
      });
    expect(await getUserJobTitle(MANAGER_EMAIL)).toBeNull();
    await db
      .insert(employees)
      .values({
        id: local,
        organizationId: ORG_ID,
        displayName: "Synthetic local profile",
        email: MANAGER_EMAIL,
        jobTitle: "Local title",
      });
    expect(await getUserJobTitle(MANAGER_EMAIL)).toBe("Local title");
    expect(await getUserJobTitle("unknown@example.test")).toBeNull();
  } finally {
    await db.delete(employees).where(inArray(employees.id, [foreign, local]));
  }
});

describe("listManagersForViewAs", () => {
  it("uses inclusive starts and exclusive ends, including currently active finite assignments", async () => {
    const [assignment] = await db
      .insert(managerAssignments)
      .values({
        managerUserId: OUTSIDER_ID,
        teamId: TEAM_ID,
        assignmentType: "team",
        effectiveFrom: "2999-01-01",
      })
      .returning();
    try {
      expect((await listManagersForViewAs(ORG_ID)).map((m) => m.userId)).not.toContain(OUTSIDER_ID);
      await db
        .update(managerAssignments)
        .set({ effectiveFrom: "2020-01-01", effectiveTo: "2999-01-01" })
        .where(eq(managerAssignments.id, assignment!.id));
      expect((await listManagersForViewAs(ORG_ID)).map((m) => m.userId)).toContain(OUTSIDER_ID);
      await db
        .update(managerAssignments)
        .set({ effectiveTo: new Date().toISOString().slice(0, 10) })
        .where(eq(managerAssignments.id, assignment!.id));
      expect((await listManagersForViewAs(ORG_ID)).map((m) => m.userId)).not.toContain(OUTSIDER_ID);
    } finally {
      await db.delete(managerAssignments).where(eq(managerAssignments.id, assignment!.id));
    }
  });
  it("includes active managers with a real assignment, not admins/outsiders/other orgs", async () => {
    const managers = await listManagersForViewAs(ORG_ID);
    const ids = managers.map((m) => m.userId);
    expect(ids).toContain(MANAGER_ID);
    expect(ids).toContain(ADMIN_WITH_OWN_TEAM_ID);
    expect(ids).not.toContain(ADMIN_ID);
    expect(ids).not.toContain(OUTSIDER_ID);
    expect(ids).not.toContain(INACTIVE_MANAGER_ID);
    expect(ids).not.toContain(OTHER_ORG_MANAGER_ID);

    const manager = managers.find((m) => m.userId === MANAGER_ID)!;
    expect(manager.teamNames).toContain("Test Team");
  });

  it("scopes strictly to the given organization", async () => {
    const otherOrgManagers = await listManagersForViewAs(OTHER_ORG_ID);
    const ids = otherOrgManagers.map((m) => m.userId);
    expect(ids).toEqual([OTHER_ORG_MANAGER_ID]);
  });
});

describe("getVisibleTeamsForManager", () => {
  it("derives a team from an employee-only assignment when assignedTeamIds is empty", async () => {
    const ctx = await getManagerContext(SUB_MANAGER_EMAIL);
    expect(ctx).not.toBeNull();
    // Employee-only assignment -- no whole-team grant at all, the exact gap
    // getVisibleTeamsForManager exists to cover (see FOLLOWUPS.md item 16).
    expect(ctx!.assignedTeamIds).toEqual([]);

    const employees = await getAssignedEmployees(ctx!);
    const visible = await getVisibleTeamsForManager(ctx!, employees);
    expect(visible.map((t) => t.id)).toEqual([TEAM_ID]);
  });

  it("dedupes a team that's both directly assigned and reachable via an employee", async () => {
    const ctx = await getManagerContext(MANAGER_EMAIL);
    const employees = await getAssignedEmployees(ctx!); // EMPLOYEE_ID, primaryTeamId = TEAM_ID
    const visible = await getVisibleTeamsForManager(ctx!, employees);
    expect(visible).toHaveLength(1);
    expect(visible[0]!.id).toBe(TEAM_ID);
  });

  it("returns an empty array, with no query, when there's nothing to derive", async () => {
    const emptyCtx = {
      userId: "unused",
      organizationId: ORG_ID,
      assignedTeamIds: [],
      assignedEmployeeIds: [],
    };
    expect(await getVisibleTeamsForManager(emptyCtx, [])).toEqual([]);
  });
});

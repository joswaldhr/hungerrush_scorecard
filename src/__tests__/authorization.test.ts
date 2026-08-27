// Integration tests against a real Postgres database (see vitest.config.mts's
// test.env, which points DATABASE_URL at the docker-compose db by default).
// Locally: `docker compose up -d && pnpm db:migrate` before `pnpm test`.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { organizations, users, teams, employees, managerAssignments } from "@/lib/db/schema";
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

const {
  getManagerContext,
  getEffectiveManagerContext,
  isPlatformAdmin,
  assertCanAccessEmployee,
  assertCanAccessTeam,
  listManagersForViewAs,
} = await import("@/lib/auth/authorization");

const ORG_ID = "99999999-0000-4000-8000-000000000001";
const TEAM_ID = "99999999-0000-4000-8000-000000000002";
const OTHER_TEAM_ID = "99999999-0000-4000-8000-000000000003";
const EMPLOYEE_ID = "99999999-0000-4000-8000-000000000004";
const OTHER_EMPLOYEE_ID = "99999999-0000-4000-8000-000000000005";

const MANAGER_ID = "99999999-0000-4000-8000-0000000000a1";
const ADMIN_ID = "99999999-0000-4000-8000-0000000000a2";
const OUTSIDER_ID = "99999999-0000-4000-8000-0000000000a3";
const INACTIVE_MANAGER_ID = "99999999-0000-4000-8000-0000000000a4";
const ADMIN_WITH_OWN_TEAM_ID = "99999999-0000-4000-8000-0000000000a5";

const MANAGER_EMAIL = "test-manager@test.cadence.internal";
const ADMIN_EMAIL = "test-admin@test.cadence.internal";
const OUTSIDER_EMAIL = "test-outsider@test.cadence.internal";
const INACTIVE_MANAGER_EMAIL = "test-inactive@test.cadence.internal";
const ADMIN_WITH_OWN_TEAM_EMAIL = "test-admin-own-team@test.cadence.internal";

const ALL_TEST_USER_IDS = [
  MANAGER_ID,
  ADMIN_ID,
  OUTSIDER_ID,
  INACTIVE_MANAGER_ID,
  ADMIN_WITH_OWN_TEAM_ID,
];

async function cleanup() {
  await db
    .delete(managerAssignments)
    .where(inArray(managerAssignments.managerUserId, ALL_TEST_USER_IDS));
  await db.delete(users).where(inArray(users.id, ALL_TEST_USER_IDS));
  await db.delete(employees).where(inArray(employees.id, [EMPLOYEE_ID, OTHER_EMPLOYEE_ID]));
  await db.delete(teams).where(inArray(teams.id, [TEAM_ID, OTHER_TEAM_ID]));
  await db.delete(organizations).where(eq(organizations.id, ORG_ID));
}

beforeAll(async () => {
  await cleanup();

  await db.insert(organizations).values({ id: ORG_ID, name: "Test Org" });
  await db.insert(teams).values([
    { id: TEAM_ID, organizationId: ORG_ID, name: "Test Team", slug: "test-team" },
    { id: OTHER_TEAM_ID, organizationId: ORG_ID, name: "Other Team", slug: "other-team" },
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

describe("listManagersForViewAs", () => {
  it("includes active managers with a real assignment, not admins/outsiders", async () => {
    const managers = await listManagersForViewAs();
    const ids = managers.map((m) => m.userId);
    expect(ids).toContain(MANAGER_ID);
    expect(ids).toContain(ADMIN_WITH_OWN_TEAM_ID);
    expect(ids).not.toContain(ADMIN_ID);
    expect(ids).not.toContain(OUTSIDER_ID);
    expect(ids).not.toContain(INACTIVE_MANAGER_ID);

    const manager = managers.find((m) => m.userId === MANAGER_ID)!;
    expect(manager.teamNames).toContain("Test Team");
  });
});

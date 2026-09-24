// Integration tests against a real Postgres database (see vitest.config.mts's
// test.env, which points DATABASE_URL at the docker-compose db by default).
// Locally: `docker compose up -d && pnpm db:migrate` before `pnpm test`.
//
// Mocks only the true I/O boundary (session resolution) -- isPlatformAdmin
// and the actual reads/writes run for real against the test database, same
// spirit as roster-reconcile.test.ts's fakeConnector.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
// revalidatePath needs a real Next.js request-scoped store that doesn't
// exist in a plain test run ("Invariant: static generation store missing") --
// it's a framework cache-invalidation hint, not app logic worth exercising
// here, so it's stubbed out rather than routed through a real request.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { db } from "@/lib/db";
import {
  organizations,
  teams,
  users,
  employees,
  metricDefinitions,
  metricVisibilityOverrides,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  setVisibilityOverride,
  removeVisibilityOverride,
} from "@/app/(app)/admin/metric-visibility/actions";

const ORG_ID = "99999999-0000-4000-8000-000000000301";
const TEAM_ID = "99999999-0000-4000-8000-000000000302";
const ADMIN_USER_ID = "99999999-0000-4000-8000-000000000303";
const NON_ADMIN_USER_ID = "99999999-0000-4000-8000-000000000304";
const EMPLOYEE_ID = "99999999-0000-4000-8000-000000000305";
const METRIC_DEF_ID = "99999999-0000-4000-8000-000000000306";

const ADMIN_EMAIL = "test-admin-visibility@test.cadence.internal";
const NON_ADMIN_EMAIL = "test-non-admin-visibility@test.cadence.internal";

async function cleanup() {
  await db
    .delete(metricVisibilityOverrides)
    .where(eq(metricVisibilityOverrides.metricDefinitionId, METRIC_DEF_ID));
  await db.delete(metricDefinitions).where(eq(metricDefinitions.id, METRIC_DEF_ID));
  await db.delete(employees).where(eq(employees.id, EMPLOYEE_ID));
  await db.delete(users).where(eq(users.id, ADMIN_USER_ID));
  await db.delete(users).where(eq(users.id, NON_ADMIN_USER_ID));
  await db.delete(teams).where(eq(teams.id, TEAM_ID));
  await db.delete(organizations).where(eq(organizations.id, ORG_ID));
}

beforeAll(async () => {
  await cleanup();
  await db.insert(organizations).values({ id: ORG_ID, name: "Test Org" });
  await db
    .insert(teams)
    .values({ id: TEAM_ID, organizationId: ORG_ID, name: "Test Team", slug: "test-team-vis" });
  await db.insert(users).values([
    {
      id: ADMIN_USER_ID,
      organizationId: ORG_ID,
      email: ADMIN_EMAIL,
      displayName: "Test Admin",
      isPlatformAdmin: true,
    },
    {
      id: NON_ADMIN_USER_ID,
      organizationId: ORG_ID,
      email: NON_ADMIN_EMAIL,
      displayName: "Test Non-Admin",
      isPlatformAdmin: false,
    },
  ]);
  await db.insert(employees).values({
    id: EMPLOYEE_ID,
    organizationId: ORG_ID,
    primaryTeamId: TEAM_ID,
    displayName: "Test Employee",
  });
  await db.insert(metricDefinitions).values({
    id: METRIC_DEF_ID,
    organizationId: ORG_ID,
    key: "test_visibility_metric",
    name: "Test Visibility Metric",
    valueType: "count",
  });
});

afterAll(async () => {
  await cleanup();
});

describe("setVisibilityOverride", () => {
  it("serializes concurrent nullable-scope inserts into one rule", async () => {
    mockAuth.mockResolvedValue({ user: { email: ADMIN_EMAIL } });
    const input = {
      scope: "global_default" as const,
      managerUserId: null,
      targetEmployeeId: null,
      metricDefinitionId: METRIC_DEF_ID,
      teamId: null,
      line: "synthetic-concurrency",
      hidden: true,
    };
    try {
      await Promise.all([setVisibilityOverride(input), setVisibilityOverride(input)]);
      const rows = await db
        .select()
        .from(metricVisibilityOverrides)
        .where(
          and(
            eq(metricVisibilityOverrides.metricDefinitionId, METRIC_DEF_ID),
            eq(metricVisibilityOverrides.line, input.line)
          )
        );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.hiddenBy).toBe(ADMIN_USER_ID);
    } finally {
      await db
        .delete(metricVisibilityOverrides)
        .where(
          and(
            eq(metricVisibilityOverrides.metricDefinitionId, METRIC_DEF_ID),
            eq(metricVisibilityOverrides.line, input.line)
          )
        );
    }
  });

  it("rejects a non-admin session without writing anything", async () => {
    mockAuth.mockResolvedValue({ user: { email: NON_ADMIN_EMAIL } });

    await expect(
      setVisibilityOverride({
        scope: "scorecard_override",
        managerUserId: null,
        targetEmployeeId: EMPLOYEE_ID,
        metricDefinitionId: METRIC_DEF_ID,
        teamId: null,
        line: null,
        hidden: true,
      })
    ).rejects.toBeTruthy(); // redirect() throws NEXT_REDIRECT outside a real request

    const rows = await db
      .select()
      .from(metricVisibilityOverrides)
      .where(eq(metricVisibilityOverrides.metricDefinitionId, METRIC_DEF_ID));
    expect(rows).toHaveLength(0);
  });

  it("inserts a new row for an admin session and stamps hiddenBy", async () => {
    mockAuth.mockResolvedValue({ user: { email: ADMIN_EMAIL } });

    await setVisibilityOverride({
      scope: "scorecard_override",
      managerUserId: null,
      targetEmployeeId: EMPLOYEE_ID,
      metricDefinitionId: METRIC_DEF_ID,
      teamId: null,
      line: null,
      hidden: true,
    });

    const rows = await db
      .select()
      .from(metricVisibilityOverrides)
      .where(
        and(
          eq(metricVisibilityOverrides.metricDefinitionId, METRIC_DEF_ID),
          eq(metricVisibilityOverrides.targetEmployeeId, EMPLOYEE_ID)
        )
      );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.hidden).toBe(true);
    expect(rows[0]!.hiddenBy).toBe(ADMIN_USER_ID);
  });

  it("updates the existing row in place on a second call, rather than inserting a duplicate", async () => {
    mockAuth.mockResolvedValue({ user: { email: ADMIN_EMAIL } });

    await setVisibilityOverride({
      scope: "scorecard_override",
      managerUserId: null,
      targetEmployeeId: EMPLOYEE_ID,
      metricDefinitionId: METRIC_DEF_ID,
      teamId: null,
      line: null,
      hidden: false,
    });

    const rows = await db
      .select()
      .from(metricVisibilityOverrides)
      .where(
        and(
          eq(metricVisibilityOverrides.metricDefinitionId, METRIC_DEF_ID),
          eq(metricVisibilityOverrides.targetEmployeeId, EMPLOYEE_ID)
        )
      );
    expect(rows).toHaveLength(1); // still one row, not two
    expect(rows[0]!.hidden).toBe(false);
  });
});

describe("removeVisibilityOverride", () => {
  it("deletes the row for an admin session", async () => {
    mockAuth.mockResolvedValue({ user: { email: ADMIN_EMAIL } });

    const [existing] = await db
      .select()
      .from(metricVisibilityOverrides)
      .where(eq(metricVisibilityOverrides.metricDefinitionId, METRIC_DEF_ID));
    expect(existing).toBeDefined();

    const formData = new FormData();
    formData.set("id", existing!.id);
    await removeVisibilityOverride(formData);

    const rows = await db
      .select()
      .from(metricVisibilityOverrides)
      .where(eq(metricVisibilityOverrides.metricDefinitionId, METRIC_DEF_ID));
    expect(rows).toHaveLength(0);
  });
});

it("enforces nullable scope uniqueness for concurrent direct database writers", async () => {
  const rule = {
    scope: "global_default",
    metricDefinitionId: METRIC_DEF_ID,
    hidden: true,
    hiddenBy: ADMIN_USER_ID,
  };
  const results = await Promise.allSettled([
    db.insert(metricVisibilityOverrides).values(rule),
    db.insert(metricVisibilityOverrides).values(rule),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const failure = results.find((result) => result.status === "rejected");
  expect(failure).toMatchObject({ status: "rejected", reason: { cause: { code: "23505" } } });
  await db.insert(metricVisibilityOverrides).values({ ...rule, line: "" });
  const rows = await db
    .select()
    .from(metricVisibilityOverrides)
    .where(eq(metricVisibilityOverrides.metricDefinitionId, METRIC_DEF_ID));
  expect(rows).toHaveLength(2);
  expect(rows.map((row) => row.line)).toEqual(expect.arrayContaining([null, ""]));
});

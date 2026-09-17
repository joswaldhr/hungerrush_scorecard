// Integration tests against a real Postgres database (see vitest.config.mts's
// test.env, which points DATABASE_URL at the docker-compose db by default).
// Locally: `docker compose up -d && pnpm db:migrate` before `pnpm test`.
//
// getEmployeeMetricsBatch is the single function every scorecard in the app
// renders through -- it joins targets, values, visibility, and status
// together. Its pure-logic dependencies (target-resolution.ts,
// visibility-resolution.ts) already have unit coverage; this file covers the
// integration/query-composition layer those units get wired into.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  organizations,
  teams,
  employees,
  users,
  metricDefinitions,
  metricAssignments,
  metricTargets,
  metricValues,
  metricVisibilityOverrides,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getEmployeeMetricsBatch } from "@/lib/domain/metrics/queries";
import type { ManagerContext } from "@/lib/auth/authorization";

const ORG_ID = "99999999-0000-4000-8000-000000000201";
const MENUFY_TEAM_ID = "99999999-0000-4000-8000-000000000202";
const POS_TEAM_ID = "99999999-0000-4000-8000-000000000203";
const MANAGER_USER_ID = "99999999-0000-4000-8000-000000000204";
const RESTAURANT_EMP_ID = "99999999-0000-4000-8000-000000000205";
const CONSUMER_EMP_ID = "99999999-0000-4000-8000-000000000206";
const POS_EMP_ID = "99999999-0000-4000-8000-000000000207";
const RANGE_DEF_ID = "99999999-0000-4000-8000-000000000208";
const HIDDEN_DEF_ID = "99999999-0000-4000-8000-000000000209";

const PERIOD_START = "2026-09-14";
const PREVIOUS_PERIOD_START = "2026-09-07";

async function cleanup() {
  await db
    .delete(metricVisibilityOverrides)
    .where(eq(metricVisibilityOverrides.metricDefinitionId, HIDDEN_DEF_ID));
  await db
    .delete(metricValues)
    .where(inArray(metricValues.metricDefinitionId, [RANGE_DEF_ID, HIDDEN_DEF_ID]));
  await db.delete(metricTargets).where(eq(metricTargets.metricDefinitionId, RANGE_DEF_ID));
  await db
    .delete(metricAssignments)
    .where(inArray(metricAssignments.metricDefinitionId, [RANGE_DEF_ID, HIDDEN_DEF_ID]));
  await db
    .delete(metricDefinitions)
    .where(inArray(metricDefinitions.id, [RANGE_DEF_ID, HIDDEN_DEF_ID]));
  await db
    .delete(employees)
    .where(inArray(employees.id, [RESTAURANT_EMP_ID, CONSUMER_EMP_ID, POS_EMP_ID]));
  await db.delete(users).where(eq(users.id, MANAGER_USER_ID));
  await db.delete(teams).where(inArray(teams.id, [MENUFY_TEAM_ID, POS_TEAM_ID]));
  await db.delete(organizations).where(eq(organizations.id, ORG_ID));
}

beforeAll(async () => {
  await cleanup();

  await db.insert(organizations).values({ id: ORG_ID, name: "Test Org" });
  await db.insert(teams).values([
    {
      id: MENUFY_TEAM_ID,
      organizationId: ORG_ID,
      name: "Test Menufy",
      slug: "test-menufy-queries",
    },
    { id: POS_TEAM_ID, organizationId: ORG_ID, name: "Test POS", slug: "test-pos-queries" },
  ]);
  await db.insert(users).values({
    id: MANAGER_USER_ID,
    organizationId: ORG_ID,
    email: "test-manager-queries@test.cadence.internal",
    displayName: "Test Manager",
  });
  await db.insert(employees).values([
    {
      id: RESTAURANT_EMP_ID,
      organizationId: ORG_ID,
      primaryTeamId: MENUFY_TEAM_ID,
      displayName: "Test Restaurant Rep",
      line: "restaurant",
    },
    {
      id: CONSUMER_EMP_ID,
      organizationId: ORG_ID,
      primaryTeamId: MENUFY_TEAM_ID,
      displayName: "Test Consumer Rep",
      line: "consumer",
    },
    {
      id: POS_EMP_ID,
      organizationId: ORG_ID,
      primaryTeamId: POS_TEAM_ID,
      displayName: "Test POS Rep",
    },
  ]);

  // A range metric, line-scoped differently per Menufy line, assigned to
  // Menufy only.
  await db.insert(metricDefinitions).values({
    id: RANGE_DEF_ID,
    organizationId: ORG_ID,
    key: "test_range_metric",
    name: "Test Range Metric",
    valueType: "count",
    direction: "neutral",
  });
  await db.insert(metricAssignments).values({
    metricDefinitionId: RANGE_DEF_ID,
    teamId: MENUFY_TEAM_ID,
    displayOrder: 0,
  });
  await db.insert(metricTargets).values([
    {
      metricDefinitionId: RANGE_DEF_ID,
      teamId: MENUFY_TEAM_ID,
      line: "restaurant",
      targetType: "range",
      targetMin: 10,
      targetMax: 20,
    },
    {
      metricDefinitionId: RANGE_DEF_ID,
      teamId: MENUFY_TEAM_ID,
      line: "consumer",
      targetType: "range",
      targetMin: 30,
      targetMax: 40,
    },
  ]);

  // A metric assigned to BOTH teams, hidden globally for Menufy only -- used
  // to prove visibility exclusion works and doesn't leak across teams.
  await db.insert(metricDefinitions).values({
    id: HIDDEN_DEF_ID,
    organizationId: ORG_ID,
    key: "test_hidden_metric",
    name: "Test Hidden Metric",
    valueType: "count",
    direction: "neutral",
  });
  await db.insert(metricAssignments).values([
    { metricDefinitionId: HIDDEN_DEF_ID, teamId: MENUFY_TEAM_ID, displayOrder: 1 },
    { metricDefinitionId: HIDDEN_DEF_ID, teamId: POS_TEAM_ID, displayOrder: 0 },
  ]);
  await db.insert(metricVisibilityOverrides).values({
    scope: "global_default",
    metricDefinitionId: HIDDEN_DEF_ID,
    teamId: MENUFY_TEAM_ID,
    hidden: true,
    hiddenBy: MANAGER_USER_ID,
  });

  await db.insert(metricValues).values([
    // Restaurant rep: 15 is within [10, 20] -> on_target
    {
      metricDefinitionId: RANGE_DEF_ID,
      employeeId: RESTAURANT_EMP_ID,
      teamId: MENUFY_TEAM_ID,
      periodStart: PERIOD_START,
      periodEnd: "2026-09-20",
      numericValue: 15,
    },
    // Consumer rep: 15 is outside [30, 40] -> off_target (would be on_target
    // under the restaurant range, proving the right line's target is used)
    {
      metricDefinitionId: RANGE_DEF_ID,
      employeeId: CONSUMER_EMP_ID,
      teamId: MENUFY_TEAM_ID,
      periodStart: PERIOD_START,
      periodEnd: "2026-09-20",
      numericValue: 15,
    },
    {
      metricDefinitionId: HIDDEN_DEF_ID,
      employeeId: RESTAURANT_EMP_ID,
      teamId: MENUFY_TEAM_ID,
      periodStart: PERIOD_START,
      periodEnd: "2026-09-20",
      numericValue: 5,
    },
    {
      metricDefinitionId: HIDDEN_DEF_ID,
      employeeId: POS_EMP_ID,
      teamId: POS_TEAM_ID,
      periodStart: PERIOD_START,
      periodEnd: "2026-09-20",
      numericValue: 7,
    },
  ]);
});

afterAll(async () => {
  await cleanup();
});

function ctxFor(employeeIds: string[]): ManagerContext {
  return {
    userId: MANAGER_USER_ID,
    organizationId: ORG_ID,
    assignedTeamIds: [MENUFY_TEAM_ID, POS_TEAM_ID],
    assignedEmployeeIds: employeeIds,
  };
}

describe("getEmployeeMetricsBatch", () => {
  it("resolves a range target end-to-end and evaluates status correctly", async () => {
    const batch = await getEmployeeMetricsBatch(
      ctxFor([RESTAURANT_EMP_ID]),
      [RESTAURANT_EMP_ID],
      MENUFY_TEAM_ID,
      PERIOD_START,
      PREVIOUS_PERIOD_START
    );
    const rows = batch.get(RESTAURANT_EMP_ID) ?? [];
    const row = rows.find((r) => r.definitionId === RANGE_DEF_ID);

    expect(row).toBeDefined();
    expect(row!.target?.targetType).toBe("range");
    expect(row!.target?.targetMin).toBe(10);
    expect(row!.target?.targetMax).toBe(20);
    expect(row!.currentValue).toBe(15);
    expect(row!.status.status).toBe("on_target");
  });

  it("resolves the correct line-scoped target for a different Menufy line", async () => {
    const batch = await getEmployeeMetricsBatch(
      ctxFor([CONSUMER_EMP_ID]),
      [CONSUMER_EMP_ID],
      MENUFY_TEAM_ID,
      PERIOD_START,
      PREVIOUS_PERIOD_START
    );
    const rows = batch.get(CONSUMER_EMP_ID) ?? [];
    const row = rows.find((r) => r.definitionId === RANGE_DEF_ID);

    expect(row).toBeDefined();
    // Consumer's own range is [30, 40] -- 15 is off-target here, even though
    // the same value (15) was on-target under the restaurant range above.
    expect(row!.target?.targetMin).toBe(30);
    expect(row!.target?.targetMax).toBe(40);
    expect(row!.status.status).toBe("off_target");
  });

  it("excludes a metric hidden by a global_default override, scoped to one team", async () => {
    const batch = await getEmployeeMetricsBatch(
      ctxFor([RESTAURANT_EMP_ID]),
      [RESTAURANT_EMP_ID],
      MENUFY_TEAM_ID,
      PERIOD_START,
      PREVIOUS_PERIOD_START
    );
    const rows = batch.get(RESTAURANT_EMP_ID) ?? [];
    expect(rows.find((r) => r.definitionId === HIDDEN_DEF_ID)).toBeUndefined();
  });

  it("does not let a Menufy-scoped hide leak into POS", async () => {
    const batch = await getEmployeeMetricsBatch(
      ctxFor([POS_EMP_ID]),
      [POS_EMP_ID],
      POS_TEAM_ID,
      PERIOD_START,
      PREVIOUS_PERIOD_START
    );
    const rows = batch.get(POS_EMP_ID) ?? [];
    const row = rows.find((r) => r.definitionId === HIDDEN_DEF_ID);

    expect(row).toBeDefined();
    expect(row!.currentValue).toBe(7);
  });
});

// @vitest-environment node
// Integration tests against a real Postgres database (see vitest.config.mts's
// test.env, which points DATABASE_URL at the docker-compose db by default).
// Locally: `docker compose up -d && pnpm db:migrate` before `pnpm test`.
//
// getEmployeeMetricsBatch is the single function every scorecard in the app
// renders through -- it joins targets, values, visibility, and status
// together. Its pure-logic dependencies (target-resolution.ts,
// visibility-resolution.ts) already have unit coverage; this file covers the
// integration/query-composition layer those units get wired into.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
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
import { eq, inArray, and } from "drizzle-orm";
import {
  SOLVED_CSAT_CONTRACT,
  INCOMPATIBLE_COMPARISON_REASON,
} from "@/lib/domain/metrics/source-context";
import { getEmployeeMetricsBatch } from "@/lib/domain/metrics/queries";
import { getStoredMetricHistory } from "@/lib/domain/metrics/history";
import type { ManagerContext } from "@/lib/auth/authorization";

// queries.ts imports assertCanAccessEmployee from authorization.ts, which
// (as of 2026-09-21's requireAdmin()) imports next-auth's auth() directly --
// the real module fails to resolve under Vitest. Mocked purely so this
// file's module graph loads; nothing here calls auth() itself.
vi.mock("@/lib/auth", () => ({ auth: async () => null }));

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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-16T12:00:00Z"));
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
  try {
    await cleanup();
  } finally {
    vi.useRealTimers();
  }
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
  it("keeps replacement CSAT context in current/history and withholds incompatible comparisons and targets", async () => {
    const context = { sourceContract: SOLVED_CSAT_CONTRACT, reportingTimeZone: "America/Chicago" };
    const currentScope = and(
      eq(metricValues.metricDefinitionId, RANGE_DEF_ID),
      eq(metricValues.employeeId, RESTAURANT_EMP_ID),
      eq(metricValues.periodStart, PERIOD_START)
    );
    const [prior] = await db
      .insert(metricValues)
      .values({
        metricDefinitionId: RANGE_DEF_ID,
        employeeId: RESTAURANT_EMP_ID,
        teamId: MENUFY_TEAM_ID,
        periodStart: PREVIOUS_PERIOD_START,
        periodEnd: "2026-09-13",
        numericValue: 42,
      })
      .returning();
    const read = async () =>
      (
        await getEmployeeMetricsBatch(
          ctxFor([RESTAURANT_EMP_ID]),
          [RESTAURANT_EMP_ID],
          MENUFY_TEAM_ID,
          PERIOD_START,
          PREVIOUS_PERIOD_START
        )
      )
        .get(RESTAURANT_EMP_ID)!
        .find((r) => r.definitionId === RANGE_DEF_ID)!;
    try {
      await db
        .update(metricDefinitions)
        .set({ key: "csat_response_rate", sourceStrategy: "zendesk" })
        .where(eq(metricDefinitions.id, RANGE_DEF_ID));
      await db.update(metricValues).set({ provenanceJson: context }).where(currentScope);
      expect(await read()).toMatchObject({
        currentValue: 15,
        previousValue: null,
        target: null,
        targetContextStatus: "source_unverified",
        comparisonUnavailableReason: INCOMPATIBLE_COMPARISON_REASON,
        ...context,
      });
      expect((await read()).sourceDescription).toContain("offered plus rated surveys");
      const history = await getStoredMetricHistory(
        ctxFor([RESTAURANT_EMP_ID]),
        RESTAURANT_EMP_ID,
        `${PERIOD_START}/2026-09-20`
      );
      expect(history.rows.find((r) => r.key === "csat_response_rate")).toMatchObject(context);
      await db
        .update(metricValues)
        .set({ provenanceJson: context })
        .where(eq(metricValues.id, prior!.id));
      expect(await read()).toMatchObject({ previousValue: 42, comparisonUnavailableReason: null });
      await db
        .update(metricValues)
        .set({ numericValue: null, qualityStatus: "missing" })
        .where(currentScope);
      expect(await read()).toMatchObject({
        currentValue: null,
        qualityStatus: "missing",
        missingReason: "No offered or rated surveys in the solved-ticket cohort.",
      });
    } finally {
      await db.delete(metricValues).where(eq(metricValues.id, prior!.id));
      await db
        .update(metricValues)
        .set({ provenanceJson: null, numericValue: 15, qualityStatus: "complete" })
        .where(currentScope);
      await db
        .update(metricDefinitions)
        .set({ key: "test_range_metric", sourceStrategy: null })
        .where(eq(metricDefinitions.id, RANGE_DEF_ID));
    }
  });
  it("explains unsupported Zendesk blanks without treating other sources as unsupported", async () => {
    const read = async () =>
      (
        await getEmployeeMetricsBatch(
          ctxFor([POS_EMP_ID]),
          [POS_EMP_ID],
          POS_TEAM_ID,
          PREVIOUS_PERIOD_START,
          "2026-08-31"
        )
      )
        .get(POS_EMP_ID)!
        .find((row) => row.definitionId === HIDDEN_DEF_ID)!;
    try {
      await db
        .update(metricDefinitions)
        .set({ key: "missed_calls", sourceStrategy: "zendesk" })
        .where(eq(metricDefinitions.id, HIDDEN_DEF_ID));
      expect(await read()).toMatchObject({
        currentValue: null,
        qualityStatus: "unsupported",
        missingReason: "This metric is not connected to historical agent call-leg data.",
      });
      await db
        .update(metricDefinitions)
        .set({ sourceStrategy: "manual" })
        .where(eq(metricDefinitions.id, HIDDEN_DEF_ID));
      expect(await read()).toMatchObject({
        currentValue: null,
        qualityStatus: "missing",
        missingReason: null,
        sourceDescription: null,
      });
    } finally {
      await db
        .update(metricDefinitions)
        .set({ key: "test_hidden_metric", sourceStrategy: null })
        .where(eq(metricDefinitions.id, HIDDEN_DEF_ID));
    }
  });
  it("does not reinterpret a closed period using a later employee line", async () => {
    vi.setSystemTime(new Date("2026-09-21T00:00:00Z"));
    try {
      const read = async () =>
        (
          await getEmployeeMetricsBatch(
            ctxFor([RESTAURANT_EMP_ID]),
            [RESTAURANT_EMP_ID],
            MENUFY_TEAM_ID,
            PERIOD_START,
            PREVIOUS_PERIOD_START
          )
        )
          .get(RESTAURANT_EMP_ID)!
          .find((row) => row.definitionId === RANGE_DEF_ID)!;
      const before = await read();
      expect(before).toMatchObject({
        currentValue: 15,
        target: null,
        targetContextStatus: "historical_unverified",
        status: { status: "no_target" },
      });
      await db
        .update(employees)
        .set({ line: "consumer" })
        .where(eq(employees.id, RESTAURANT_EMP_ID));
      const after = await read();
      expect(after.target).toBeNull();
      expect(after.status).toEqual(before.status);
      expect(after.currentValue).toBe(15);
      // UTC last day remains an open period; it is never closed early in local time.
      vi.setSystemTime(new Date("2026-09-20T23:59:59Z"));
      expect((await read()).targetContextStatus).toBe("current");
      expect((await read()).target?.targetMin).toBe(30);
    } finally {
      await db
        .update(employees)
        .set({ line: "restaurant" })
        .where(eq(employees.id, RESTAURANT_EMP_ID));
      vi.setSystemTime(new Date("2026-09-16T12:00:00Z"));
    }
  });
  it("withholds unverified Zendesk ticket activity from current, comparison and history without rewriting storage", async () => {
    const [previous] = await db
      .insert(metricValues)
      .values({
        metricDefinitionId: RANGE_DEF_ID,
        employeeId: RESTAURANT_EMP_ID,
        teamId: MENUFY_TEAM_ID,
        periodStart: PREVIOUS_PERIOD_START,
        periodEnd: "2026-09-13",
        numericValue: 42,
        qualityStatus: "complete",
        calculationVersion: 999,
      })
      .returning();
    try {
      for (const key of ["tickets_updated", "tickets_resolved"]) {
        await db
          .update(metricDefinitions)
          .set({ key, sourceStrategy: "zendesk" })
          .where(eq(metricDefinitions.id, RANGE_DEF_ID));
        const batch = await getEmployeeMetricsBatch(
          ctxFor([RESTAURANT_EMP_ID]),
          [RESTAURANT_EMP_ID],
          MENUFY_TEAM_ID,
          PERIOD_START,
          PREVIOUS_PERIOD_START
        );
        expect(
          batch.get(RESTAURANT_EMP_ID)?.find((row) => row.definitionId === RANGE_DEF_ID)
        ).toMatchObject({
          currentValue: null,
          previousValue: null,
          qualityStatus: "unverified_attribution",
          status: { status: "no_data" },
        });
        const history = await getStoredMetricHistory(
          ctxFor([RESTAURANT_EMP_ID]),
          RESTAURANT_EMP_ID,
          `${PREVIOUS_PERIOD_START}/2026-09-13`
        );
        expect(history.rows.find((row) => row.id === previous!.id)).toMatchObject({
          numericValue: null,
          quality: "unverified_attribution",
        });
      }
      const [stored] = await db
        .select()
        .from(metricValues)
        .where(eq(metricValues.id, previous!.id));
      expect(stored?.numericValue).toBe(42);
      expect(stored?.qualityStatus).toBe("complete");
      // A separate source's same-named contract must not inherit this vendor containment.
      await db
        .update(metricDefinitions)
        .set({ sourceStrategy: "manual" })
        .where(eq(metricDefinitions.id, RANGE_DEF_ID));
      const unaffected = await getEmployeeMetricsBatch(
        ctxFor([RESTAURANT_EMP_ID]),
        [RESTAURANT_EMP_ID],
        MENUFY_TEAM_ID,
        PERIOD_START,
        PREVIOUS_PERIOD_START
      );
      expect(
        unaffected.get(RESTAURANT_EMP_ID)?.find((row) => row.definitionId === RANGE_DEF_ID)
          ?.currentValue
      ).toBe(15);
    } finally {
      await db
        .update(metricDefinitions)
        .set({ key: "test_range_metric", sourceStrategy: null })
        .where(eq(metricDefinitions.id, RANGE_DEF_ID));
      await db.delete(metricValues).where(eq(metricValues.id, previous!.id));
    }
  });
  it("rejects foreign teams/employees and ignores a corrupt cross-organization metric assignment", async () => {
    const foreignOrg = randomUUID(),
      foreignTeam = randomUUID(),
      foreignEmployee = randomUUID(),
      foreignMetric = randomUUID();
    await db
      .insert(organizations)
      .values({ id: foreignOrg, name: "Synthetic foreign organization" });
    try {
      await db.insert(teams).values({
        id: foreignTeam,
        organizationId: foreignOrg,
        name: "Foreign team",
        slug: foreignTeam,
      });
      await db.insert(employees).values({
        id: foreignEmployee,
        organizationId: foreignOrg,
        displayName: "Foreign employee",
      });
      await db.insert(metricDefinitions).values({
        id: foreignMetric,
        organizationId: foreignOrg,
        name: "Foreign metric",
        key: "foreign_metric",
        valueType: "count",
        direction: "neutral",
      });
      await db
        .insert(metricAssignments)
        .values({ metricDefinitionId: foreignMetric, teamId: MENUFY_TEAM_ID });
      await expect(
        getEmployeeMetricsBatch(
          ctxFor([RESTAURANT_EMP_ID]),
          [RESTAURANT_EMP_ID],
          foreignTeam,
          PERIOD_START,
          PREVIOUS_PERIOD_START
        )
      ).rejects.toThrow("not permitted");
      await expect(
        getEmployeeMetricsBatch(
          ctxFor([foreignEmployee]),
          [foreignEmployee],
          MENUFY_TEAM_ID,
          PERIOD_START,
          PREVIOUS_PERIOD_START
        )
      ).rejects.toThrow("not permitted");
      const rows = await getEmployeeMetricsBatch(
        ctxFor([RESTAURANT_EMP_ID]),
        [RESTAURANT_EMP_ID],
        MENUFY_TEAM_ID,
        PERIOD_START,
        PREVIOUS_PERIOD_START
      );
      expect(rows.get(RESTAURANT_EMP_ID)?.map((row) => row.definitionId)).not.toContain(
        foreignMetric
      );
    } finally {
      await db
        .delete(metricAssignments)
        .where(eq(metricAssignments.metricDefinitionId, foreignMetric));
      await db.delete(metricDefinitions).where(eq(metricDefinitions.id, foreignMetric));
      await db.delete(employees).where(eq(employees.id, foreignEmployee));
      await db.delete(teams).where(eq(teams.id, foreignTeam));
      await db.delete(organizations).where(eq(organizations.id, foreignOrg));
    }
  });
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
  it("ignores future and expired targets when reading an earlier period", async () => {
    const inserted = await db
      .insert(metricTargets)
      .values([
        {
          metricDefinitionId: RANGE_DEF_ID,
          teamId: MENUFY_TEAM_ID,
          line: "restaurant",
          targetType: "range",
          targetMin: 100,
          targetMax: 200,
          priority: 99,
          effectiveFrom: "2026-09-21",
        },
        {
          metricDefinitionId: RANGE_DEF_ID,
          teamId: MENUFY_TEAM_ID,
          line: "restaurant",
          targetType: "range",
          targetMin: 300,
          targetMax: 400,
          priority: 100,
          effectiveTo: PERIOD_START,
        },
      ])
      .returning();
    try {
      const result = await getEmployeeMetricsBatch(
        ctxFor([RESTAURANT_EMP_ID]),
        [RESTAURANT_EMP_ID],
        MENUFY_TEAM_ID,
        PERIOD_START,
        PREVIOUS_PERIOD_START
      );
      expect(
        result.get(RESTAURANT_EMP_ID)?.find((r) => r.definitionId === RANGE_DEF_ID)?.target
          ?.targetMax
      ).toBe(20);
    } finally {
      await db.delete(metricTargets).where(
        inArray(
          metricTargets.id,
          inserted.map((t) => t.id)
        )
      );
    }
  });

  it("does not display a definition or assignment outside its effective interval", async () => {
    const read = () =>
      getEmployeeMetricsBatch(
        ctxFor([POS_EMP_ID]),
        [POS_EMP_ID],
        POS_TEAM_ID,
        PERIOD_START,
        PREVIOUS_PERIOD_START
      );
    try {
      await db
        .update(metricDefinitions)
        .set({ effectiveFrom: "2026-09-21" })
        .where(eq(metricDefinitions.id, HIDDEN_DEF_ID));
      expect((await read()).get(POS_EMP_ID)).toEqual([]);
      await db
        .update(metricDefinitions)
        .set({ effectiveFrom: null })
        .where(eq(metricDefinitions.id, HIDDEN_DEF_ID));
      await db
        .update(metricAssignments)
        .set({ effectiveTo: PERIOD_START })
        .where(eq(metricAssignments.metricDefinitionId, HIDDEN_DEF_ID));
      expect((await read()).get(POS_EMP_ID)).toEqual([]);
    } finally {
      await db
        .update(metricDefinitions)
        .set({ effectiveFrom: null })
        .where(eq(metricDefinitions.id, HIDDEN_DEF_ID));
      await db
        .update(metricAssignments)
        .set({ effectiveTo: null })
        .where(eq(metricAssignments.metricDefinitionId, HIDDEN_DEF_ID));
    }
  });
  it("keeps overlapping stored intervals distinct without normalizing their calendar", async () => {
    const added = await db
      .insert(metricValues)
      .values([
        {
          metricDefinitionId: RANGE_DEF_ID,
          employeeId: RESTAURANT_EMP_ID,
          teamId: MENUFY_TEAM_ID,
          periodStart: "2026-09-13",
          periodEnd: "2026-09-19",
          numericValue: 101,
        },
        {
          metricDefinitionId: RANGE_DEF_ID,
          employeeId: RESTAURANT_EMP_ID,
          teamId: MENUFY_TEAM_ID,
          periodStart: "2026-09-14",
          periodEnd: "2026-09-19",
          numericValue: 202,
        },
      ])
      .returning();
    try {
      const ctx = ctxFor([RESTAURANT_EMP_ID]);
      const sunday = await getStoredMetricHistory(ctx, RESTAURANT_EMP_ID, "2026-09-13/2026-09-19");
      expect(sunday.rows.map((row) => row.numericValue)).toEqual([101]);
      expect(sunday.periods).toContainEqual({ start: "2026-09-14", end: "2026-09-20" });
      const weekly = await getEmployeeMetricsBatch(
        ctx,
        [RESTAURANT_EMP_ID],
        MENUFY_TEAM_ID,
        PERIOD_START,
        PREVIOUS_PERIOD_START
      );
      expect(
        weekly.get(RESTAURANT_EMP_ID)?.find((row) => row.definitionId === RANGE_DEF_ID)
          ?.currentValue
      ).toBe(15);
      const monday = await getStoredMetricHistory(ctx, RESTAURANT_EMP_ID, "2026-09-14/2026-09-20");
      expect(monday.rows.find((row) => row.key === "test_range_metric")?.numericValue).toBe(15);
      const short = await getStoredMetricHistory(ctx, RESTAURANT_EMP_ID, "2026-09-14/2026-09-19");
      expect(short.rows.map((row) => row.numericValue)).toEqual([202]);
      expect(
        (await getStoredMetricHistory(ctx, RESTAURANT_EMP_ID, "2026-09-01/2026-09-07")).selected
      ).toBeNull();
    } finally {
      await db.delete(metricValues).where(
        inArray(
          metricValues.id,
          added.map((row) => row.id)
        )
      );
    }
  });

  it("enforces employee and organization scope for stored history", async () => {
    await expect(getStoredMetricHistory(ctxFor([POS_EMP_ID]), RESTAURANT_EMP_ID)).rejects.toThrow(
      "Unauthorized"
    );
    await expect(
      getStoredMetricHistory(
        { ...ctxFor([RESTAURANT_EMP_ID]), organizationId: "99999999-0000-4000-8000-000000009999" },
        RESTAURANT_EMP_ID
      )
    ).rejects.toThrow("not permitted");
  });
});

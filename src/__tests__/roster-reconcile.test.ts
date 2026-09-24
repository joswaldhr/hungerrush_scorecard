// Integration tests against a real Postgres database (see vitest.config.mts's
// test.env, which points DATABASE_URL at the docker-compose db by default).
// Locally: `docker compose up -d && pnpm db:migrate` before `pnpm test`.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import {
  organizations,
  teams,
  dataSources,
  rosterSourceTeamMappings,
  rosterCandidates,
  users,
  employees,
  externalIdentities,
  teamMemberships,
} from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { discoverRosterCandidates } from "@/lib/domain/roster/reconcile";
import type { Connector } from "@/lib/connectors";
import type { DiscoveredRosterMember } from "@/lib/connectors/types";

const ORG_ID = "99999999-0000-4000-8000-000000000101";
const TEAM_ID = "99999999-0000-4000-8000-000000000102";
const DATA_SOURCE_ID = "99999999-0000-4000-8000-000000000103";
const MANAGER_USER_ID = "99999999-0000-4000-8000-000000000104";
const DEPARTED_EMPLOYEE_ID = "99999999-0000-4000-8000-000000000106";
const PERCENT_SEED_1_ID = "99999999-0000-4000-8000-000000000107";
const PERCENT_SEED_2_ID = "99999999-0000-4000-8000-000000000108";
const PERCENT_SEED_3_ID = "99999999-0000-4000-8000-000000000109";

const MANAGER_EMAIL = "test-manager@test.cadence.internal";
const NEW_HIRE_EMAIL = "test-new-hire@test.cadence.internal";
const REJECTED_HIRE_EMAIL = "test-rejected-hire@test.cadence.internal";
const DEPARTED_EMAIL = "test-departed@test.cadence.internal";
const PERCENT_TRIP_EMAIL_1 = "test-percent-trip-1@test.cadence.internal";
const PERCENT_TRIP_EMAIL_2 = "test-percent-trip-2@test.cadence.internal";
const PERCENT_PASS_EMAIL = "test-percent-pass@test.cadence.internal";

function fakeConnector(members: DiscoveredRosterMember[]): Connector {
  return { discoverRoster: async () => members } as unknown as Connector;
}

async function cleanup() {
  await db.delete(rosterCandidates).where(eq(rosterCandidates.dataSourceId, DATA_SOURCE_ID));
  await db.delete(teamMemberships).where(eq(teamMemberships.teamId, TEAM_ID));
  await db.delete(externalIdentities).where(eq(externalIdentities.dataSourceId, DATA_SOURCE_ID));
  await db.delete(employees).where(eq(employees.organizationId, ORG_ID));
  await db
    .delete(rosterSourceTeamMappings)
    .where(eq(rosterSourceTeamMappings.dataSourceId, DATA_SOURCE_ID));
  await db.delete(dataSources).where(eq(dataSources.id, DATA_SOURCE_ID));
  await db.delete(users).where(inArray(users.id, [MANAGER_USER_ID]));
  await db.delete(teams).where(eq(teams.id, TEAM_ID));
  await db.delete(organizations).where(eq(organizations.id, ORG_ID));
}

beforeAll(async () => {
  await cleanup();

  await db.insert(organizations).values({ id: ORG_ID, name: "Test Org" });
  await db
    .insert(teams)
    .values({ id: TEAM_ID, organizationId: ORG_ID, name: "Test Team", slug: "test-team" });
  await db.insert(dataSources).values({
    id: DATA_SOURCE_ID,
    organizationId: ORG_ID,
    type: "zendesk",
    displayName: "Test Zendesk",
  });
  await db.insert(rosterSourceTeamMappings).values({
    dataSourceId: DATA_SOURCE_ID,
    externalGroupId: "1",
    externalGroupLabel: "Test Group",
    teamId: TEAM_ID,
  });
  await db.insert(users).values({
    id: MANAGER_USER_ID,
    organizationId: ORG_ID,
    email: MANAGER_EMAIL,
    displayName: "Test Manager",
  });
});

afterAll(async () => {
  await cleanup();
});

describe("discoverRosterCandidates", () => {
  it("does not propose a manager account as a new-hire candidate", async () => {
    const connector = fakeConnector([
      {
        externalId: MANAGER_EMAIL,
        externalEmail: MANAGER_EMAIL,
        externalDisplayName: "Test Manager",
        teamId: TEAM_ID,
      },
    ]);

    const result = await discoverRosterCandidates(connector, DATA_SOURCE_ID);
    expect(result.newCandidates).toBe(0);
    expect(result.autoApproved).toBe(0);

    const candidates = await db
      .select()
      .from(rosterCandidates)
      .where(eq(rosterCandidates.dataSourceId, DATA_SOURCE_ID));
    expect(candidates).toHaveLength(0);
  });

  it("auto-approves a genuinely new hire (below circuit breaker threshold)", async () => {
    const connector = fakeConnector([
      {
        externalId: NEW_HIRE_EMAIL,
        externalEmail: NEW_HIRE_EMAIL,
        externalDisplayName: "Test New Hire",
        teamId: TEAM_ID,
      },
    ]);

    const result = await discoverRosterCandidates(connector, DATA_SOURCE_ID);
    expect(result.autoApproved).toBe(1);
    expect(result.newCandidates).toBe(0);

    const candidates = await db
      .select()
      .from(rosterCandidates)
      .where(eq(rosterCandidates.dataSourceId, DATA_SOURCE_ID));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.externalEmail).toBe(NEW_HIRE_EMAIL);
    expect(candidates[0]!.status).toBe("auto_approved");
    expect(candidates[0]!.reviewedAt).toBeTruthy();

    const createdEmployees = await db
      .select()
      .from(employees)
      .where(eq(employees.email, NEW_HIRE_EMAIL));
    expect(createdEmployees).toHaveLength(1);
    expect(createdEmployees[0]!.primaryTeamId).toBe(TEAM_ID);

    const identities = await db
      .select()
      .from(externalIdentities)
      .where(
        and(
          eq(externalIdentities.dataSourceId, DATA_SOURCE_ID),
          eq(externalIdentities.externalId, NEW_HIRE_EMAIL)
        )
      );
    expect(identities).toHaveLength(1);
    expect(identities[0]!.matchMethod).toBe("roster_discovery");

    const memberships = await db
      .select()
      .from(teamMemberships)
      .where(eq(teamMemberships.employeeId, createdEmployees[0]!.id));
    expect(memberships).toHaveLength(1);
    expect(memberships[0]!.teamId).toBe(TEAM_ID);
  });

  it("circuit breaker triggers when batch exceeds absolute threshold", async () => {
    const bulkMembers: DiscoveredRosterMember[] = Array.from({ length: 6 }, (_, i) => ({
      externalId: `bulk-hire-${i}@test.cadence.internal`,
      externalEmail: `bulk-hire-${i}@test.cadence.internal`,
      externalDisplayName: `Bulk Hire ${i}`,
      teamId: TEAM_ID,
    }));

    const connector = fakeConnector(bulkMembers);
    const result = await discoverRosterCandidates(connector, DATA_SOURCE_ID);
    expect(result.newCandidates).toBe(6);
    expect(result.autoApproved).toBe(0);

    const candidates = await db
      .select()
      .from(rosterCandidates)
      .where(
        and(
          eq(rosterCandidates.dataSourceId, DATA_SOURCE_ID),
          eq(rosterCandidates.changeType, "new")
        )
      );
    const bulkCandidates = candidates.filter((c) => c.externalEmail?.startsWith("bulk-hire-"));
    expect(bulkCandidates).toHaveLength(6);
    for (const c of bulkCandidates) {
      expect(c.status).toBe("pending");
    }

    const createdEmployees = await db
      .select()
      .from(employees)
      .where(eq(employees.organizationId, ORG_ID));
    const bulkEmployees = createdEmployees.filter((e) => e.email?.startsWith("bulk-hire-"));
    expect(bulkEmployees).toHaveLength(0);
  });

  it("percent-based circuit breaker trips for a small, non-zero roster (not just the absolute-max path)", async () => {
    // At this point exactly 1 active employee exists on TEAM_ID (from the
    // "auto-approves a genuinely new hire" test above) -- seed 2 more
    // directly so the roster is 3, a size where the >30% check itself
    // (not the rosterSize===0 shortcut) is what has to fire.
    await db.insert(employees).values([
      {
        id: PERCENT_SEED_1_ID,
        organizationId: ORG_ID,
        primaryTeamId: TEAM_ID,
        displayName: "Percent Seed 1",
      },
      {
        id: PERCENT_SEED_2_ID,
        organizationId: ORG_ID,
        primaryTeamId: TEAM_ID,
        displayName: "Percent Seed 2",
      },
    ]);

    // roster = 3, eligible = 2: 2 > 3 * 0.3 (0.9) -- trips, even though
    // 2 is well under AUTO_APPROVE_ABSOLUTE_MAX (5).
    const connector = fakeConnector([
      {
        externalId: PERCENT_TRIP_EMAIL_1,
        externalEmail: PERCENT_TRIP_EMAIL_1,
        externalDisplayName: "Percent Trip 1",
        teamId: TEAM_ID,
      },
      {
        externalId: PERCENT_TRIP_EMAIL_2,
        externalEmail: PERCENT_TRIP_EMAIL_2,
        externalDisplayName: "Percent Trip 2",
        teamId: TEAM_ID,
      },
    ]);

    const result = await discoverRosterCandidates(connector, DATA_SOURCE_ID);
    expect(result.autoApproved).toBe(0);
    expect(result.newCandidates).toBe(2);

    const candidates = await db
      .select()
      .from(rosterCandidates)
      .where(inArray(rosterCandidates.externalId, [PERCENT_TRIP_EMAIL_1, PERCENT_TRIP_EMAIL_2]));
    expect(candidates).toHaveLength(2);
    for (const c of candidates) expect(c.status).toBe("pending");

    const createdEmployees = await db
      .select()
      .from(employees)
      .where(inArray(employees.email, [PERCENT_TRIP_EMAIL_1, PERCENT_TRIP_EMAIL_2]));
    expect(createdEmployees).toHaveLength(0);
  });

  it("percent-based circuit breaker allows auto-approval when the roster is large enough (exercises the percent math, not the rosterSize===0 shortcut)", async () => {
    // Roster is now 3 (from the previous test) -- seed 1 more so it's 4.
    await db.insert(employees).values({
      id: PERCENT_SEED_3_ID,
      organizationId: ORG_ID,
      primaryTeamId: TEAM_ID,
      displayName: "Percent Seed 3",
    });

    // roster = 4, eligible = 1: 1 <= 4 * 0.3 (1.2) -- passes, and rosterSize
    // is definitely not 0 here, so this is the percent branch itself, not
    // the "no existing roster" shortcut the very first auto-approve test
    // above relies on.
    const connector = fakeConnector([
      {
        externalId: PERCENT_PASS_EMAIL,
        externalEmail: PERCENT_PASS_EMAIL,
        externalDisplayName: "Percent Pass",
        teamId: TEAM_ID,
      },
    ]);

    const result = await discoverRosterCandidates(connector, DATA_SOURCE_ID);
    expect(result.autoApproved).toBe(1);
    expect(result.newCandidates).toBe(0);

    const candidates = await db
      .select()
      .from(rosterCandidates)
      .where(eq(rosterCandidates.externalId, PERCENT_PASS_EMAIL));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.status).toBe("auto_approved");
  });

  it("does not re-propose a new-hire candidate that was already rejected", async () => {
    await db.insert(rosterCandidates).values({
      dataSourceId: DATA_SOURCE_ID,
      externalId: REJECTED_HIRE_EMAIL,
      externalEmail: REJECTED_HIRE_EMAIL,
      externalDisplayName: "Test Rejected Hire",
      changeType: "new",
      status: "rejected",
      reviewedAt: new Date(),
    });

    const connector = fakeConnector([
      {
        externalId: REJECTED_HIRE_EMAIL,
        externalEmail: REJECTED_HIRE_EMAIL,
        externalDisplayName: "Test Rejected Hire",
        teamId: TEAM_ID,
      },
    ]);

    const result = await discoverRosterCandidates(connector, DATA_SOURCE_ID);
    expect(result.newCandidates).toBe(0);
    expect(result.autoApproved).toBe(0);

    const candidates = await db
      .select()
      .from(rosterCandidates)
      .where(eq(rosterCandidates.externalId, REJECTED_HIRE_EMAIL));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.status).toBe("rejected");
  });

  it("does not re-propose a departure for an employee already marked inactive", async () => {
    await db.insert(employees).values({
      id: DEPARTED_EMPLOYEE_ID,
      organizationId: ORG_ID,
      primaryTeamId: TEAM_ID,
      displayName: "Test Departed Employee",
      email: DEPARTED_EMAIL,
      employmentStatus: "inactive",
    });
    await db.insert(externalIdentities).values({
      employeeId: DEPARTED_EMPLOYEE_ID,
      dataSourceId: DATA_SOURCE_ID,
      externalEntityType: "agent",
      externalId: DEPARTED_EMAIL,
      externalEmail: DEPARTED_EMAIL,
      externalDisplayName: "Test Departed Employee",
      matchMethod: "email",
    });
    await db.insert(rosterCandidates).values({
      dataSourceId: DATA_SOURCE_ID,
      externalId: DEPARTED_EMAIL,
      externalEmail: DEPARTED_EMAIL,
      externalDisplayName: "Test Departed Employee",
      changeType: "departed",
      employeeId: DEPARTED_EMPLOYEE_ID,
      status: "approved",
      reviewedAt: new Date(),
    });

    // Empty, not because nothing else is active on this team -- earlier tests
    // in this file (e.g. the auto-approved new hire) leave their own real,
    // active employees behind for the rest of the suite, and those correctly
    // DO show up as fresh departures when "discovered" comes back empty. This
    // test only cares whether the already-inactive DEPARTED_EMAIL specifically
    // gets re-proposed, so it asserts on that one row, not the aggregate count.
    const connector = fakeConnector([]);
    await discoverRosterCandidates(connector, DATA_SOURCE_ID);

    const candidates = await db
      .select()
      .from(rosterCandidates)
      .where(eq(rosterCandidates.externalId, DEPARTED_EMAIL));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.status).toBe("approved");
  });

  it("rolls back employee and identity creation when membership fails, retaining only a pending candidate", async () => {
    const email = "atomic-rollback@test.cadence.internal";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await db.execute(
      sql.raw(`CREATE OR REPLACE FUNCTION test_roster_membership_failure()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF EXISTS (SELECT 1 FROM employees WHERE id=NEW.employee_id
        AND email='atomic-rollback@test.cadence.internal') THEN
        RAISE EXCEPTION 'Synthetic membership failure for atomic-rollback@test.cadence.internal';
      END IF; RETURN NEW; END $$`)
    );
    await db.execute(
      sql.raw(`CREATE TRIGGER test_roster_membership_failure
      BEFORE INSERT ON team_memberships FOR EACH ROW EXECUTE FUNCTION test_roster_membership_failure()`)
    );
    try {
      const result = await discoverRosterCandidates(
        fakeConnector([
          {
            externalId: email,
            externalEmail: email,
            externalDisplayName: "Synthetic rollback",
            teamId: TEAM_ID,
          },
        ]),
        DATA_SOURCE_ID
      );
      expect(result.autoApproved).toBe(0);
      expect(result.newCandidates).toBe(1);
      expect(await db.select().from(employees).where(eq(employees.email, email))).toHaveLength(0);
      expect(
        await db.select().from(externalIdentities).where(eq(externalIdentities.externalId, email))
      ).toHaveLength(0);
      const candidates = await db
        .select()
        .from(rosterCandidates)
        .where(eq(rosterCandidates.externalId, email));
      expect(candidates).toHaveLength(1);
      expect(candidates[0]!.status).toBe("pending");
      expect(JSON.stringify(log.mock.calls)).not.toContain(email);
      expect(JSON.stringify(log.mock.calls)).toContain("Database operation failed");
    } finally {
      await db.execute(
        sql.raw("DROP TRIGGER IF EXISTS test_roster_membership_failure ON team_memberships")
      );
      await db.execute(sql.raw("DROP FUNCTION IF EXISTS test_roster_membership_failure()"));
      log.mockRestore();
    }
  });

  it("does not exclude a candidate because their email is a manager in a different organization", async () => {
    const otherOrg = "99999999-0000-4000-8000-000000000110";
    const otherUser = "99999999-0000-4000-8000-000000000111";
    const email = "other-org-manager@test.cadence.internal";
    await db.insert(organizations).values({ id: otherOrg, name: "Other synthetic org" });
    await db.insert(users).values({
      id: otherUser,
      organizationId: otherOrg,
      email,
      displayName: "Other synthetic manager",
    });
    try {
      const result = await discoverRosterCandidates(
        fakeConnector([
          {
            externalId: email,
            externalEmail: email,
            externalDisplayName: "Synthetic hire",
            teamId: TEAM_ID,
          },
        ]),
        DATA_SOURCE_ID
      );
      expect(result.autoApproved).toBe(1);
      const [employee] = await db.select().from(employees).where(eq(employees.email, email));
      expect(employee!.organizationId).toBe(ORG_ID);
    } finally {
      await db.delete(users).where(eq(users.id, otherUser));
      await db.delete(organizations).where(eq(organizations.id, otherOrg));
    }
  });

  it("serializes simultaneous discoveries and keeps only one pending departure per identity", async () => {
    const email = "concurrent-hire@test.cadence.internal";
    const connector = fakeConnector([
      {
        externalId: email,
        externalEmail: email,
        externalDisplayName: "Concurrent synthetic hire",
        teamId: TEAM_ID,
      },
    ]);
    const results = await Promise.all([
      discoverRosterCandidates(connector, DATA_SOURCE_ID),
      discoverRosterCandidates(connector, DATA_SOURCE_ID),
    ]);
    expect(results.reduce((total, result) => total + result.autoApproved, 0)).toBe(1);
    expect(await db.select().from(employees).where(eq(employees.email, email))).toHaveLength(1);
    expect(
      await db.select().from(rosterCandidates).where(eq(rosterCandidates.externalId, email))
    ).toHaveLength(1);
    await Promise.all([
      discoverRosterCandidates(fakeConnector([]), DATA_SOURCE_ID),
      discoverRosterCandidates(fakeConnector([]), DATA_SOURCE_ID),
    ]);
    const departures = await db
      .select()
      .from(rosterCandidates)
      .where(
        and(
          eq(rosterCandidates.dataSourceId, DATA_SOURCE_ID),
          eq(rosterCandidates.externalId, email),
          eq(rosterCandidates.changeType, "departed"),
          eq(rosterCandidates.status, "pending")
        )
      );
    expect(departures).toHaveLength(1);
  });

  it("refuses stale mapping observations without creating a candidate", async () => {
    const email = "stale-mapping@test.cadence.internal";
    const connector = {
      discoverRoster: async () => {
        await db
          .update(rosterSourceTeamMappings)
          .set({ line: "changed-during-fetch" })
          .where(eq(rosterSourceTeamMappings.dataSourceId, DATA_SOURCE_ID));
        return [
          {
            externalId: email,
            externalEmail: email,
            externalDisplayName: "Stale synthetic hire",
            teamId: TEAM_ID,
          },
        ];
      },
    } as unknown as Connector;
    try {
      await expect(discoverRosterCandidates(connector, DATA_SOURCE_ID)).rejects.toThrow(
        "Roster mappings changed"
      );
      expect(
        await db.select().from(rosterCandidates).where(eq(rosterCandidates.externalId, email))
      ).toHaveLength(0);
      expect(await db.select().from(employees).where(eq(employees.email, email))).toHaveLength(0);
    } finally {
      await db
        .update(rosterSourceTeamMappings)
        .set({ line: null })
        .where(eq(rosterSourceTeamMappings.dataSourceId, DATA_SOURCE_ID));
    }
  });
});

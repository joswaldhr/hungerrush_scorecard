// Integration tests against a real Postgres database (see vitest.config.mts's
// test.env, which points DATABASE_URL at the docker-compose db by default).
// Locally: `docker compose up -d && pnpm db:migrate` before `pnpm test`.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { discoverRosterCandidates } from "@/lib/domain/roster/reconcile";
import type { Connector } from "@/lib/connectors";
import type { DiscoveredRosterMember } from "@/lib/connectors/types";

const ORG_ID = "99999999-0000-4000-8000-000000000101";
const TEAM_ID = "99999999-0000-4000-8000-000000000102";
const DATA_SOURCE_ID = "99999999-0000-4000-8000-000000000103";
const MANAGER_USER_ID = "99999999-0000-4000-8000-000000000104";
const REJECTED_HIRE_EMPLOYEE_ID = "99999999-0000-4000-8000-000000000105";
const DEPARTED_EMPLOYEE_ID = "99999999-0000-4000-8000-000000000106";

const MANAGER_EMAIL = "test-manager@test.cadence.internal";
const NEW_HIRE_EMAIL = "test-new-hire@test.cadence.internal";
const REJECTED_HIRE_EMAIL = "test-rejected-hire@test.cadence.internal";
const DEPARTED_EMAIL = "test-departed@test.cadence.internal";

function fakeConnector(members: DiscoveredRosterMember[]): Connector {
  return { discoverRoster: async () => members } as unknown as Connector;
}

async function cleanup() {
  await db.delete(rosterCandidates).where(eq(rosterCandidates.dataSourceId, DATA_SOURCE_ID));
  await db
    .delete(externalIdentities)
    .where(inArray(externalIdentities.employeeId, [REJECTED_HIRE_EMPLOYEE_ID, DEPARTED_EMPLOYEE_ID]));
  await db
    .delete(employees)
    .where(inArray(employees.id, [REJECTED_HIRE_EMPLOYEE_ID, DEPARTED_EMPLOYEE_ID]));
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

    const candidates = await db
      .select()
      .from(rosterCandidates)
      .where(eq(rosterCandidates.dataSourceId, DATA_SOURCE_ID));
    expect(candidates).toHaveLength(0);
  });

  it("still proposes a genuinely new hire whose email isn't a manager account", async () => {
    const connector = fakeConnector([
      {
        externalId: NEW_HIRE_EMAIL,
        externalEmail: NEW_HIRE_EMAIL,
        externalDisplayName: "Test New Hire",
        teamId: TEAM_ID,
      },
    ]);

    const result = await discoverRosterCandidates(connector, DATA_SOURCE_ID);
    expect(result.newCandidates).toBe(1);

    const candidates = await db
      .select()
      .from(rosterCandidates)
      .where(eq(rosterCandidates.dataSourceId, DATA_SOURCE_ID));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.externalEmail).toBe(NEW_HIRE_EMAIL);
  });

  it("does not re-propose a new-hire candidate that was already rejected", async () => {
    // Same person as a previous run: rejected once, still showing up in the
    // group on every later run. Found 2026-09-15: without this, a rejected
    // candidate gets proposed again forever, since only *pending* candidates
    // were checked before, not resolved ones.
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

    const candidates = await db
      .select()
      .from(rosterCandidates)
      .where(eq(rosterCandidates.externalId, REJECTED_HIRE_EMAIL));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.status).toBe("rejected");
  });

  it("does not re-propose a departure for an employee already marked inactive", async () => {
    // Same shape as the rejected-hire case, mirrored for departures: an
    // employee already deactivated (via a previously approved departure
    // candidate) should not be re-proposed just because they remain absent
    // from the Zendesk group -- they already are departed in our system.
    // Found 2026-09-15: 32 employees approved as departed weeks earlier were
    // still being re-flagged as fresh pending candidates on every run.
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

    // Not in the discovered set -- genuinely absent from the Zendesk group,
    // same as a real departure.
    const connector = fakeConnector([]);

    const result = await discoverRosterCandidates(connector, DATA_SOURCE_ID);
    expect(result.departedCandidates).toBe(0);

    const candidates = await db
      .select()
      .from(rosterCandidates)
      .where(eq(rosterCandidates.externalId, DEPARTED_EMAIL));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.status).toBe("approved");
  });
});

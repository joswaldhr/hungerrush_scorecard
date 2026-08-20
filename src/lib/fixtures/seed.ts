import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  organizations,
  users,
  teams,
  employees,
  teamMemberships,
  managerAssignments,
  dataSources,
  externalIdentities,
} from "../db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const client = postgres(connectionString);
const db = drizzle(client);

// ── Fixed IDs for deterministic seeding ─────────────────────

const ORG_ID = "10000000-0000-4000-8000-000000000001";

const TEAM = {
  pos: "20000000-0000-4000-8000-000000000001",
  menufy: "20000000-0000-4000-8000-000000000002",
};

const USER = {
  james: "30000000-0000-4000-8000-000000000001",
  maria: "30000000-0000-4000-8000-000000000002",
};

const EMP = {
  alexChen: "40000000-0000-4000-8000-000000000001",
  sarahJohnson: "40000000-0000-4000-8000-000000000002",
  mikeWilliams: "40000000-0000-4000-8000-000000000003",
  emilyBrown: "40000000-0000-4000-8000-000000000004",
  davidKim: "40000000-0000-4000-8000-000000000005",
  lisaAnderson: "40000000-0000-4000-8000-000000000006",
  carlosRodriguez: "40000000-0000-4000-8000-000000000007",
  rachelThompson: "40000000-0000-4000-8000-000000000008",
  kevinObrien: "40000000-0000-4000-8000-000000000009",
  amandaFoster: "40000000-0000-4000-8000-00000000000a",
};

const DS = {
  zendesk: "50000000-0000-4000-8000-000000000001",
  assembled: "50000000-0000-4000-8000-000000000002",
};

async function seed() {
  console.log("Seeding database...");

  await db.transaction(async (tx) => {
    // Clear in reverse FK order
    await tx.delete(externalIdentities).execute();
    await tx.delete(dataSources).execute();
    await tx.delete(managerAssignments).execute();
    await tx.delete(teamMemberships).execute();
    await tx.delete(employees).execute();
    await tx.delete(teams).execute();
    await tx.delete(users).execute();
    await tx.delete(organizations).execute();

    // Organization
    await tx.insert(organizations).values({
      id: ORG_ID,
      name: "HungerRush",
    });

    // Teams
    await tx.insert(teams).values([
      {
        id: TEAM.pos,
        organizationId: ORG_ID,
        name: "HungerRush POS Support",
        slug: "pos-support",
      },
      {
        id: TEAM.menufy,
        organizationId: ORG_ID,
        name: "Menufy Support",
        slug: "menufy-support",
      },
    ]);

    // Manager users
    await tx.insert(users).values([
      {
        id: USER.james,
        organizationId: ORG_ID,
        email: "james.smith@hungerrush.dev",
        displayName: "James Smith",
      },
      {
        id: USER.maria,
        organizationId: ORG_ID,
        email: "maria.garcia@hungerrush.dev",
        displayName: "Maria Garcia",
      },
    ]);

    // POS Support employees (6)
    const posEmployees = [
      { id: EMP.alexChen, name: "Alex Chen", title: "Support Agent", email: "alex.chen" },
      {
        id: EMP.sarahJohnson,
        name: "Sarah Johnson",
        title: "Senior Support Agent",
        email: "sarah.johnson",
      },
      {
        id: EMP.mikeWilliams,
        name: "Mike Williams",
        title: "Support Agent",
        email: "mike.williams",
      },
      { id: EMP.emilyBrown, name: "Emily Brown", title: "Support Agent", email: "emily.brown" },
      {
        id: EMP.davidKim,
        name: "David Kim",
        title: "Lead Support Agent",
        email: "david.kim",
      },
      {
        id: EMP.lisaAnderson,
        name: "Lisa Anderson",
        title: "Support Agent",
        email: "lisa.anderson",
      },
    ];

    // Menufy Support employees (4)
    const menufyEmployees = [
      {
        id: EMP.carlosRodriguez,
        name: "Carlos Rodriguez",
        title: "Support Agent",
        email: "carlos.rodriguez",
      },
      {
        id: EMP.rachelThompson,
        name: "Rachel Thompson",
        title: "Senior Support Agent",
        email: "rachel.thompson",
      },
      {
        id: EMP.kevinObrien,
        name: "Kevin O'Brien",
        title: "Support Agent",
        email: "kevin.obrien",
      },
      {
        id: EMP.amandaFoster,
        name: "Amanda Foster",
        title: "Support Agent",
        email: "amanda.foster",
      },
    ];

    await tx.insert(employees).values([
      ...posEmployees.map((e) => ({
        id: e.id,
        organizationId: ORG_ID,
        primaryTeamId: TEAM.pos,
        displayName: e.name,
        email: `${e.email}@hungerrush.dev`,
        jobTitle: e.title,
      })),
      ...menufyEmployees.map((e) => ({
        id: e.id,
        organizationId: ORG_ID,
        primaryTeamId: TEAM.menufy,
        displayName: e.name,
        email: `${e.email}@hungerrush.dev`,
        jobTitle: e.title,
      })),
    ]);

    // Team memberships
    const today = new Date().toISOString().split("T")[0]!;

    await tx.insert(teamMemberships).values([
      ...posEmployees.map((e) => ({
        employeeId: e.id,
        teamId: TEAM.pos,
        roleType: e.title.includes("Lead")
          ? "lead"
          : e.title.includes("Senior")
            ? "senior"
            : "member",
        effectiveFrom: today,
      })),
      ...menufyEmployees.map((e) => ({
        employeeId: e.id,
        teamId: TEAM.menufy,
        roleType: e.title.includes("Senior") ? "senior" : "member",
        effectiveFrom: today,
      })),
    ]);

    // Manager assignments
    await tx.insert(managerAssignments).values([
      {
        managerUserId: USER.james,
        teamId: TEAM.pos,
        assignmentType: "team",
        effectiveFrom: today,
      },
      {
        managerUserId: USER.maria,
        teamId: TEAM.menufy,
        assignmentType: "team",
        effectiveFrom: today,
      },
    ]);

    // Data sources (configured, no syncs yet)
    await tx.insert(dataSources).values([
      {
        id: DS.zendesk,
        organizationId: ORG_ID,
        type: "zendesk",
        displayName: "Zendesk",
        status: "configured",
      },
      {
        id: DS.assembled,
        organizationId: ORG_ID,
        type: "assembled",
        displayName: "Assembled",
        status: "configured",
      },
    ]);

    // External identities (sample mappings to prove the model works)
    await tx.insert(externalIdentities).values([
      {
        employeeId: EMP.alexChen,
        dataSourceId: DS.zendesk,
        externalEntityType: "agent",
        externalId: "zd-agent-1001",
        externalEmail: "alex.chen@hungerrush.dev",
        externalDisplayName: "Alex Chen",
        matchMethod: "email",
        matchConfidence: 1.0,
      },
      {
        employeeId: EMP.alexChen,
        dataSourceId: DS.assembled,
        externalEntityType: "user",
        externalId: "asm-user-2001",
        externalEmail: "alex.chen@hungerrush.dev",
        matchMethod: "email",
        matchConfidence: 1.0,
      },
      {
        employeeId: EMP.sarahJohnson,
        dataSourceId: DS.zendesk,
        externalEntityType: "agent",
        externalId: "zd-agent-1002",
        externalEmail: "sarah.johnson@hungerrush.dev",
        matchMethod: "email",
        matchConfidence: 1.0,
      },
      {
        employeeId: EMP.carlosRodriguez,
        dataSourceId: DS.zendesk,
        externalEntityType: "agent",
        externalId: "zd-agent-1007",
        externalEmail: "carlos.rodriguez@hungerrush.dev",
        matchMethod: "email",
        matchConfidence: 1.0,
      },
    ]);
  });

  console.log("Seed complete.");
  console.log("  Organization: HungerRush");
  console.log("  Teams: POS Support (6 employees), Menufy Support (4 employees)");
  console.log("  Managers: james.smith@hungerrush.dev (POS), maria.garcia@hungerrush.dev (Menufy)");
  console.log("  Data sources: Zendesk, Assembled (configured, no syncs)");
  console.log("  External identities: 4 sample mappings");

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

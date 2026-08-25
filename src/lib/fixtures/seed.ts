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
  metricDefinitions,
  metricAssignments,
  metricTargets,
  metricValues,
  metricObservations,
  syncRuns,
  syncErrors,
  sourceRecords,
  normalizedFacts,
  contextItems,
  meetingReferences,
  reconciliationRuns,
  reconciliationResults,
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
  alexander: "30000000-0000-4000-8000-000000000001",
  barbara: "30000000-0000-4000-8000-000000000002",
};

function empId(n: number): string {
  return `40000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

const DS = {
  zendesk: "50000000-0000-4000-8000-000000000001",
  assembled: "50000000-0000-4000-8000-000000000002",
};

const MD = {
  ticketsResolved: "60000000-0000-4000-8000-000000000001",
  avgHandleTime: "60000000-0000-4000-8000-000000000002",
  csatScore: "60000000-0000-4000-8000-000000000003",
  firstContactResolution: "60000000-0000-4000-8000-000000000004",
  scheduleAdherence: "60000000-0000-4000-8000-000000000005",
  backlogCount: "60000000-0000-4000-8000-000000000006",
  avgResponseTime: "60000000-0000-4000-8000-000000000007",
};

// ── Real org roster (HungerRush POS Support + Menufy Support), pulled
// from Microsoft Graph for the two pilot managers' direct reports ──

interface RosterEntry {
  name: string;
  email: string;
  title: string;
}

const POS_ROSTER: RosterEntry[] = [
  { name: "Anthony Edge", email: "aedge@hungerrush.com", title: "Manager, Technical Support" },
  {
    name: "Michael VonHatten",
    email: "michael.vonhatten@revention.onmicrosoft.com",
    title: "Principal Support Specialist",
  },
  {
    name: "John Howard",
    email: "john.howard@revention.onmicrosoft.com",
    title: "Senior Support Specialist",
  },
  { name: "Sara Moon", email: "sara.moon@hungerrush.com", title: "Manager, Technical Support" },
  {
    name: "Warren Oxcimer",
    email: "warren.oxcimer@revention.onmicrosoft.com",
    title: "Support Specialist",
  },
  {
    name: "Christopher Courcy",
    email: "christopher.courcy@hungerrush.com",
    title: "Manager, Technical Support",
  },
  {
    name: "Amher Pitogo",
    email: "amher.pitogo@revention.onmicrosoft.com",
    title: "Support Specialist",
  },
  {
    name: "Kelly Breedlove",
    email: "kelly.breedlove@hungerrush.com",
    title: "Manager, Technical Support",
  },
  {
    name: "Milo Vaflor",
    email: "milo.vaflor@revention.onmicrosoft.com",
    title: "Technical Support Specialist",
  },
  {
    name: "Jeric Bastian",
    email: "jeric.bastian@revention.onmicrosoft.com",
    title: "Technical Support Specialist",
  },
  {
    name: "Santiago Roldan",
    email: "santiago.roldan@hungerrush.com",
    title: "Technical Support Specialist",
  },
  {
    name: "Kider Alvarez",
    email: "kider.porras@hungerrush.com",
    title: "Technical Support Specialist",
  },
  {
    name: "Andres Lugo",
    email: "andres.lugo@hungerrush.com",
    title: "Technical Support Specialist",
  },
  {
    name: "Angel Banquez",
    email: "angel.banquez@hungerrush.com",
    title: "Technical Support Specialist",
  },
  {
    name: "Diego Salas",
    email: "diego.salas@hungerrush.com",
    title: "Technical Support Specialist",
  },
];

const MENUFY_ROSTER: RosterEntry[] = [
  {
    name: "James Maynard",
    email: "james.maynard@hungerrush.com",
    title: "Manager, Customer Support",
  },
  {
    name: "Jacob Murray",
    email: "jacob.murray@hungerrush.com",
    title: "Manager, Customer Support",
  },
  {
    name: "Norvel Crawford",
    email: "norvel.crawford@hungerrush.com",
    title: "Manager, Customer Support",
  },
  {
    name: "Tazarrah Ramos",
    email: "tazarrah.ramos@revention.onmicrosoft.com",
    title: "Support Specialist",
  },
  {
    name: "Crismarie Gabison",
    email: "crismarie.gibson@revention.onmicrosoft.com",
    title: "Client Support Specialist",
  },
  {
    name: "Emmanuel Granzo",
    email: "emmanuel.granzo@revention.onmicrosoft.com",
    title: "Support Specialist",
  },
  {
    name: "Patrisha De Belen",
    email: "patrisha.debelen@revention.onmicrosoft.com",
    title: "Support Specialist",
  },
  {
    name: "Yuanting Zhou",
    email: "yuanting.zhou@revention.onmicrosoft.com",
    title: "Bilingual Mandarin Support Specialist",
  },
  {
    name: "Hyrum Estrada",
    email: "hyrum.estrada@revention.onmicrosoft.com",
    title: "Bilingual Support Specialist",
  },
  {
    name: "Camilo Sanchez",
    email: "camilo.ramos@revention.onmicrosoft.com",
    title: "Support Specialist",
  },
  {
    name: "Reda Khaznadji",
    email: "reda.khaznadji@revention.onmicrosoft.com",
    title: "Support Specialist",
  },
  {
    name: "Amira Baaziz",
    email: "amira.baaziz@revention.onmicrosoft.com",
    title: "Support Specialist",
  },
  {
    name: "Mike Trinidad",
    email: "mike.trinidad@revention.onmicrosoft.com",
    title: "Support Specialist",
  },
  {
    name: "Arnie Joy Jamero",
    email: "arnie.jamero@revention.onmicrosoft.com",
    title: "Support Specialist",
  },
  {
    name: "Sarai Mendez",
    email: "sarai.mendez@revention.onmicrosoft.com",
    title: "Support Specialist",
  },
  {
    name: "Yesenia Ortiz",
    email: "yesenia.ortiz@revention.onmicrosoft.com",
    title: "Support Specialist",
  },
  {
    name: "Leslie Anne Candaza",
    email: "leslie.candaza@revention.onmicrosoft.com",
    title: "Customer Support Specialist",
  },
  {
    name: "Jhessryl Dagohoy",
    email: "jhessryl.dagohoy@revention.onmicrosoft.com",
    title: "Customer Support Specialist",
  },
  {
    name: "Jaine Cantre",
    email: "jaine.cantre@revention.onmicrosoft.com",
    title: "Customer Support Specialist",
  },
  {
    name: "Paul Anthony Paco",
    email: "paul.paco@revention.onmicrosoft.com",
    title: "Support Specialist",
  },
  {
    name: "Huan Nguyen",
    email: "huan.nguyen@revention.onmicrosoft.com",
    title: "Support Specialist",
  },
];

function roleTypeFor(title: string): string {
  if (title.includes("Manager")) return "lead";
  if (title.includes("Senior") || title.includes("Principal")) return "senior";
  return "member";
}

async function seed() {
  console.log("Seeding database...");

  await db.transaction(async (tx) => {
    // Clear in reverse FK order
    await tx.delete(reconciliationResults).execute();
    await tx.delete(reconciliationRuns).execute();
    await tx.delete(meetingReferences).execute();
    await tx.delete(contextItems).execute();
    await tx.delete(normalizedFacts).execute();
    await tx.delete(sourceRecords).execute();
    await tx.delete(syncErrors).execute();
    await tx.delete(syncRuns).execute();
    await tx.delete(metricObservations).execute();
    await tx.delete(metricValues).execute();
    await tx.delete(metricTargets).execute();
    await tx.delete(metricAssignments).execute();
    await tx.delete(metricDefinitions).execute();
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

    // Manager users — real pilot managers
    await tx.insert(users).values([
      {
        id: USER.alexander,
        organizationId: ORG_ID,
        email: "alexander.smith@hungerrush.com",
        displayName: "Alexander Smith",
      },
      {
        id: USER.barbara,
        organizationId: ORG_ID,
        email: "barbara.maenza@hungerrush.com",
        displayName: "Barbara Maenza",
      },
    ]);

    const posEmployees = POS_ROSTER.map((e, i) => ({ ...e, id: empId(i + 1) }));
    const menufyEmployees = MENUFY_ROSTER.map((e, i) => ({ ...e, id: empId(100 + i + 1) }));

    await tx.insert(employees).values([
      ...posEmployees.map((e) => ({
        id: e.id,
        organizationId: ORG_ID,
        primaryTeamId: TEAM.pos,
        displayName: e.name,
        email: e.email,
        jobTitle: e.title,
      })),
      ...menufyEmployees.map((e) => ({
        id: e.id,
        organizationId: ORG_ID,
        primaryTeamId: TEAM.menufy,
        displayName: e.name,
        email: e.email,
        jobTitle: e.title,
      })),
    ]);

    // Team memberships
    const today = new Date().toISOString().split("T")[0]!;

    await tx.insert(teamMemberships).values([
      ...posEmployees.map((e) => ({
        employeeId: e.id,
        teamId: TEAM.pos,
        roleType: roleTypeFor(e.title),
        effectiveFrom: today,
      })),
      ...menufyEmployees.map((e) => ({
        employeeId: e.id,
        teamId: TEAM.menufy,
        roleType: roleTypeFor(e.title),
        effectiveFrom: today,
      })),
    ]);

    // Manager assignments
    await tx.insert(managerAssignments).values([
      {
        managerUserId: USER.alexander,
        teamId: TEAM.pos,
        assignmentType: "team",
        effectiveFrom: today,
      },
      {
        managerUserId: USER.barbara,
        teamId: TEAM.menufy,
        assignmentType: "team",
        effectiveFrom: today,
      },
    ]);

    // Data sources — real, live vendor connections
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

    // External identities — matched by real company email
    const allEmployees = [...posEmployees, ...menufyEmployees];
    const identityValues = allEmployees.flatMap((emp) => [
      {
        employeeId: emp.id,
        dataSourceId: DS.zendesk,
        externalEntityType: "agent",
        externalId: emp.email,
        externalEmail: emp.email,
        externalDisplayName: emp.name,
        matchMethod: "email",
        matchConfidence: 1.0,
      },
      {
        employeeId: emp.id,
        dataSourceId: DS.assembled,
        externalEntityType: "user",
        externalId: emp.email,
        externalEmail: emp.email,
        externalDisplayName: emp.name,
        matchMethod: "email",
        matchConfidence: 1.0,
      },
    ]);
    await tx.insert(externalIdentities).values(identityValues);

    // ── Metric Definitions ─────────────────────────────────────

    await tx.insert(metricDefinitions).values([
      {
        id: MD.ticketsResolved,
        organizationId: ORG_ID,
        key: "tickets_resolved",
        name: "Tickets Resolved",
        description: "Number of tickets resolved during the period",
        category: "productivity",
        unit: "tickets",
        valueType: "count",
        direction: "higher_is_better",
        calculationType: "sum",
        sourceStrategy: "zendesk",
      },
      {
        id: MD.avgHandleTime,
        organizationId: ORG_ID,
        key: "avg_handle_time",
        name: "Avg Handle Time",
        description: "Average time to resolve a ticket in minutes",
        category: "efficiency",
        unit: "min",
        valueType: "duration",
        direction: "lower_is_better",
        calculationType: "average",
        sourceStrategy: "zendesk",
      },
      {
        id: MD.csatScore,
        organizationId: ORG_ID,
        key: "csat_score",
        name: "CSAT Score",
        description: "Customer satisfaction score from post-interaction surveys",
        category: "quality",
        unit: "%",
        valueType: "percentage",
        direction: "higher_is_better",
        calculationType: "average",
        sourceStrategy: "zendesk",
      },
      {
        id: MD.firstContactResolution,
        organizationId: ORG_ID,
        key: "first_contact_resolution",
        name: "First Contact Resolution",
        description: "Percentage of tickets resolved on first contact",
        category: "quality",
        unit: "%",
        valueType: "percentage",
        direction: "higher_is_better",
        calculationType: "average",
        sourceStrategy: "zendesk",
      },
      {
        id: MD.scheduleAdherence,
        organizationId: ORG_ID,
        key: "schedule_adherence",
        name: "Schedule Adherence",
        description: "Percentage of scheduled time actually worked",
        category: "attendance",
        unit: "%",
        valueType: "percentage",
        direction: "higher_is_better",
        calculationType: "average",
        sourceStrategy: "assembled",
      },
      {
        id: MD.backlogCount,
        organizationId: ORG_ID,
        key: "backlog_count",
        name: "Backlog",
        description: "Number of unresolved tickets assigned at period end",
        category: "workload",
        unit: "tickets",
        valueType: "count",
        direction: "lower_is_better",
        calculationType: "latest",
        sourceStrategy: "zendesk",
      },
      {
        id: MD.avgResponseTime,
        organizationId: ORG_ID,
        key: "avg_response_time",
        name: "Avg Response Time",
        description: "Average first response time in minutes",
        category: "efficiency",
        unit: "min",
        valueType: "duration",
        direction: "lower_is_better",
        calculationType: "average",
        sourceStrategy: "zendesk",
      },
    ]);

    // ── Metric Assignments (different per team) ────────────────
    // first_contact_resolution stays in the catalog but unassigned — no
    // live source produces it (Zendesk has no native FCR field).

    // schedule_adherence stays in the catalog but unassigned — this Assembled
    // account's /agents/state state-name vocabulary ("Offline", "Online...")
    // never overlaps with /activity_types' productive names ("In/Out Calls",
    // "Phone + Email"), so it can never be computed from this account's real
    // data. The old system's own audit already flagged this metric as "0 rows
    // ever" in real production for the same reason.
    const posMetrics = [
      { defId: MD.ticketsResolved, order: 0, primary: true },
      { defId: MD.avgHandleTime, order: 1, primary: true },
      { defId: MD.csatScore, order: 2, primary: true },
      { defId: MD.backlogCount, order: 3, primary: false },
    ];

    const menufyMetrics = [
      { defId: MD.ticketsResolved, order: 0, primary: true },
      { defId: MD.avgResponseTime, order: 1, primary: true },
      { defId: MD.csatScore, order: 2, primary: true },
    ];

    await tx.insert(metricAssignments).values([
      ...posMetrics.map((m) => ({
        metricDefinitionId: m.defId,
        teamId: TEAM.pos,
        displayOrder: m.order,
        isPrimary: m.primary,
      })),
      ...menufyMetrics.map((m) => ({
        metricDefinitionId: m.defId,
        teamId: TEAM.menufy,
        displayOrder: m.order,
        isPrimary: m.primary,
      })),
    ]);

    // ── Metric Targets ─────────────────────────────────────────

    await tx.insert(metricTargets).values([
      // POS team-level targets
      {
        metricDefinitionId: MD.ticketsResolved,
        teamId: TEAM.pos,
        targetType: "minimum",
        targetValue: 45,
        warningValue: 35,
      },
      {
        metricDefinitionId: MD.avgHandleTime,
        teamId: TEAM.pos,
        targetType: "maximum",
        targetValue: 12,
        warningValue: 15,
      },
      {
        metricDefinitionId: MD.csatScore,
        teamId: TEAM.pos,
        targetType: "minimum",
        targetValue: 85,
        warningValue: 75,
      },
      {
        metricDefinitionId: MD.backlogCount,
        teamId: TEAM.pos,
        targetType: "maximum",
        targetValue: 8,
        warningValue: 12,
      },

      // Menufy team-level targets (different thresholds)
      {
        metricDefinitionId: MD.ticketsResolved,
        teamId: TEAM.menufy,
        targetType: "minimum",
        targetValue: 35,
        warningValue: 25,
      },
      {
        metricDefinitionId: MD.avgResponseTime,
        teamId: TEAM.menufy,
        targetType: "maximum",
        targetValue: 15,
        warningValue: 20,
      },
      {
        metricDefinitionId: MD.csatScore,
        teamId: TEAM.menufy,
        targetType: "minimum",
        targetValue: 80,
        warningValue: 70,
      },
    ]);

    // Metric values are intentionally left empty here — real history comes
    // from running the live Zendesk/Assembled sync against this real roster,
    // not from fabricated numbers attached to real people.
  });

  console.log("Seed complete.");
  console.log("  Organization: HungerRush");
  console.log(
    `  Teams: HungerRush POS Support (${POS_ROSTER.length} employees), Menufy Support (${MENUFY_ROSTER.length} employees)`
  );
  console.log("  Managers: Alexander Smith (POS), Barbara Maenza (Menufy)");
  console.log("  Metric definitions: 7 (first_contact_resolution unassigned — no live source)");
  console.log("  Data sources: Zendesk, Assembled (real, live)");
  console.log("  Metric values: none — run a live sync to populate real history");

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

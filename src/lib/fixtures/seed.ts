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

const MD = {
  ticketsResolved: "60000000-0000-4000-8000-000000000001",
  avgHandleTime: "60000000-0000-4000-8000-000000000002",
  csatScore: "60000000-0000-4000-8000-000000000003",
  firstContactResolution: "60000000-0000-4000-8000-000000000004",
  scheduleAdherence: "60000000-0000-4000-8000-000000000005",
  backlogCount: "60000000-0000-4000-8000-000000000006",
  avgResponseTime: "60000000-0000-4000-8000-000000000007",
};

// ── Deterministic pseudo-random for repeatable fixture data ──

function seededValue(seed: number, min: number, max: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  const t = x - Math.floor(x);
  return min + t * (max - min);
}

function weekStart(weeksAgo: number): string {
  const d = new Date("2026-08-18");
  d.setDate(d.getDate() - weeksAgo * 7);
  return d.toISOString().split("T")[0]!;
}

function weekEnd(weeksAgo: number): string {
  const d = new Date("2026-08-18");
  d.setDate(d.getDate() - weeksAgo * 7 + 6);
  return d.toISOString().split("T")[0]!;
}

async function seed() {
  console.log("Seeding database...");

  await db.transaction(async (tx) => {
    // Clear in reverse FK order
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
      { id: EMP.davidKim, name: "David Kim", title: "Lead Support Agent", email: "david.kim" },
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
      { id: EMP.kevinObrien, name: "Kevin O'Brien", title: "Support Agent", email: "kevin.obrien" },
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
      { managerUserId: USER.james, teamId: TEAM.pos, assignmentType: "team", effectiveFrom: today },
      {
        managerUserId: USER.maria,
        teamId: TEAM.menufy,
        assignmentType: "team",
        effectiveFrom: today,
      },
    ]);

    // Data sources
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

    // External identities
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

    // POS: tickets_resolved, avg_handle_time, csat_score, first_contact_resolution, schedule_adherence, backlog_count
    const posMetrics = [
      { defId: MD.ticketsResolved, order: 0, primary: true },
      { defId: MD.avgHandleTime, order: 1, primary: true },
      { defId: MD.csatScore, order: 2, primary: true },
      { defId: MD.firstContactResolution, order: 3, primary: false },
      { defId: MD.scheduleAdherence, order: 4, primary: false },
      { defId: MD.backlogCount, order: 5, primary: false },
    ];

    // Menufy: tickets_resolved, avg_response_time, csat_score, schedule_adherence
    const menufyMetrics = [
      { defId: MD.ticketsResolved, order: 0, primary: true },
      { defId: MD.avgResponseTime, order: 1, primary: true },
      { defId: MD.csatScore, order: 2, primary: true },
      { defId: MD.scheduleAdherence, order: 3, primary: false },
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
        metricDefinitionId: MD.firstContactResolution,
        teamId: TEAM.pos,
        targetType: "minimum",
        targetValue: 70,
        warningValue: 60,
      },
      {
        metricDefinitionId: MD.scheduleAdherence,
        teamId: TEAM.pos,
        targetType: "minimum",
        targetValue: 90,
        warningValue: 85,
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
      {
        metricDefinitionId: MD.scheduleAdherence,
        teamId: TEAM.menufy,
        targetType: "minimum",
        targetValue: 90,
        warningValue: 85,
      },

      // Employee-level override: David Kim (Lead) has higher ticket target
      {
        metricDefinitionId: MD.ticketsResolved,
        employeeId: EMP.davidKim,
        targetType: "minimum",
        targetValue: 55,
        warningValue: 45,
        priority: 1,
      },
    ]);

    // ── Metric Values (8 weeks of history) ─────────────────────

    const WEEKS = 8;

    interface MetricProfile {
      defId: string;
      base: number;
      variance: number;
      trend: number;
    }

    const posProfiles: MetricProfile[] = [
      { defId: MD.ticketsResolved, base: 48, variance: 8, trend: 0.5 },
      { defId: MD.avgHandleTime, base: 11, variance: 3, trend: -0.1 },
      { defId: MD.csatScore, base: 87, variance: 5, trend: 0.3 },
      { defId: MD.firstContactResolution, base: 72, variance: 6, trend: 0.2 },
      { defId: MD.scheduleAdherence, base: 92, variance: 4, trend: 0 },
      { defId: MD.backlogCount, base: 6, variance: 4, trend: 0.1 },
    ];

    const menufyProfiles: MetricProfile[] = [
      { defId: MD.ticketsResolved, base: 38, variance: 6, trend: 0.4 },
      { defId: MD.avgResponseTime, base: 14, variance: 4, trend: -0.2 },
      { defId: MD.csatScore, base: 82, variance: 6, trend: 0.2 },
      { defId: MD.scheduleAdherence, base: 91, variance: 3, trend: 0 },
    ];

    const allValues: Array<{
      metricDefinitionId: string;
      employeeId: string;
      teamId: string;
      periodStart: string;
      periodEnd: string;
      numericValue: number;
      calculationVersion: number;
      qualityStatus: string;
      provenanceJson: object;
    }> = [];

    function generateValues(empList: { id: string }[], teamId: string, profiles: MetricProfile[]) {
      for (let empIdx = 0; empIdx < empList.length; empIdx++) {
        const empId = empList[empIdx]!.id;
        for (const profile of profiles) {
          for (let w = WEEKS - 1; w >= 0; w--) {
            const seed = empIdx * 1000 + profiles.indexOf(profile) * 100 + w;
            const noise = seededValue(seed, -profile.variance, profile.variance);
            const trendAdjust = profile.trend * (WEEKS - 1 - w);
            let value = Math.round((profile.base + noise + trendAdjust + empIdx * 2) * 10) / 10;
            if (
              profile.defId === MD.csatScore ||
              profile.defId === MD.firstContactResolution ||
              profile.defId === MD.scheduleAdherence
            ) {
              value = Math.min(100, Math.max(0, value));
            }
            if (profile.defId === MD.backlogCount || profile.defId === MD.ticketsResolved) {
              value = Math.max(0, Math.round(value));
            }
            if (profile.defId === MD.avgHandleTime || profile.defId === MD.avgResponseTime) {
              value = Math.max(1, Math.round(value * 10) / 10);
            }

            allValues.push({
              metricDefinitionId: profile.defId,
              employeeId: empId,
              teamId,
              periodStart: weekStart(w),
              periodEnd: weekEnd(w),
              numericValue: value,
              calculationVersion: 1,
              qualityStatus: w === 0 && empIdx === 0 ? "partial" : "complete",
              provenanceJson: { source: "synthetic", generatedAt: "2026-08-20" },
            });
          }
        }
      }
    }

    generateValues(posEmployees, TEAM.pos, posProfiles);
    generateValues(menufyEmployees, TEAM.menufy, menufyProfiles);

    // Batch insert values (split into chunks to avoid query size limits)
    const CHUNK_SIZE = 100;
    for (let i = 0; i < allValues.length; i += CHUNK_SIZE) {
      await tx.insert(metricValues).values(allValues.slice(i, i + CHUNK_SIZE));
    }

    // ── Metric Observations (auto-detected from values) ────────

    // Generate a few notable observations for the current week
    const observations = [
      {
        employeeId: EMP.mikeWilliams,
        metricDefinitionId: MD.csatScore,
        periodStart: weekStart(0),
        periodEnd: weekEnd(0),
        observationType: "threshold_crossed_below",
        severity: "attention",
        title: "CSAT Score dropped below target",
        explanation: "CSAT Score fell below the team target of 85%, currently at 78%.",
        currentValue: 78,
        comparisonValue: 88,
        targetValue: 85,
      },
      {
        employeeId: EMP.sarahJohnson,
        metricDefinitionId: MD.ticketsResolved,
        periodStart: weekStart(0),
        periodEnd: weekEnd(0),
        observationType: "improving_trend",
        severity: "info",
        title: "Tickets Resolved trending upward",
        explanation: "Tickets Resolved has been increasing for 3 consecutive weeks.",
        currentValue: 55,
        comparisonValue: 48,
        targetValue: 45,
      },
      {
        employeeId: EMP.emilyBrown,
        metricDefinitionId: MD.avgHandleTime,
        periodStart: weekStart(0),
        periodEnd: weekEnd(0),
        observationType: "significant_change",
        severity: "watch",
        title: "Avg Handle Time increased 18%",
        explanation: "Avg Handle Time increased from 11.2 to 13.2 minutes (18% increase).",
        currentValue: 13.2,
        comparisonValue: 11.2,
        targetValue: 12,
      },
      {
        employeeId: EMP.rachelThompson,
        metricDefinitionId: MD.csatScore,
        periodStart: weekStart(0),
        periodEnd: weekEnd(0),
        observationType: "threshold_crossed_above",
        severity: "info",
        title: "CSAT Score reached target",
        explanation: "CSAT Score improved from 78% to 84%, meeting the team target of 80%.",
        currentValue: 84,
        comparisonValue: 78,
        targetValue: 80,
      },
      {
        employeeId: EMP.kevinObrien,
        metricDefinitionId: MD.avgResponseTime,
        periodStart: weekStart(0),
        periodEnd: weekEnd(0),
        observationType: "declining_trend",
        severity: "watch",
        title: "Avg Response Time trending upward",
        explanation: "Avg Response Time has been increasing for 3 consecutive weeks.",
        currentValue: 19.5,
        comparisonValue: 14.0,
        targetValue: 15,
      },
    ];

    await tx.insert(metricObservations).values(observations);
  });

  console.log("Seed complete.");
  console.log("  Organization: HungerRush");
  console.log("  Teams: POS Support (6 employees), Menufy Support (4 employees)");
  console.log("  Managers: james.smith (POS), maria.garcia (Menufy)");
  console.log("  Metric definitions: 7 (different assignments per team)");
  console.log("  Metric targets: 10 team-level + 1 employee override");
  console.log(`  Metric values: ${(6 * 6 + 4 * 4) * 8} data points (8 weeks x 10 employees)`);
  console.log("  Metric observations: 5 notable events");

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

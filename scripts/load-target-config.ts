/**
 * One-off loader for scorecard-spec-for-claude-code.md's target/visibility
 * data. Real production config, not test fixtures -- deliberately NOT part
 * of src/lib/fixtures/seed.ts.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/load-target-config.ts --admin-email you@hungerrush.com          (dry run)
 *   npx tsx --env-file=.env scripts/load-target-config.ts --admin-email you@hungerrush.com --commit  (apply)
 */
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import {
  teams,
  metricDefinitions,
  metricAssignments,
  metricTargets,
  metricVisibilityOverrides,
} from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getUserIdByEmail } from "@/lib/auth/authorization";

interface SpecTarget {
  type: "range" | "threshold";
  min?: number;
  max?: number;
  unit?: string;
  value?: number;
}
interface SpecLine {
  visible: boolean;
  target: SpecTarget | null;
}
interface SpecMetric {
  metric_key: string;
  label: string;
  section: string;
  direction: "range" | "lower_is_better" | "higher_is_better" | "informational";
  restaurant: SpecLine;
  consumer: SpecLine;
}

// spec metric_key -> existing metric_definitions.key. Keys not listed here
// either need no DB key (informational, no target, always visible -- nothing
// to do) or are net-new (declined_calls, missed_calls, csat_response_rate),
// created directly under their spec key.
const KEY_MAP: Record<string, string> = {
  tickets_solved: "tickets_resolved",
  worked_elevated_tickets: "worked_elevated_tickets",
  avoidable_worked_elevated_tickets: "avoidable_worked_elevated_tickets",
  avg_response_time_ticket: "avg_response_time",
  csat_score: "csat_score",
  ib_calls: "inbound_calls_offered",
  abandoned_on_hold: "inbound_calls_abandoned_on_hold",
  avg_talk_inbound: "avg_talk_time_inbound",
  avg_hold_inbound: "avg_hold_time_inbound",
  avg_duration_inbound: "avg_call_duration_inbound",
  avg_consultation_inbound: "avg_consultation_time_inbound",
  ob_calls: "outbound_calls",
  completed_ob: "outbound_calls_completed",
  non_answered_ob: "outbound_calls_non_answered",
  avg_talk_outbound: "avg_talk_time_outbound",
  avg_hold_outbound: "avg_hold_time_outbound",
};

const NEW_DEFINITIONS: Record<
  string,
  { name: string; category: string; unit: string; valueType: string; direction: string }
> = {
  declined_calls: {
    name: "Declined Calls",
    category: "inbound_call",
    unit: "calls",
    valueType: "count",
    direction: "lower_is_better",
  },
  missed_calls: {
    name: "Missed Calls",
    category: "inbound_call",
    unit: "calls",
    valueType: "count",
    direction: "lower_is_better",
  },
  csat_response_rate: {
    name: "CSAT Response Rate",
    category: "quality",
    unit: "%",
    valueType: "percentage",
    direction: "higher_is_better",
  },
};

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const emailIdx = args.indexOf("--admin-email");
  const adminEmail = emailIdx >= 0 ? args[emailIdx + 1] : undefined;

  if (!adminEmail) {
    console.error("Usage: --admin-email <email> [--commit]");
    process.exit(1);
  }

  const hiddenBy = await getUserIdByEmail(adminEmail);
  if (!hiddenBy) {
    console.error(`No active user found for email: ${adminEmail}`);
    process.exit(1);
  }

  const [menufyTeam] = await db.select().from(teams).where(eq(teams.slug, "menufy-support"));
  if (!menufyTeam) {
    console.error('Could not find team with slug "menufy-support"');
    process.exit(1);
  }

  const configPath = path.join(__dirname, "target-config-2026-09.json");
  const spec: SpecMetric[] = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  const existingDefs = await db
    .select()
    .from(metricDefinitions)
    .where(eq(metricDefinitions.organizationId, menufyTeam.organizationId));
  const defByKey = new Map(existingDefs.map((d) => [d.key, d]));

  console.log(`${commit ? "COMMIT" : "DRY RUN"} — target config load for Menufy Support\n`);

  const unresolved: string[] = [];
  const defsToCreate: string[] = [];
  const targetActions: {
    metricKey: string;
    dbKey: string;
    line: "restaurant" | "consumer";
    action: "insert" | "skip-exists" | "skip-informational" | "skip-no-target";
    payload?: { targetType: string; targetValue: number | null; targetMin: number | null; targetMax: number | null };
  }[] = [];
  const visibilityActions: {
    metricKey: string;
    dbKey: string;
    line: "restaurant" | "consumer";
    action: "insert" | "update" | "no-op-already-visible";
  }[] = [];

  for (const metric of spec) {
    let dbKey = KEY_MAP[metric.metric_key];
    const isNewDef = metric.metric_key in NEW_DEFINITIONS;
    if (isNewDef) dbKey = metric.metric_key;

    if (!dbKey) {
      // tickets_updated / avg_talk_outbound: informational, visible:true both
      // lines, target:null both lines -- nothing to do, not an error.
      continue;
    }

    if (!defByKey.has(dbKey) && !isNewDef) {
      unresolved.push(`${metric.metric_key} -> "${dbKey}" not found in metric_definitions`);
      continue;
    }

    if (isNewDef && !defByKey.has(dbKey)) {
      defsToCreate.push(dbKey);
    }

    for (const line of ["restaurant", "consumer"] as const) {
      const spec_line = metric[line];

      // The "informational" direction always means no pass/fail, even for
      // the one spec row (avg_talk_inbound/restaurant) that has a stray
      // non-null target value -- no exceptions.
      if (metric.direction === "informational") {
        targetActions.push({ metricKey: metric.metric_key, dbKey, line, action: "skip-informational" });
      } else if (!spec_line.target) {
        targetActions.push({ metricKey: metric.metric_key, dbKey, line, action: "skip-no-target" });
      } else {
        const t = spec_line.target;
        targetActions.push({
          metricKey: metric.metric_key,
          dbKey,
          line,
          action: "insert",
          payload:
            t.type === "range"
              ? { targetType: "range", targetValue: null, targetMin: t.min!, targetMax: t.max! }
              : { targetType: "minimum", targetValue: t.value!, targetMin: null, targetMax: null },
        });
      }

      if (!spec_line.visible) {
        visibilityActions.push({ metricKey: metric.metric_key, dbKey, line, action: "insert" });
      }
    }
  }

  if (unresolved.length > 0) {
    console.error("UNRESOLVED metric keys (not loading anything until fixed):");
    for (const u of unresolved) console.error(`  - ${u}`);
    process.exit(1);
  }

  console.log(`New metric_definitions to create: ${defsToCreate.join(", ") || "(none)"}\n`);

  console.log("Targets:");
  for (const a of targetActions) {
    if (a.action === "insert") {
      const p = a.payload!;
      const desc =
        p.targetType === "range"
          ? `range [${p.targetMin}, ${p.targetMax}]`
          : `minimum/ceiling ${p.targetValue}`;
      console.log(`  INSERT  ${a.metricKey} (${a.dbKey}) / ${a.line}: ${desc}`);
    } else {
      console.log(`  skip    ${a.metricKey} (${a.dbKey}) / ${a.line}: ${a.action}`);
    }
  }

  console.log("\nVisibility overrides (global default, hidden=true):");
  for (const a of visibilityActions) {
    console.log(`  ${a.action}  ${a.metricKey} (${a.dbKey}) / ${a.line}`);
  }

  if (!commit) {
    console.log("\nDry run only -- pass --commit to apply.");
    process.exit(0);
  }

  console.log("\nApplying...\n");

  const defIdByKey = new Map(defByKey);
  for (const key of defsToCreate) {
    const meta = NEW_DEFINITIONS[key]!;
    const [created] = await db
      .insert(metricDefinitions)
      .values({
        organizationId: menufyTeam.organizationId,
        key,
        name: meta.name,
        category: meta.category,
        unit: meta.unit,
        valueType: meta.valueType,
        direction: meta.direction,
        calculationType: "sum",
        sourceStrategy: "zendesk",
      })
      .returning();
    defIdByKey.set(key, created!);
    console.log(`Created metric_definitions: ${key}`);

    const [existingAssignment] = await db
      .select()
      .from(metricAssignments)
      .where(
        and(
          eq(metricAssignments.metricDefinitionId, created!.id),
          eq(metricAssignments.teamId, menufyTeam.id)
        )
      );
    if (!existingAssignment) {
      const maxOrder = await db
        .select()
        .from(metricAssignments)
        .where(eq(metricAssignments.teamId, menufyTeam.id));
      const nextOrder = Math.max(0, ...maxOrder.map((m) => m.displayOrder)) + 1;
      await db.insert(metricAssignments).values({
        metricDefinitionId: created!.id,
        teamId: menufyTeam.id,
        displayOrder: nextOrder,
        isPrimary: false,
      });
      console.log(`Created metric_assignments row for ${key} -> Menufy Support`);
    }
  }

  for (const a of targetActions) {
    if (a.action !== "insert") continue;
    const def = defIdByKey.get(a.dbKey);
    if (!def) continue;

    const [existing] = await db
      .select()
      .from(metricTargets)
      .where(
        and(
          eq(metricTargets.metricDefinitionId, def.id),
          eq(metricTargets.teamId, menufyTeam.id),
          eq(metricTargets.line, a.line)
        )
      );
    if (existing) {
      console.log(`Target already exists, skipping: ${a.metricKey} / ${a.line}`);
      continue;
    }

    await db.insert(metricTargets).values({
      metricDefinitionId: def.id,
      teamId: menufyTeam.id,
      line: a.line,
      targetType: a.payload!.targetType,
      targetValue: a.payload!.targetValue,
      targetMin: a.payload!.targetMin,
      targetMax: a.payload!.targetMax,
    });
    console.log(`Inserted target: ${a.metricKey} / ${a.line}`);
  }

  for (const a of visibilityActions) {
    const def = defIdByKey.get(a.dbKey);
    if (!def) continue;

    const [existing] = await db
      .select()
      .from(metricVisibilityOverrides)
      .where(
        and(
          eq(metricVisibilityOverrides.scope, "global_default"),
          isNull(metricVisibilityOverrides.managerUserId),
          isNull(metricVisibilityOverrides.targetEmployeeId),
          eq(metricVisibilityOverrides.metricDefinitionId, def.id),
          eq(metricVisibilityOverrides.teamId, menufyTeam.id),
          eq(metricVisibilityOverrides.line, a.line)
        )
      );

    if (existing) {
      await db
        .update(metricVisibilityOverrides)
        .set({ hidden: true, hiddenBy, hiddenAt: new Date() })
        .where(eq(metricVisibilityOverrides.id, existing.id));
      console.log(`Updated visibility override: ${a.metricKey} / ${a.line}`);
    } else {
      await db.insert(metricVisibilityOverrides).values({
        scope: "global_default",
        managerUserId: null,
        targetEmployeeId: null,
        metricDefinitionId: def.id,
        teamId: menufyTeam.id,
        line: a.line,
        hidden: true,
        hiddenBy,
        hiddenAt: new Date(),
      });
      console.log(`Inserted visibility override: ${a.metricKey} / ${a.line}`);
    }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { db } from "@/lib/db";
import { metricValues, metricDefinitions, metricTargets, employees } from "@/lib/db/schema";
import { eq, and, inArray, lt, ne } from "drizzle-orm";

const MENUFY_TEAM_ID = "20000000-0000-4000-8000-000000000002";
const METRIC_KEYS = ["tickets_resolved", "inbound_calls_offered", "outbound_calls"];
const LINES = ["restaurant", "consumer"] as const;

// Marian Liu (47ce7fc1-6b6c-46f8-9abf-8a41cfb6e424) is 0 on every single metric --
// tickets, calls, and backlog -- for all 3 completed weeks. That's not observed
// variance, it looks like a broken Zendesk identity mapping. Excluded from the
// "clean" pass below so one likely data gap doesn't drag the recommended floor to 0.
const SUSPECTED_DATA_GAP_EMPLOYEE_ID = "47ce7fc1-6b6c-46f8-9abf-8a41cfb6e424";

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stddev(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

function offTargetPct(values: number[], min: number, max: number): number {
  return (values.filter((v) => v < min || v > max).length / values.length) * 100;
}

async function main() {
  const defs = await db
    .select()
    .from(metricDefinitions)
    .where(inArray(metricDefinitions.key, METRIC_KEYS));
  const defByKey = new Map(defs.map((d) => [d.key, d]));
  const defIds = defs.map((d) => d.id);

  const today = new Date().toISOString().split("T")[0]!;
  const weekRows = await db
    .select({ periodStart: metricValues.periodStart, periodEnd: metricValues.periodEnd })
    .from(metricValues)
    .where(
      and(
        eq(metricValues.teamId, MENUFY_TEAM_ID),
        inArray(metricValues.metricDefinitionId, defIds),
        lt(metricValues.periodEnd, today)
      )
    );
  const distinctWeeks = Array.from(new Set(weekRows.map((w) => `${w.periodStart}|${w.periodEnd}`)))
    .sort()
    .reverse()
    .slice(0, 3);
  const weekStarts = distinctWeeks.map((w) => w.split("|")[0]!);
  console.log("Completed weeks used:", distinctWeeks);

  const targets = await db
    .select()
    .from(metricTargets)
    .where(and(eq(metricTargets.teamId, MENUFY_TEAM_ID), inArray(metricTargets.metricDefinitionId, defIds)));

  const header = [
    "metric",
    "line",
    "n",
    "mean",
    "stddev",
    "current_range",
    "current_off%",
    "p10-p90",
    "p10-p90_off%",
    "p15-p85",
    "p15-p85_off%",
  ].join("\t");

  async function runPass(label: string, excludeEmployeeId: string | null) {
    console.log(`\n=== ${label} ===`);
    console.log(header);
    for (const key of METRIC_KEYS) {
      const def = defByKey.get(key);
      if (!def) {
        console.log(`  !! metric key "${key}" not found in metric_definitions`);
        continue;
      }
      for (const line of LINES) {
        const conditions = [
          eq(metricValues.metricDefinitionId, def.id),
          eq(metricValues.teamId, MENUFY_TEAM_ID),
          eq(employees.line, line),
          eq(metricValues.qualityStatus, "complete"),
          inArray(metricValues.periodStart, weekStarts),
        ];
        if (excludeEmployeeId) conditions.push(ne(metricValues.employeeId, excludeEmployeeId));

        const rows = await db
          .select({ value: metricValues.numericValue })
          .from(metricValues)
          .innerJoin(employees, eq(metricValues.employeeId, employees.id))
          .where(and(...conditions));

        const values = rows
          .map((r) => r.value)
          .filter((v): v is number => v !== null)
          .sort((a, b) => a - b);

        if (values.length === 0) {
          console.log(`${def.key}\t${line}\t0\t-\t-\t-\t-\t-\t-\t-\t-`);
          continue;
        }

        const target = targets.find((t) => t.metricDefinitionId === def.id && t.line === line);
        const curMin = target?.targetMin ?? null;
        const curMax = target?.targetMax ?? null;

        const p10 = percentile(values, 10);
        const p15 = percentile(values, 15);
        const p85 = percentile(values, 85);
        const p90 = percentile(values, 90);

        const currentRange = curMin != null && curMax != null ? `[${curMin}, ${curMax}]` : "none";
        const currentOff =
          curMin != null && curMax != null ? offTargetPct(values, curMin, curMax).toFixed(1) : "-";

        console.log(
          [
            def.key,
            line,
            values.length,
            mean(values).toFixed(1),
            stddev(values).toFixed(1),
            currentRange,
            currentOff,
            `[${p10.toFixed(1)}, ${p90.toFixed(1)}]`,
            offTargetPct(values, p10, p90).toFixed(1),
            `[${p15.toFixed(1)}, ${p85.toFixed(1)}]`,
            offTargetPct(values, p15, p85).toFixed(1),
          ].join("\t")
        );
      }
    }
  }

  await runPass("All employees", null);
  await runPass("Excluding Marian Liu (suspected Zendesk identity gap)", SUSPECTED_DATA_GAP_EMPLOYEE_ID);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

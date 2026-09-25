/** Offline diagnostic. Reads a private snapshot, emits aggregate results, never publishes. */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  referenceFirstReply,
  referenceSolvedCsat,
} from "../src/lib/domain/reconciliation/zendesk-reference";

const id = z.number().int().positive().safe();
const snapshotSchema = z.object({
  observedAt: z.string().datetime({ offset: true }),
  population: z.object({
    complete: z.literal(true),
    expectedCount: z.number().int().nonnegative(),
    pages: z.number().int().positive(),
    basis: z.enum(["created-current-assignee", "solved-current-assignee"]),
    satisfactionScope: z.enum(["all", "offered-good-bad"]).default("all"),
  }),
  tickets: z.array(
    z.object({
      id,
      assignee_id: id.nullable(),
      group_id: id.nullable(),
      created_at: z.string().datetime({ offset: true }),
      satisfaction_rating: z.object({ score: z.string() }).nullable().optional(),
    })
  ),
  metrics: z.array(
    z.object({
      ticket_id: id,
      solved_at: z.string().datetime({ offset: true }).nullable(),
      reply_time_in_minutes: z
        .object({
          business: z.number().nonnegative().finite().nullable(),
          calendar: z.number().nonnegative().finite().nullable(),
        })
        .nullable(),
    })
  ),
  cases: z
    .array(
      z.object({
        startDay: z.string(),
        endDay: z.string(),
        timeZone: z.string(),
        assigneeId: id,
        groupIds: z.array(id).nullable(),
        baselineCohortIds: z.array(id).optional(),
      })
    )
    .min(1),
});

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error("Require private input and aggregate output paths");
  const bytes = await readFile(input);
  const snapshot = snapshotSchema.parse(JSON.parse(bytes.toString("utf8")));
  if (snapshot.population.expectedCount !== snapshot.tickets.length)
    throw new Error("Census count mismatch");
  const results = snapshot.cases.map((scope, index) => {
    const result =
      snapshot.population.basis === "created-current-assignee"
        ? referenceFirstReply(snapshot.tickets, snapshot.metrics, scope, "business")
        : referenceSolvedCsat(snapshot.tickets, snapshot.metrics, scope);
    const { cohortIds, ...rest } = result;
    // Only numeric aggregate values leave the private snapshot; no IDs or employee labels.
    const aggregates = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => !Array.isArray(value))
    );
    const baseline = scope.baselineCohortIds ? new Set(scope.baselineCohortIds) : null;
    const selected = new Set(cohortIds);
    return {
      case: index + 1,
      startDay: scope.startDay,
      endDay: scope.endDay,
      timeZone: scope.timeZone,
      cohortCount: cohortIds.length,
      ...aggregates,
      comparison: baseline
        ? {
            baselineCount: baseline.size,
            referenceOnly: cohortIds.filter((id) => !baseline.has(id)).length,
            baselineOnly: [...baseline].filter((id) => !selected.has(id)).length,
          }
        : null,
    };
  });
  const report = {
    observedAt: snapshot.observedAt,
    calculatedAt: new Date().toISOString(),
    inputSha256: createHash("sha256").update(bytes).digest("hex"),
    mode: "offline independent arithmetic; no publication",
    population: snapshot.population,
    limitations: [
      "Source completeness is a supplied census assertion, not certified by this runner.",
      "Current assignment and source observation must match the comparison reference.",
      "A creation census cannot qualify solved-date CSAT; separate population required.",
      "Results do not certify human activity, historical assignment, or manager-report parity.",
    ],
    results,
  };
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ cases: results.length, mode: report.mode }));
}

main().catch(() => {
  // Schema errors can embed private input. Keep terminal failures deliberately generic.
  console.error(
    "Reference calculation failed; check private input shape, coverage and output path."
  );
  process.exitCode = 1;
});

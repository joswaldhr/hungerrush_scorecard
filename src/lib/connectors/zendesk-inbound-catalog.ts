import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { metricAssignments, metricDefinitions } from "@/lib/db/schema";
import { inboundReportKeys } from "./zendesk-inbound-report";
import { loadInboundReportBindings } from "./zendesk-inbound-report-bindings";
import {
  parseInboundReportPolicy,
  type InboundReportPolicy,
} from "./zendesk-inbound-report-record";
import type { ConnectorConfig } from "./types";

const additions = [
  {
    key: "inbound_calls_unreachable",
    name: "Inbound Calls Unreachable",
    unit: "calls",
    valueType: "count",
    calculationType: "sum",
    description: "Unreachable inbound agent legs in the qualified report scope.",
  },
  {
    key: "inbound_calls_answer_rate",
    name: "Inbound Answer Rate",
    unit: "%",
    valueType: "percentage",
    calculationType: "latest",
    description:
      "Accepted agent legs divided by offered agent legs, multiplied by 100. No offers means unavailable.",
  },
  {
    key: "total_talk_time_inbound",
    name: "Total Inbound Talk Time",
    unit: "s",
    valueType: "duration",
    calculationType: "sum",
    description: "Total employee-leg inbound talk seconds; distinct from average talk time.",
  },
  {
    key: "max_hold_time_inbound",
    name: "Maximum Inbound Hold Time",
    unit: "s",
    valueType: "duration",
    calculationType: "max",
    description: "Maximum employee-leg inbound hold seconds; distinct from average hold time.",
  },
] as const;

/** Explicit registration only; no route/scheduler invokes this and it does not enable publication.
 * The release operator must first satisfy recovery, exact-candidate and source qualification gates.
 * Returned IDs are a private rollback inventory, not a certification or permission receipt.
 */
export async function registerInboundReportCatalog(
  input: InboundReportPolicy,
  config: ConnectorConfig,
  subdomain: string,
  now = new Date()
) {
  const policy = parseInboundReportPolicy(input);
  const sorted = (keys: readonly string[]) => JSON.stringify([...keys].sort());
  if (
    !Number.isFinite(now.getTime()) ||
    policy.effectivePeriodStart <= now.toISOString().slice(0, 10) ||
    sorted(policy.metricKeys) !== sorted(inboundReportKeys) ||
    config.organizationId !== policy.organizationId ||
    config.dataSourceId !== policy.dataSourceId
  )
    throw Error("Inbound registration requires a future full-contract cutover and matching owner");

  return db.transaction(async (tx) => {
    await tx.execute(sql`set local lock_timeout = '5s'`);
    // Fence both ordinary catalog edits and concurrent registration, including new rows.
    await tx.execute(
      sql`lock table metric_definitions, metric_assignments in share row exclusive mode`
    );
    await tx.execute(
      sql`lock table data_sources, teams, employees, external_identities in share mode`
    );
    const existing = await tx
      .select({ key: metricDefinitions.key })
      .from(metricDefinitions)
      .where(
        and(
          eq(metricDefinitions.organizationId, config.organizationId),
          inArray(
            metricDefinitions.key,
            additions.map((d) => d.key)
          )
        )
      );
    // Never adopt a pre-existing definition/version or silently repair an interrupted outcome.
    if (existing.length)
      throw Error("Inbound additions already exist; inspect before registration");
    const created = [];
    for (const [index, addition] of additions.entries()) {
      const [definition] = await tx
        .insert(metricDefinitions)
        .values({
          ...addition,
          organizationId: config.organizationId,
          category: "inbound_call",
          sourceStrategy: "zendesk",
          direction: "neutral",
          effectiveFrom: policy.effectivePeriodStart,
        })
        .returning({ id: metricDefinitions.id });
      const [assignment] = await tx
        .insert(metricAssignments)
        .values({
          metricDefinitionId: definition!.id,
          teamId: policy.teamId,
          effectiveFrom: policy.effectivePeriodStart,
          displayOrder: 80 + index,
        })
        .returning({ id: metricAssignments.id });
      created.push({
        key: addition.key,
        definitionId: definition!.id,
        assignmentId: assignment!.id,
      });
    }
    // Validate all nine effective assignments plus source/team ownership and unique employee
    // bindings before commit. A missing/incompatible legacy key rolls back every addition.
    const bindings = await loadInboundReportBindings(
      policy,
      config,
      policy.effectivePeriodStart,
      subdomain,
      tx
    );
    return {
      effectivePeriodStart: policy.effectivePeriodStart,
      activeEmployees: bindings.length,
      created,
    };
  });
}

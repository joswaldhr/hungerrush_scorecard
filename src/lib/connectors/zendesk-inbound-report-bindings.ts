import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  dataSources,
  employees,
  externalIdentities,
  metricAssignments,
  metricDefinitions,
  teams,
} from "@/lib/db/schema";
import { isEffectiveOn } from "@/lib/domain/metrics/effective-dates";
import { assertZendeskAccountBinding } from "./zendesk-account-binding";
import { inboundReportScopeSchema } from "./zendesk-inbound-report";
import {
  parseInboundReportPolicy,
  type InboundReportPolicy,
} from "./zendesk-inbound-report-record";
import type { ConnectorConfig } from "./types";

/** Read-only preflight. Not a publication authorization or historical membership proof. */
export async function loadInboundReportBindings(
  input: InboundReportPolicy,
  config: ConnectorConfig,
  periodStart: string,
  subdomain: string,
  publicationConnection?: typeof db
) {
  const policy = parseInboundReportPolicy(input);
  inboundReportScopeSchema.shape.periodStart.parse(periodStart);
  if (
    new Date(`${periodStart}T00:00:00Z`).getUTCDay() !== 0 ||
    periodStart < policy.effectivePeriodStart ||
    config.organizationId !== policy.organizationId ||
    config.dataSourceId !== policy.dataSourceId
  )
    throw Error("Inbound policy does not own this organization/source/interval");
  assertZendeskAccountBinding(policy.accountReference, subdomain);
  const read = async (tx: typeof db) => {
    const [source] = await tx
      .select()
      .from(dataSources)
      .where(eq(dataSources.id, config.dataSourceId));
    if (
      !source ||
      source.organizationId !== config.organizationId ||
      source.type !== "zendesk" ||
      source.status !== "configured"
    )
      throw Error("Inbound source is unavailable or mismatched");
    assertZendeskAccountBinding(source.configurationReference, subdomain);
    const [team] = await tx
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, policy.teamId), eq(teams.organizationId, config.organizationId)));
    if (!team) throw Error("Inbound team crosses organization boundaries");
    const assignments = await tx
      .select({ assignment: metricAssignments, definition: metricDefinitions })
      .from(metricAssignments)
      .innerJoin(metricDefinitions, eq(metricDefinitions.id, metricAssignments.metricDefinitionId))
      .where(
        and(
          eq(metricAssignments.teamId, policy.teamId),
          eq(metricDefinitions.organizationId, config.organizationId),
          inArray(metricDefinitions.key, policy.metricKeys)
        )
      );
    const effective = assignments.filter(
      (r) => isEffectiveOn(r.assignment, periodStart) && isEffectiveOn(r.definition, periodStart)
    );
    for (const key of policy.metricKeys) {
      const matching = effective.filter((r) => r.definition.key === key);
      if (matching.length !== 1) throw Error("Inbound assignment is missing or ambiguous");
      if (matching[0]!.assignment.employeeId !== null || matching[0]!.assignment.roleKey !== null)
        throw Error("Inbound requires an unambiguous team-wide assignment");
      const def = matching[0]!.definition;
      const rate = key === "inbound_calls_answer_rate";
      const duration = key === "total_talk_time_inbound" || key === "max_hold_time_inbound";
      const aggregation = rate ? "latest" : key === "max_hold_time_inbound" ? "max" : "sum";
      if (
        def.status !== "active" ||
        def.sourceStrategy !== "zendesk" ||
        def.unit !== (rate ? "%" : duration ? "s" : "calls") ||
        def.valueType !== (rate ? "percentage" : duration ? "duration" : "count") ||
        def.calculationType !== aggregation
      )
        throw Error("Inbound assignment uses incompatible source, unit or aggregation");
    }
    const rows = await tx
      .select({
        employeeId: employees.id,
        teamId: employees.primaryTeamId,
        externalId: externalIdentities.externalId,
        entityType: externalIdentities.externalEntityType,
      })
      .from(employees)
      .leftJoin(
        externalIdentities,
        and(
          eq(externalIdentities.employeeId, employees.id),
          eq(externalIdentities.dataSourceId, config.dataSourceId)
        )
      )
      .where(
        and(
          eq(employees.organizationId, config.organizationId),
          eq(employees.primaryTeamId, policy.teamId),
          eq(employees.employmentStatus, "active")
        )
      );
    if (
      !rows.length ||
      rows.some(
        (r) =>
          !r.externalId ||
          r.externalId.trim() !== r.externalId ||
          !r.externalId.trim() ||
          r.externalId.length > 320 ||
          // Roster discovery stores Zendesk staff as "agent"; manually verified
          // user bindings are also supported. Neither label establishes human activity.
          (r.entityType !== "user" && r.entityType !== "agent")
      ) ||
      new Set(rows.map((r) => r.employeeId)).size !== rows.length ||
      new Set(rows.map((r) => r.externalId!.toLowerCase())).size !== rows.length
    )
      throw Error("Inbound active employees lack unique source identity bindings");
    return rows.map((r) => ({
      employeeId: r.employeeId,
      teamId: policy.teamId,
      externalId: r.externalId!,
    }));
  };
  return publicationConnection
    ? read(publicationConnection)
    : db.transaction(read, { isolationLevel: "repeatable read", accessMode: "read only" });
}

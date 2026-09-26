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
import { env } from "@/lib/env";
import { isEffectiveOn } from "@/lib/domain/metrics/effective-dates";
import { weekDates } from "@/lib/utils";
import { ZendeskConnector, MAX_WEEKS_BACK } from "./zendesk";
import { assertZendeskAccountBinding } from "./zendesk-account-binding";
import { createBoundedCsatReader } from "./zendesk-csat-reader";
import { readTalkCollectionSnapshot } from "./zendesk-talk-store";
import { talkPolicyForPeriod, type ZendeskTalkPolicy } from "./zendesk-talk-policy";
import { collectOutboundRecords } from "./zendesk-outbound-collection";
import type { ConnectorConfig } from "./types";

/** Validate source, team, assignment semantics and current identity ownership before any GET. */
export async function loadOutboundEmployeeBindings(
  policy: ZendeskTalkPolicy,
  config: ConnectorConfig,
  periodStart: string,
  subdomain: string
) {
  if (!talkPolicyForPeriod(policy, config, periodStart))
    throw Error("Outbound policy does not own this interval");
  const [source] = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.id, config.dataSourceId));
  if (
    !source ||
    source.organizationId !== config.organizationId ||
    source.type !== "zendesk" ||
    source.status !== "configured"
  )
    throw Error("Outbound source is unavailable or mismatched");
  assertZendeskAccountBinding(source.configurationReference, subdomain);
  assertZendeskAccountBinding(policy.accountReference, subdomain);
  const selectedTeams = policy.teams.filter((t) => t.outbound !== null);
  const teamIds = selectedTeams.map((t) => t.teamId);
  if (!teamIds.length) throw Error("No outbound team policy configured");
  const boundTeams = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.organizationId, config.organizationId), inArray(teams.id, teamIds)));
  if (boundTeams.length !== teamIds.length)
    throw Error("Outbound team policy crosses organization boundaries");
  const selectedKeys = [...new Set(selectedTeams.flatMap((t) => t.outbound!.metricKeys))];
  const assignments = await db
    .select({ assignment: metricAssignments, definition: metricDefinitions })
    .from(metricAssignments)
    .innerJoin(metricDefinitions, eq(metricAssignments.metricDefinitionId, metricDefinitions.id))
    .where(
      and(
        eq(metricDefinitions.organizationId, config.organizationId),
        inArray(metricAssignments.teamId, teamIds),
        inArray(metricDefinitions.key, selectedKeys)
      )
    );
  const effective = assignments.filter(
    (r) => isEffectiveOn(r.assignment, periodStart) && isEffectiveOn(r.definition, periodStart)
  );
  for (const team of selectedTeams)
    for (const key of team.outbound!.metricKeys) {
      const matching = effective.filter(
        (r) => r.assignment.teamId === team.teamId && r.definition.key === key
      );
      if (matching.length !== 1) throw Error("Outbound assignment is missing or ambiguous");
      const def = matching[0]!.definition,
        duration = key.startsWith("avg_");
      if (
        def.sourceStrategy !== "zendesk" ||
        def.unit !== (duration ? "s" : "calls") ||
        def.valueType !== (duration ? "duration" : "count") ||
        def.calculationType !== (duration ? "average" : "sum")
      )
        throw Error("Outbound assignment uses incompatible source, unit or aggregation");
    }
  const rows = await db
    .select({
      employeeId: employees.id,
      teamId: employees.primaryTeamId,
      externalId: externalIdentities.externalId,
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
        eq(employees.employmentStatus, "active"),
        inArray(employees.primaryTeamId, teamIds)
      )
    );
  if (
    !rows.length ||
    rows.some((r) => !r.teamId || !r.externalId) ||
    new Set(rows.map((r) => r.employeeId)).size !== rows.length
  )
    throw Error("Outbound active employees lack unique source identity/team bindings");
  return rows.map((r) => ({
    employeeId: r.employeeId,
    teamId: r.teamId!,
    externalId: r.externalId!,
  }));
}

/** Inactive one-week source connector. No route or configured environment invokes it yet. */
export function createOutboundConnector(policy: ZendeskTalkPolicy) {
  const connector = new ZendeskConnector();
  connector.fetchRecords = async (config, ctx) => {
    if (ctx.cursor === null || !/^\d+$/.test(ctx.cursor) || Number(ctx.cursor) >= MAX_WEEKS_BACK)
      throw Error("Outbound sync requires one valid week offset");
    const { periodStart, periodEnd } = weekDates(Number(ctx.cursor));
    const bindings = await loadOutboundEmployeeBindings(
      policy,
      config,
      periodStart,
      env.ZENDESK_SUBDOMAIN ?? ""
    );
    const stored = await readTalkCollectionSnapshot({
      ...config,
      accountReference: policy.accountReference,
    });
    if (stored.status !== "ready_for_qualification" || stored.snapshot === null)
      throw Error("Outbound source streams are still collecting");
    const reader = createBoundedCsatReader({
      subdomain: env.ZENDESK_SUBDOMAIN ?? "",
      email: env.ZENDESK_EMAIL ?? "",
      apiKey: env.ZENDESK_API_KEY ?? "",
    });
    const result = await collectOutboundRecords(
      stored.snapshot,
      policy,
      config,
      periodStart,
      periodEnd,
      bindings,
      reader.read
    );
    return {
      records: result.records,
      cursor: null,
      hasMore: false,
      diagnostics: { ...result.diagnostics, ...reader.stats() },
    };
  };
  return connector;
}

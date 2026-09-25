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
import {
  firstReplyPolicyForPeriod,
  type ZendeskFirstReplyPolicy,
} from "./zendesk-first-reply-policy";
import { collectFirstReplyRecords } from "./zendesk-first-reply-collection";
import { createBoundedCsatReader } from "./zendesk-csat-reader";
import type { ConnectorConfig } from "./types";

/** Validate assignment and source ownership before any vendor request. */
export async function loadFirstReplyEmployeeBindings(
  policy: ZendeskFirstReplyPolicy,
  config: ConnectorConfig,
  periodStart: string
) {
  if (!firstReplyPolicyForPeriod(policy, config, periodStart))
    throw new Error("First-reply policy does not own this source interval");
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
    throw new Error("First-reply data source is unavailable or mismatched");
  const subdomain = env.ZENDESK_SUBDOMAIN ?? "";
  assertZendeskAccountBinding(source.configurationReference, subdomain);
  assertZendeskAccountBinding(policy.accountReference, subdomain);
  const teamIds = policy.teams.map((t) => t.teamId);
  const boundTeams = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.organizationId, config.organizationId), inArray(teams.id, teamIds)));
  if (boundTeams.length !== teamIds.length)
    throw new Error(
      "First-reply team policy crosses organization boundaries or contains missing teams"
    );
  const assignments = await db
    .select({ assignment: metricAssignments, definition: metricDefinitions })
    .from(metricAssignments)
    .innerJoin(metricDefinitions, eq(metricAssignments.metricDefinitionId, metricDefinitions.id))
    .where(
      and(
        eq(metricDefinitions.organizationId, config.organizationId),
        eq(metricDefinitions.sourceStrategy, "zendesk"),
        inArray(metricDefinitions.key, ["avg_response_time"])
      )
    );
  const effective = assignments.filter(
    (r) => isEffectiveOn(r.assignment, periodStart) && isEffectiveOn(r.definition, periodStart)
  );
  for (const row of effective) {
    if (
      row.definition.unit !== "min" ||
      row.definition.valueType !== "duration" ||
      row.definition.calculationType !== "average"
    )
      throw new Error("First-reply definition must use an average business-minute duration");
    const team = policy.teams.find((t) => t.teamId === row.assignment.teamId);
    if (!team || !team.metricKeys.includes(row.definition.key as "avg_response_time"))
      throw new Error("First-reply metric assignment has no matching team policy");
  }
  for (const team of policy.teams)
    for (const key of team.metricKeys)
      if (
        effective.filter((r) => r.assignment.teamId === team.teamId && r.definition.key === key)
          .length !== 1
      )
        throw new Error("First-reply team metric assignment is missing or ambiguous");
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
  if (rows.some((r) => !r.teamId || !r.externalId))
    throw new Error("First-reply active employee lacks a source identity or team binding");
  return rows.map((r) => ({
    employeeId: r.employeeId,
    teamId: r.teamId!,
    externalId: r.externalId!,
  }));
}

/** Dedicated one-week connector; retains the same source lease, normalizer and atomic publisher. */
export function createFirstReplyConnector(policy: ZendeskFirstReplyPolicy) {
  const connector = new ZendeskConnector();
  connector.fetchRecords = async (config, ctx) => {
    if (ctx.cursor === null || !/^\d+$/.test(ctx.cursor))
      throw new Error("First-reply sync requires one explicit week offset");
    const offset = Number(ctx.cursor);
    if (!Number.isInteger(offset) || offset < 0 || offset >= MAX_WEEKS_BACK)
      throw new Error("Invalid First-reply week offset");
    const { periodStart, periodEnd } = weekDates(offset);
    const bindings = await loadFirstReplyEmployeeBindings(policy, config, periodStart);
    const reader = createBoundedCsatReader({
      subdomain: env.ZENDESK_SUBDOMAIN ?? "",
      email: env.ZENDESK_EMAIL ?? "",
      apiKey: env.ZENDESK_API_KEY ?? "",
    });
    const result = await collectFirstReplyRecords(
      policy,
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

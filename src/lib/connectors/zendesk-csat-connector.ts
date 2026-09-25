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
import { csatPolicyForPeriod, type ZendeskCsatPolicy } from "./zendesk-csat-policy";
import { collectCsatRecords } from "./zendesk-csat-collection";
import { createBoundedCsatReader } from "./zendesk-csat-reader";
import type { ConnectorConfig } from "./types";

/** Validate assignment and source ownership before any vendor request. */
export async function loadCsatEmployeeBindings(
  policy: ZendeskCsatPolicy,
  config: ConnectorConfig,
  periodStart: string
) {
  if (!csatPolicyForPeriod(policy, config, periodStart))
    throw new Error("CSAT policy does not own this source interval");
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
    throw new Error("CSAT data source is unavailable or mismatched");
  const subdomain = env.ZENDESK_SUBDOMAIN ?? "";
  assertZendeskAccountBinding(source.configurationReference, subdomain);
  assertZendeskAccountBinding(policy.accountReference, subdomain);
  const teamIds = policy.teams.map((t) => t.teamId);
  const boundTeams = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.organizationId, config.organizationId), inArray(teams.id, teamIds)));
  if (boundTeams.length !== teamIds.length)
    throw new Error("CSAT team policy crosses organization boundaries or contains missing teams");
  const assignments = await db
    .select({ assignment: metricAssignments, definition: metricDefinitions })
    .from(metricAssignments)
    .innerJoin(metricDefinitions, eq(metricAssignments.metricDefinitionId, metricDefinitions.id))
    .where(
      and(
        eq(metricDefinitions.organizationId, config.organizationId),
        eq(metricDefinitions.sourceStrategy, "zendesk"),
        inArray(metricDefinitions.key, ["csat_score", "csat_response_rate"])
      )
    );
  const effective = assignments.filter(
    (r) => isEffectiveOn(r.assignment, periodStart) && isEffectiveOn(r.definition, periodStart)
  );
  for (const row of effective) {
    const team = policy.teams.find((t) => t.teamId === row.assignment.teamId);
    if (
      !team ||
      !team.metricKeys.includes(row.definition.key as "csat_score" | "csat_response_rate")
    )
      throw new Error("CSAT metric assignment has no matching team policy");
  }
  for (const team of policy.teams)
    for (const key of team.metricKeys)
      if (
        effective.filter((r) => r.assignment.teamId === team.teamId && r.definition.key === key)
          .length !== 1
      )
        throw new Error("CSAT team metric assignment is missing or ambiguous");
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
    throw new Error("CSAT active employee lacks a source identity or team binding");
  return rows.map((r) => ({
    employeeId: r.employeeId,
    teamId: r.teamId!,
    externalId: r.externalId!,
  }));
}

/** Dedicated one-week connector; retains the same source lease, normalizer and atomic publisher. */
export function createCsatConnector(policy: ZendeskCsatPolicy) {
  const connector = new ZendeskConnector();
  connector.fetchRecords = async (config, ctx) => {
    if (ctx.cursor === null || !/^\d+$/.test(ctx.cursor))
      throw new Error("CSAT sync requires one explicit week offset");
    const offset = Number(ctx.cursor);
    if (!Number.isInteger(offset) || offset < 0 || offset >= MAX_WEEKS_BACK)
      throw new Error("Invalid CSAT week offset");
    const { periodStart, periodEnd } = weekDates(offset);
    const bindings = await loadCsatEmployeeBindings(policy, config, periodStart);
    const reader = createBoundedCsatReader({
      subdomain: env.ZENDESK_SUBDOMAIN ?? "",
      email: env.ZENDESK_EMAIL ?? "",
      apiKey: env.ZENDESK_API_KEY ?? "",
    });
    const result = await collectCsatRecords(policy, periodStart, periodEnd, bindings, reader.read);
    return {
      records: result.records,
      cursor: null,
      hasMore: false,
      diagnostics: { ...result.diagnostics, ...reader.stats() },
    };
  };
  return connector;
}

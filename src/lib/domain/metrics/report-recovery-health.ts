import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { dataSources, sourceRecords, teams } from "@/lib/db/schema";
import { env } from "@/lib/env";
import {
  configuredReportEventCollectionPolicy,
  configuredSolvedReportReleases,
} from "@/lib/connectors/zendesk-solved-config";
import { planReportRecovery } from "@/lib/connectors/zendesk-report-recovery";
import { REPORT_JOB_RECORD } from "@/lib/connectors/zendesk-report-jobs";
import { reportJobHealth, type ReportJobHealth } from "@/lib/connectors/report-job-health";

export type RecoveryHealth = {
  state: "enabled" | "disabled" | "unavailable" | "not_configured";
  rows: Array<
    ReportJobHealth & {
      key: string;
      team: string;
      metric: string;
      periodStart: string | null;
      periodEnd: string | null;
    }
  >;
};

/** Read-only and organization/team scoped; never enqueues, claims, or contacts Zendesk. */
export async function getReportRecoveryHealth(
  organizationId: string,
  assignedTeamIds: string[],
  now = new Date()
): Promise<RecoveryHealth> {
  try {
    const collection = configuredReportEventCollectionPolicy();
    const releases = configuredSolvedReportReleases();
    if (!collection || collection.scope.organizationId !== organizationId || !releases.length)
      return { state: "not_configured", rows: [] };
    const [source] = await db
      .select({ id: dataSources.id })
      .from(dataSources)
      .where(
        and(
          eq(dataSources.id, collection.scope.dataSourceId),
          eq(dataSources.organizationId, organizationId),
          eq(dataSources.type, "zendesk"),
          eq(dataSources.status, "configured"),
          eq(dataSources.configurationReference, collection.scope.accountReference)
        )
      );
    if (!source) return { state: "unavailable", rows: [] };
    // Never expand a direct employee assignment into whole-team operational access.
    if (!assignedTeamIds.length) return { state: "not_configured", rows: [] };
    const allowedTeams = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(and(eq(teams.organizationId, organizationId), inArray(teams.id, assignedTeamIds)));
    const visible = releases.filter((r) => allowedTeams.some((t) => t.id === r.teamId));
    if (!visible.length) return { state: "not_configured", rows: [] };
    const plan = planReportRecovery(collection, visible, now);
    const records = await db
      .select({ payload: sourceRecords.payloadJson })
      .from(sourceRecords)
      .where(
        and(
          eq(sourceRecords.dataSourceId, source.id),
          eq(sourceRecords.externalRecordType, REPORT_JOB_RECORD),
          or(
            ...plan.requests.map(
              ({ definition }) =>
                sql`${sourceRecords.payloadJson}->'definition' = ${JSON.stringify(definition)}::jsonb`
            )
          )
        )
      )
      .limit(100);
    const rows = plan.requests.map((request) => {
      const d = request.definition;
      const matches = records.filter(({ payload }) => {
        const p = payload as {
          definition?: {
            kind?: string;
            policyHash?: string;
            periodStart?: string;
            periodEnd?: string;
          };
        } | null;
        return (
          p?.definition?.kind === d.kind &&
          p.definition.policyHash === d.policyHash &&
          (d.kind === "collection" ||
            (p.definition.periodStart === d.periodStart && p.definition.periodEnd === d.periodEnd))
        );
      });
      const policy = plan.publicationPolicies.find((p) => p.policyHash === d.policyHash)?.release;
      return {
        key: `${d.policyHash}:${d.kind === "collection" ? "collection" : d.periodStart}`,
        team: policy
          ? allowedTeams.find((t) => t.id === policy.teamId)!.name
          : "Shared source collection",
        metric:
          d.kind === "collection"
            ? "Ticket events"
            : d.kind === "updater"
              ? "Tickets solved (Zendesk credit)"
              : "Tickets solved (assigned)",
        periodStart: d.kind === "collection" ? null : d.periodStart,
        periodEnd: d.kind === "collection" ? null : d.periodEnd,
        ...reportJobHealth(
          request,
          records.length === 100 || matches.length > 1 ? null : matches[0]?.payload,
          collection.scope.accountReference,
          now.getTime()
        ),
      };
    });
    return { state: env.ZENDESK_REPORT_RECOVERY === "1" ? "enabled" : "disabled", rows };
  } catch {
    // Configuration/driver errors can contain credentials or SQL parameters. Never render them.
    return { state: "unavailable", rows: [] };
  }
}

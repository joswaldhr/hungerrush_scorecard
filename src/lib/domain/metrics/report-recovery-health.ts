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

import { configuredQualifiedRecovery } from "@/lib/connectors/zendesk-qualified-recovery";
import { configuredLegacySyncRecovery } from "@/lib/connectors/zendesk-legacy-sync-recovery";
import type { ZendeskCsatPolicy } from "@/lib/connectors/zendesk-csat-policy";
import type { ZendeskFirstReplyPolicy } from "@/lib/connectors/zendesk-first-reply-policy";

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
    const csat = configuredQualifiedRecovery("csat")?.policy as ZendeskCsatPolicy | undefined;
    const firstReply = configuredQualifiedRecovery("first-reply")?.policy as
      ZendeskFirstReplyPolicy | undefined;
    const plan = planReportRecovery(
      collection,
      releases,
      now,
      csat,
      configuredLegacySyncRecovery(),
      firstReply
    );
    const authorizedNames = (ids: string[]) =>
      allowedTeams.filter((t) => ids.includes(t.id)).map((t) => t.name);
    const visibleSolved = releases.some((r) => authorizedNames([r.teamId]).length);
    const namesFor = (kind: string, hash: string) => {
      if (kind === "csat") return authorizedNames(csat?.teams.map((t) => t.teamId) ?? []);
      if (kind === "first-reply")
        return authorizedNames(firstReply?.teams.map((t) => t.teamId) ?? []);
      const policy = plan.publicationPolicies.find((p) => p.policyHash === hash)?.release;
      return policy ? authorizedNames([policy.teamId]) : [];
    };
    const hasVisiblePolicy =
      visibleSolved ||
      authorizedNames(csat?.teams.map((t) => t.teamId) ?? []).length ||
      authorizedNames(firstReply?.teams.map((t) => t.teamId) ?? []).length;
    if (!hasVisiblePolicy) return { state: "not_configured", rows: [] };
    const visibleRequests = plan.requests.filter(
      ({ definition: d }) =>
        d.kind === "collection" ||
        (d.kind === "legacy-sync" ? visibleSolved : namesFor(d.kind, d.policyHash).length > 0)
    );
    const records = await db
      .select({ payload: sourceRecords.payloadJson })
      .from(sourceRecords)
      .where(
        and(
          eq(sourceRecords.dataSourceId, source.id),
          eq(sourceRecords.externalRecordType, REPORT_JOB_RECORD),
          or(
            ...visibleRequests.map(
              ({ definition }) =>
                sql`${sourceRecords.payloadJson}->'definition' = ${JSON.stringify(definition)}::jsonb`
            )
          )
        )
      )
      .limit(100);
    const rows = visibleRequests.map((request) => {
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
          (!("periodStart" in d) ||
            (p.definition.periodStart === d.periodStart && p.definition.periodEnd === d.periodEnd))
        );
      });
      return {
        key: `${d.policyHash}:${"periodStart" in d ? d.periodStart : d.kind}`,
        team:
          d.kind === "collection"
            ? "Shared source collection"
            : d.kind === "legacy-sync"
              ? "Shared source import"
              : namesFor(d.kind, d.policyHash).join(", "),
        metric:
          d.kind === "collection"
            ? "Ticket events"
            : d.kind === "updater"
              ? "Tickets solved (Zendesk credit)"
              : d.kind === "assignee-solved"
                ? "Tickets solved (assigned)"
                : d.kind === "csat"
                  ? "CSAT (shared import)"
                  : d.kind === "first-reply"
                    ? "First reply (shared import)"
                    : "Legacy metrics (shared import)",
        periodStart: "periodStart" in d ? d.periodStart : null,
        periodEnd: "periodEnd" in d ? d.periodEnd : null,
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

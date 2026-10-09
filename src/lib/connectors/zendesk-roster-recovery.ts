import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { dataSources, sourceRecords } from "@/lib/db/schema";
import { env } from "@/lib/env";
import {
  configuredReportEventCollectionPolicy,
  configuredSolvedReportReleases,
} from "./zendesk-solved-config";
import type { ReportEventScope } from "./zendesk-report-event-store";
import { REPORT_JOB_RECORD, type ReportJobDefinition } from "./zendesk-report-jobs";
import { reportJobHealth } from "./report-job-health";

/** Explicit opt-in; never moves daily work to an inactive or differently scoped dispatcher. */
export function configuredRosterRecovery(): ReportEventScope | undefined {
  if (env.ROSTER_DISCOVERY_RECOVERY !== "1") return undefined;
  const collection = configuredReportEventCollectionPolicy();
  const releases = configuredSolvedReportReleases();
  if (
    env.ZENDESK_REPORT_RECOVERY !== "1" ||
    !collection ||
    !releases.length ||
    env.ROSTER_DISCOVERY_SOURCE_ID !== collection.scope.dataSourceId ||
    releases.some(
      (p) =>
        p.organizationId !== collection.scope.organizationId ||
        p.dataSourceId !== collection.scope.dataSourceId ||
        p.accountReference !== collection.scope.accountReference
    )
  )
    throw Error("Roster recovery requires an active source-bound dispatcher");
  return collection.scope;
}

/** Latest daily observation demand, not a historical roster reconstruction. */
export function planRosterRecovery(scope: ReportEventScope, now = new Date()) {
  const desired = new Date(now);
  desired.setUTCHours(16, 10, 0, 0);
  if (desired > now) desired.setUTCDate(desired.getUTCDate() - 1);
  const policyHash = createHash("sha256")
    .update(
      JSON.stringify({
        kind: "roster-review-only-v1",
        organizationId: scope.organizationId,
        dataSourceId: scope.dataSourceId,
        accountReference: scope.accountReference,
      })
    )
    .digest("hex");
  const requests: Array<{ definition: ReportJobDefinition; desiredAt: string }> = [
    { definition: { kind: "roster", policyHash }, desiredAt: desired.toISOString() },
  ];
  return { scope, policyHash, requests };
}

/** Cron-authenticated operational health only; no candidates or employee details. */
export async function getRosterRecoveryHealth(now = new Date()) {
  const scope = configuredRosterRecovery();
  if (!scope) return { enabled: false };
  const [source] = await db
    .select({ id: dataSources.id })
    .from(dataSources)
    .where(
      and(
        eq(dataSources.id, scope.dataSourceId),
        eq(dataSources.organizationId, scope.organizationId),
        eq(dataSources.type, "zendesk"),
        eq(dataSources.status, "configured"),
        eq(dataSources.configurationReference, scope.accountReference)
      )
    );
  if (!source) throw Error("Roster recovery source binding changed");
  const request = planRosterRecovery(scope, now).requests[0]!;
  const records = await db
    .select({ payload: sourceRecords.payloadJson })
    .from(sourceRecords)
    .where(
      and(
        eq(sourceRecords.dataSourceId, scope.dataSourceId),
        eq(sourceRecords.externalRecordType, REPORT_JOB_RECORD),
        sql`${sourceRecords.payloadJson}->'definition' = ${JSON.stringify(request.definition)}::jsonb`
      )
    )
    .limit(2);
  return {
    enabled: true,
    desiredAt: request.desiredAt,
    ...reportJobHealth(
      request,
      records.length > 1 ? null : records[0]?.payload,
      scope.accountReference,
      now.getTime()
    ),
  };
}

import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { shiftWeekStart, weekBoundsForDate } from "@/lib/utils";
import {
  configuredReportEventCollectionPolicy,
  configuredSolvedReportReleases,
} from "./zendesk-solved-config";
import type { ReportEventScope } from "./zendesk-report-event-store";
import type { ReportJobDefinition } from "./zendesk-report-jobs";

/** Separate opt-in: daily legacy work may move only to an active, source-bound worker. */
export function configuredLegacySyncRecovery(): ReportEventScope | undefined {
  if (env.ZENDESK_LEGACY_SYNC_RECOVERY !== "1") return undefined;
  const collection = configuredReportEventCollectionPolicy();
  if (
    env.ZENDESK_REPORT_RECOVERY !== "1" ||
    !collection ||
    env.ROSTER_DISCOVERY_SOURCE_ID !== collection.scope.dataSourceId ||
    !configuredSolvedReportReleases().length
  )
    throw Error("Legacy sync recovery requires an active dispatcher and separate roster discovery");
  if (env.ZENDESK_LEGACY_TALK_RESUME !== "1")
    throw Error("Legacy sync recovery requires separately enabled resumable Talk collection");
  return collection.scope;
}

/** Preserve the daily 06:00 UTC demand and its four original Sunday–Saturday selections. */
export function planLegacySyncRecovery(scope: ReportEventScope, now = new Date()) {
  const desired = new Date(now);
  desired.setUTCHours(6, 0, 0, 0);
  if (desired > now) desired.setUTCDate(desired.getUTCDate() - 1);
  const current = weekBoundsForDate(desired.toISOString().slice(0, 10)).periodStart;
  const policyHash = createHash("sha256")
    .update(
      JSON.stringify({
        kind: "legacy-sync-v1",
        organizationId: scope.organizationId,
        dataSourceId: scope.dataSourceId,
        accountReference: scope.accountReference,
      })
    )
    .digest("hex");
  const requests: Array<{ definition: ReportJobDefinition; desiredAt: string }> = [];
  for (let offset = 0; offset < 4; offset++)
    requests.push({
      definition: {
        kind: "legacy-sync",
        policyHash,
        ...weekBoundsForDate(shiftWeekStart(current, -offset)),
      },
      desiredAt: desired.toISOString(),
    });
  return { scope, policyHash, requests };
}

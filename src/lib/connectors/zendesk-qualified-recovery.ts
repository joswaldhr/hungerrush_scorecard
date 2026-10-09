import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { shiftWeekStart, weekBoundsForDate } from "@/lib/utils";
import { configuredCsatPolicy } from "./zendesk-csat-config";
import { configuredFirstReplyPolicy } from "./zendesk-first-reply-config";
import {
  configuredReportEventCollectionPolicy,
  configuredSolvedReportReleases,
} from "./zendesk-solved-config";
import type { ZendeskCsatPolicy } from "./zendesk-csat-policy";
import type { ZendeskFirstReplyPolicy } from "./zendesk-first-reply-policy";
import type { ReportJobDefinition } from "./zendesk-report-jobs";

export function configuredQualifiedRecovery(kind: "csat" | "first-reply") {
  if ((kind === "csat" ? env.ZENDESK_CSAT_RECOVERY : env.ZENDESK_FIRST_REPLY_RECOVERY) !== "1")
    return undefined;
  const collection = configuredReportEventCollectionPolicy();
  const policy = kind === "csat" ? configuredCsatPolicy() : configuredFirstReplyPolicy();
  const releases = configuredSolvedReportReleases();
  if (
    env.ZENDESK_REPORT_RECOVERY !== "1" ||
    !collection ||
    !policy ||
    !releases.length ||
    [policy, ...releases].some(
      (p) =>
        p.organizationId !== collection.scope.organizationId ||
        p.dataSourceId !== collection.scope.dataSourceId ||
        p.accountReference !== collection.scope.accountReference
    )
  )
    throw Error("Qualified recovery requires an active source-bound dispatcher and policy");
  return { scope: collection.scope, policy };
}

/** Preserve each original daily slot and its dates, including Sunday before later slots run. */
export function planQualifiedRecovery<T extends ZendeskCsatPolicy | ZendeskFirstReplyPolicy>(
  kind: "csat" | "first-reply",
  release: T,
  now = new Date()
) {
  const policyHash = createHash("sha256")
    .update(JSON.stringify({ kind, ...release }))
    .digest("hex");
  const requests: Array<{ definition: ReportJobDefinition; desiredAt: string }> = [];
  for (let offset = 0; offset < 4; offset++) {
    const desired = new Date(now);
    desired.setUTCHours((kind === "csat" ? 8 : 16) + offset * 2, 0, 0, 0);
    if (desired > now) desired.setUTCDate(desired.getUTCDate() - 1);
    const current = weekBoundsForDate(desired.toISOString().slice(0, 10)).periodStart;
    const periodStart = shiftWeekStart(current, -offset);
    if (periodStart < release.effectivePeriodStart) continue;
    requests.push({
      definition: { kind, policyHash, ...weekBoundsForDate(periodStart) },
      desiredAt: desired.toISOString(),
    });
  }
  return { release, policyHash, requests };
}

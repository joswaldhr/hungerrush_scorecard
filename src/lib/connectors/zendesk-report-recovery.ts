import { createHash } from "node:crypto";
import { shiftWeekStart, weekBoundsForDate } from "@/lib/utils";
import { isSyncRateLimited } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { parseSolvedRelease, type SolvedRelease } from "./zendesk-solved-publication-record";
import type { parseReportEventCollectionPolicy } from "./zendesk-solved-config";
import {
  claimReportJob,
  finishReportJob,
  requestReportJobs,
  type ClaimedReportJob,
  type ReportJobDefinition,
  type ReportJobOutcome,
} from "./zendesk-report-jobs";
import { createReportEventReader, runReportEventBatch } from "./zendesk-report-event-worker";
import { createLiveUpdaterSolvedPublisher } from "./zendesk-updater-solved-publisher";
import { createLiveAssigneeSolvedPublisher } from "./zendesk-assignee-solved-publisher";
import { runSync } from "./sync-engine";
import { createCsatConnector } from "./zendesk-csat-connector";
import { parseZendeskCsatPolicy, type ZendeskCsatPolicy } from "./zendesk-csat-policy";
import { planLegacySyncRecovery } from "./zendesk-legacy-sync-recovery";
import type { ReportEventScope } from "./zendesk-report-event-store";
import { ZendeskConnector } from "./zendesk";
import { pingSyncHeartbeat } from "./sync-heartbeat";

type Collection = NonNullable<ReturnType<typeof parseReportEventCollectionPolicy>>;
const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function planReportRecovery(
  collection: Collection,
  input: SolvedRelease[],
  now = new Date(),
  csatInput?: ZendeskCsatPolicy,
  legacyInput?: ReportEventScope
) {
  if (!input.length || input.length > 2)
    throw Error("Report recovery requires qualified solved policies");
  const releases = input.map(parseSolvedRelease);
  if (
    new Set(releases.map((r) => r.kind)).size !== releases.length ||
    releases.some(
      (r) =>
        r.organizationId !== collection.scope.organizationId ||
        r.dataSourceId !== collection.scope.dataSourceId ||
        r.accountReference !== collection.scope.accountReference
    )
  )
    throw Error("Report recovery policies must share one configured source/account");
  const csat = csatInput
    ? parseZendeskCsatPolicy(
        JSON.stringify(csatInput),
        collection.scope.accountReference.replace(/^zendesk-account:/, "")
      )
    : null;
  if (
    csat &&
    (csat.dataSourceId !== collection.scope.dataSourceId ||
      csat.organizationId !== collection.scope.organizationId)
  )
    throw Error("CSAT recovery must share the configured source/account");
  const csatPolicy = csat ? { release: csat, policyHash: digest({ kind: "csat", ...csat }) } : null;
  if (
    legacyInput &&
    (legacyInput.organizationId !== collection.scope.organizationId ||
      legacyInput.dataSourceId !== collection.scope.dataSourceId ||
      legacyInput.accountReference !== collection.scope.accountReference)
  )
    throw Error("Legacy recovery must share the configured source/account");
  const legacyPolicy = legacyInput ? planLegacySyncRecovery(legacyInput, now) : null;
  const daily = new Date(now);
  daily.setUTCHours(0, 0, 0, 0);
  const sixHourly = new Date(Math.floor(now.getTime() / 21600000) * 21600000);
  const collectionHash = digest({ kind: "collection", ...collection });
  const requests: Array<{ definition: ReportJobDefinition; desiredAt: string }> = [
    {
      definition: { kind: "collection", policyHash: collectionHash },
      desiredAt: sixHourly.toISOString(),
    },
  ];
  const currentWeek = weekBoundsForDate(now.toISOString().slice(0, 10)).periodStart;
  const publicationPolicies = releases.map((release) => ({ release, policyHash: digest(release) }));
  for (const { release, policyHash } of publicationPolicies) {
    for (let offset = 0; offset < 4; offset++) {
      const periodStart = shiftWeekStart(currentWeek, -offset);
      if (periodStart < release.effectivePeriodStart) continue;
      requests.push({
        definition: { kind: release.kind, policyHash, ...weekBoundsForDate(periodStart) },
        desiredAt: daily.toISOString(),
      });
    }
  }
  if (csatPolicy) {
    for (let offset = 0; offset < 4; offset++) {
      const periodStart = shiftWeekStart(currentWeek, -offset);
      if (periodStart < csatPolicy.release.effectivePeriodStart) continue;
      requests.push({
        definition: {
          kind: "csat",
          policyHash: csatPolicy.policyHash,
          ...weekBoundsForDate(periodStart),
        },
        desiredAt: daily.toISOString(),
      });
    }
  }
  if (legacyPolicy) requests.push(...legacyPolicy.requests);
  return {
    collection,
    publicationPolicies,
    csatPolicy,
    legacyPolicy,
    requests,
    currentPolicyHashes: [
      collectionHash,
      ...publicationPolicies.map((p) => p.policyHash),
      ...(csatPolicy ? [csatPolicy.policyHash] : []),
      ...(legacyPolicy ? [legacyPolicy.policyHash] : []),
    ],
  };
}
type Plan = ReturnType<typeof planReportRecovery>;

/** A tick attempts at most one job; no recursive HTTP calls or outliving the host invocation. */
export async function dispatchReportRecovery(
  plan: Plan,
  execute: (job: ClaimedReportJob) => Promise<ReportJobOutcome>
) {
  const scope = plan.collection.scope;
  await requestReportJobs(scope, plan.requests);
  const job = await claimReportJob(scope, plan.currentPolicyHashes);
  if (!job) return { status: "idle_or_deferred" as const };
  let outcome: ReportJobOutcome;
  try {
    outcome = await execute(job);
  } catch (error) {
    logger.error("Report recovery attempt failed", { error });
    outcome = { status: "failed" };
  }
  // A failed acknowledgment remains recoverable by lease expiry; do not claim completion.
  await finishReportJob(scope, job, outcome);
  return {
    status: outcome.status,
    kind: job.definition.kind,
    ...(outcome.syncRunId ? { syncRunId: outcome.syncRunId } : {}),
    ...(outcome.collectedPages !== undefined ? { collectedPages: outcome.collectedPages } : {}),
    ...(job.definition.kind === "collection"
      ? {}
      : {
          periodStart: job.definition.periodStart,
          periodEnd: job.definition.periodEnd,
        }),
  };
}

export async function runLiveReportRecovery(
  collection: Collection,
  releases: SolvedRelease[],
  credentials: { subdomain: string; email: string; apiKey: string },
  csatPolicy?: ZendeskCsatPolicy,
  legacyPolicy?: ReportEventScope
) {
  const plan = planReportRecovery(collection, releases, new Date(), csatPolicy, legacyPolicy);
  const result = await dispatchReportRecovery(plan, async (job) => {
    // Preserve source pacing on every attempt, including a previously interrupted job.
    if (await isSyncRateLimited(collection.scope.dataSourceId))
      return { status: "deferred", retryAt: new Date(Date.now() + 300000).toISOString() };
    const selected = job.definition;
    if (selected.kind === "collection") {
      const result = await runReportEventBatch(
        collection.scope,
        collection.bootstrapStart,
        createReportEventReader(credentials, collection.scope.accountReference)
      );
      if (result.status === "collected" && result.streamExhausted)
        return { status: "complete", collectedPages: result.pages };
      return {
        status: "deferred",
        collectedPages: result.pages,
        retryAt:
          result.status === "busy"
            ? result.retryAt
            : new Date(
                Date.now() + ("waitMs" in result ? (result.waitMs ?? 30000) : 30000)
              ).toISOString(),
      };
    }
    if (selected.kind === "legacy-sync") {
      if (!plan.legacyPolicy || plan.legacyPolicy.policyHash !== selected.policyHash)
        throw Error("Queued legacy sync policy no longer active");
      const result = await runSync(new ZendeskConnector(), collection.scope, {
        period: { periodStart: selected.periodStart, periodEnd: selected.periodEnd },
      });
      return {
        status: result.success ? "complete" : result.skipped ? "deferred" : "failed",
        syncRunId: result.syncRunId,
        ...(!result.success && result.retryAt ? { retryAt: result.retryAt } : {}),
      };
    }
    if (selected.kind === "csat") {
      if (!plan.csatPolicy || plan.csatPolicy.policyHash !== selected.policyHash)
        throw Error("Queued CSAT policy no longer active");
      const result = await runSync(createCsatConnector(plan.csatPolicy.release), collection.scope, {
        period: { periodStart: selected.periodStart, periodEnd: selected.periodEnd },
      });
      return {
        status: result.success ? "complete" : result.skipped ? "deferred" : "failed",
        syncRunId: result.syncRunId,
        ...(!result.success && result.retryAt ? { retryAt: result.retryAt } : {}),
      };
    }
    const policy = plan.publicationPolicies.find(
      (p) => p.policyHash === selected.policyHash && p.release.kind === selected.kind
    )?.release;
    if (!policy) throw Error("Queued report policy no longer active");
    const connector =
      policy.kind === "updater"
        ? createLiveUpdaterSolvedPublisher(policy, credentials)
        : createLiveAssigneeSolvedPublisher(policy, credentials);
    const result = await runSync(connector, collection.scope, {
      period: { periodStart: selected.periodStart, periodEnd: selected.periodEnd },
    });
    // runSync preserves last good metrics on failure. Retain the queued work for another tick.
    return {
      status: result.success ? "complete" : result.skipped ? "deferred" : "failed",
      syncRunId: result.syncRunId,
      ...(!result.success && result.retryAt ? { retryAt: result.retryAt } : {}),
    };
  });
  if (result.status === "complete" && result.kind === "legacy-sync") await pingSyncHeartbeat();
  return result;
}

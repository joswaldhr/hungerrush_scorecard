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

type Collection = NonNullable<ReturnType<typeof parseReportEventCollectionPolicy>>;
const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function planReportRecovery(
  collection: Collection,
  input: SolvedRelease[],
  now = new Date()
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
  return {
    collection,
    publicationPolicies,
    requests,
    currentPolicyHashes: [collectionHash, ...publicationPolicies.map((p) => p.policyHash)],
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
  credentials: { subdomain: string; email: string; apiKey: string }
) {
  const plan = planReportRecovery(collection, releases);
  return dispatchReportRecovery(plan, async (job) => {
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
    };
  });
}

import { setTimeout as wait } from "node:timers/promises";
import { env } from "@/lib/env";
import { zendeskAccountReference } from "./zendesk-account-binding";
import { fetchCompleteTalkWeek, type TalkCall, type TalkPage } from "./zendesk-talk";
import { createTalkExportReader } from "./zendesk-talk-worker";
import {
  claimTalkCollection,
  deferTalkRequests,
  releaseTalkCollection,
  reserveTalkRequest,
  type TalkStoreScope,
} from "./zendesk-talk-store";
import { SourceRetryLaterError } from "./source-retry";
import { SourceFetchError } from "./source-fetch-error";
import {
  beginLegacyTalkCycle,
  commitLegacyTalkPage,
  readLegacyTalkWeek,
} from "./zendesk-talk-legacy-store";
import type { ConnectorConfig } from "./types";

/** Same account lease and persisted request budget as the durable call/leg worker. */
export async function fetchCoordinatedTalkWeek<T extends TalkCall>(
  scope: TalkStoreScope,
  periodStart: string,
  periodEnd: string,
  read: ReturnType<typeof createTalkExportReader>,
  options: { maxDurationMs?: number; maxPages?: number; resumable?: boolean } = {}
) {
  const maxDurationMs = options.maxDurationMs ?? 240000,
    maxPages = options.maxPages ?? 36;
  if (
    !Number.isInteger(maxDurationMs) ||
    maxDurationMs < 35000 ||
    maxDurationMs > 240000 ||
    !Number.isInteger(maxPages) ||
    maxPages < 1 ||
    maxPages > 36
  )
    throw Error("Invalid legacy Talk collection budget");
  const lease = await claimTalkCollection(scope);
  if (!lease.acquired)
    throw Error("Talk account collection is already running; previous publication retained");
  const owned = { ...scope, token: lease.token };
  const origin = `https://${scope.accountReference.slice("zendesk-account:".length)}.zendesk.com`;
  const started = Date.now(),
    deadline = AbortSignal.timeout(maxDurationMs);
  let requests = 0,
    pacingWaitMs = 0;
  try {
    const getPage = async (path: string) => {
      if (Date.now() - started >= maxDurationMs - 35000 || deadline.aborted)
        throw Error("Legacy Talk elapsed-time budget exhausted; incomplete observation withheld");
      let reservation = await reserveTalkRequest(owned);
      while (!reservation.reserved) {
        if (
          reservation.waitMs > 10000 ||
          Date.now() - started + reservation.waitMs >= maxDurationMs - 35000
        )
          throw new SourceRetryLaterError(reservation.waitMs);
        await wait(reservation.waitMs, undefined, { signal: deadline });
        pacingWaitMs += reservation.waitMs;
        reservation = await reserveTalkRequest(owned);
      }
      // Legacy pagination's relative paths are API-relative. The GET transport validates
      // absolute continuations against this same account/resource/query allowlist.
      const url = path.startsWith("http") ? path : `${origin}/api/v2${path}`;
      requests++;
      const response = await read(url, AbortSignal.any([deadline, AbortSignal.timeout(30000)]));
      if (response.rateLimited) {
        await deferTalkRequests(owned, response.retryAfterMs);
        throw new SourceRetryLaterError(response.retryAfterMs);
      }
      if (deadline.aborted || Date.now() - started >= maxDurationMs)
        throw Error("Legacy Talk elapsed-time budget exhausted; incomplete observation withheld");
      return response.page as TalkPage<T>;
    };
    let result: {
      calls: T[];
      pages: number;
      observationStartedAt?: string;
      observationEndedAt?: string;
    };
    if (options.resumable) {
      let cycle = await beginLegacyTalkCycle(owned, periodStart, periodEnd);
      while (cycle.state.cursor.status !== "exhausted" && requests < maxPages) {
        const page = await getPage(cycle.state.cursor.path);
        cycle = await commitLegacyTalkPage(owned, periodStart, periodEnd, cycle.expectedHash, page);
      }
      if (cycle.state.cursor.status !== "exhausted")
        throw Error(
          "Legacy Talk page budget exhausted; progress retained and incomplete observation withheld"
        );
      const snapshot = await readLegacyTalkWeek(owned, periodStart, periodEnd, cycle.expectedHash);
      result = {
        ...snapshot,
        calls: snapshot.calls as unknown as T[],
        pages: cycle.state.cursor.pages,
      };
    } else {
      result = await fetchCompleteTalkWeek<T>(periodStart, periodEnd, getPage, maxPages);
    }
    return {
      ...result,
      diagnostics: {
        requests,
        pacingWaitMs,
        totalMs: Date.now() - started,
        sharedAccountBudget: true,
        resumable: options.resumable === true,
        ...(result.observationStartedAt
          ? {
              observationStartedAt: result.observationStartedAt,
              observationEndedAt: result.observationEndedAt,
            }
          : {}),
      },
    };
  } catch (error) {
    if (error instanceof SourceRetryLaterError) throw error;
    throw new SourceFetchError(error, {
      family: "legacy_talk",
      endpoint: "calls",
      requests,
      elapsedMs: Math.max(0, Date.now() - started),
      elapsedBudgetMs: maxDurationMs,
      requestBudget: maxPages,
      pacingWaitMs,
    });
  } finally {
    await releaseTalkCollection(owned);
  }
}

/** Only live legacy Talk entry point; never uses zendeskGet's independent retry loop. */
export function fetchLegacyTalkWeek<T extends TalkCall>(
  config: ConnectorConfig,
  periodStart: string,
  periodEnd: string
) {
  const credentials = {
    subdomain: env.ZENDESK_SUBDOMAIN ?? "",
    email: env.ZENDESK_EMAIL ?? "",
    apiKey: env.ZENDESK_API_KEY ?? "",
  };
  const accountReference = zendeskAccountReference(credentials.subdomain);
  return fetchCoordinatedTalkWeek<T>(
    { ...config, accountReference },
    periodStart,
    periodEnd,
    createTalkExportReader(credentials, accountReference),
    { resumable: true }
  );
}

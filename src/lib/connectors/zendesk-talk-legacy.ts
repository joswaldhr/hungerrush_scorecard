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
import type { ConnectorConfig } from "./types";

/** Same account lease and persisted request budget as the durable call/leg worker. */
export async function fetchCoordinatedTalkWeek<T extends TalkCall>(
  scope: TalkStoreScope,
  periodStart: string,
  periodEnd: string,
  read: ReturnType<typeof createTalkExportReader>,
  options: { maxDurationMs?: number; maxPages?: number } = {}
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
    const result = await fetchCompleteTalkWeek<T>(
      periodStart,
      periodEnd,
      async (path) => {
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
      },
      maxPages
    );
    return {
      ...result,
      diagnostics: {
        requests,
        pacingWaitMs,
        totalMs: Date.now() - started,
        sharedAccountBudget: true,
      },
    };
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
    createTalkExportReader(credentials, accountReference)
  );
}

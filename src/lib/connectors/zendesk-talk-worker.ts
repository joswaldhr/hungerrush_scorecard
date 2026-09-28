import { setTimeout as wait } from "node:timers/promises";
import { assertZendeskAccountBinding } from "./zendesk-account-binding";
import {
  beginTalkCollectionCycle,
  claimTalkCollection,
  commitTalkCollectionPage,
  deferTalkRequests,
  releaseTalkCollection,
  reserveTalkRequest,
  type TalkStoreScope,
} from "./zendesk-talk-store";

/** Explicit GET-only transport. No report editor, source mutation, or credential-bearing redirect. */
export function createTalkExportReader(
  credentials: { subdomain: string; email: string; apiKey: string },
  accountReference: string,
  request: typeof fetch = fetch
) {
  assertZendeskAccountBinding(accountReference, credentials.subdomain);
  if (!credentials.email || !credentials.apiKey) throw Error("Talk credentials unavailable");
  const origin = `https://${credentials.subdomain}.zendesk.com`;
  const authorization = `Basic ${Buffer.from(`${credentials.email}/token:${credentials.apiKey}`).toString("base64")}`;
  return async (url: string, signal: AbortSignal) => {
    const destination = new URL(url);
    if (
      destination.origin !== origin ||
      destination.username ||
      destination.password ||
      destination.hash ||
      !/^\/api\/v2\/channels\/voice\/stats\/incremental\/(calls|legs)\.json$/.test(
        destination.pathname
      ) ||
      !/^\d+$/.test(destination.searchParams.get("start_time") ?? "") ||
      destination.searchParams.getAll("start_time").length !== 1 ||
      [...destination.searchParams.keys()].some((k) => k !== "start_time")
    )
      throw Error("Talk request outside account export allowlist");
    let response: Response;
    try {
      response = await request(destination, {
        method: "GET",
        headers: { Authorization: authorization },
        redirect: "error",
        signal,
      });
    } catch {
      throw Error("Talk source request failed");
    }
    if (response.status === 429) {
      const header = response.headers.get("retry-after");
      const seconds = header !== null && /^\d+(?:\.\d+)?$/.test(header) ? Number(header) : null;
      const date = header === null ? NaN : Date.parse(header);
      const retryAfterMs =
        seconds !== null
          ? seconds * 1000
          : Number.isFinite(date)
            ? Math.max(0, date - Date.now())
            : 60000;
      // Persist long vendor delays, rather than silently retrying in the same invocation.
      if (!Number.isFinite(retryAfterMs) || retryAfterMs > 86400000)
        throw Error("Talk source retry delay exceeds collection policy");
      return { rateLimited: true as const, retryAfterMs: Math.max(6300, retryAfterMs) };
    }
    if (!response.ok) throw Error(`Talk source request failed: HTTP ${response.status}`);
    try {
      return { rateLimited: false as const, page: (await response.json()) as unknown };
    } catch {
      throw Error("Talk source response could not be read");
    }
  };
}

/** Durable GET-only collection. Exhaustion is never treated as joined metric coverage. */
export async function runTalkCollectionBatch(
  scope: TalkStoreScope,
  bootstrapStart: number,
  read: ReturnType<typeof createTalkExportReader>,
  options: { maxPages?: number; maxDurationMs?: number } = {}
) {
  const maxPages = options.maxPages ?? 32,
    maxDurationMs = options.maxDurationMs ?? 240000;
  if (
    !Number.isInteger(maxPages) ||
    maxPages < 1 ||
    maxPages > 36 ||
    !Number.isInteger(maxDurationMs) ||
    maxDurationMs < 35000 ||
    maxDurationMs > 240000
  )
    throw Error("Invalid Talk worker budget");
  const started = Date.now(),
    deadline = AbortSignal.timeout(maxDurationMs);
  const lease = await claimTalkCollection(scope);
  if (!lease.acquired) return { status: "busy" as const, pages: 0, retryAt: lease.retryAt };
  const owned = { ...scope, token: lease.token };
  let pages = 0,
    changedRecords = 0,
    revisions = 0;
  try {
    const states = {
      calls: await beginTalkCollectionCycle(owned, "calls", bootstrapStart),
      legs: await beginTalkCollectionCycle(owned, "legs", bootstrapStart),
    };
    while (pages < maxPages && Date.now() - started < maxDurationMs - 35000) {
      if (
        states.calls.state.cursor.status === "exhausted" &&
        states.legs.state.cursor.status === "exhausted"
      )
        break;
      // Alternate streams so a long calls bootstrap cannot starve leg collection.
      for (const resource of ["calls", "legs"] as const) {
        if (states[resource].state.cursor.status === "exhausted") continue;
        if (pages >= maxPages || Date.now() - started >= maxDurationMs - 35000) break;
        let reservation = await reserveTalkRequest(owned);
        while (!reservation.reserved) {
          if (
            reservation.waitMs > 10000 ||
            Date.now() - started + reservation.waitMs >= maxDurationMs - 35000
          )
            return {
              status: "waiting" as const,
              pages,
              changedRecords,
              revisions,
              waitMs: reservation.waitMs,
            };
          await wait(reservation.waitMs, undefined, { signal: deadline });
          reservation = await reserveTalkRequest(owned);
        }
        const response = await read(
          states[resource].state.cursor.path,
          AbortSignal.any([deadline, AbortSignal.timeout(30000)])
        );
        if (response.rateLimited) {
          await deferTalkRequests(owned, response.retryAfterMs);
          return {
            status: "rate_limited" as const,
            pages,
            changedRecords,
            revisions,
            waitMs: response.retryAfterMs,
          };
        }
        const result = await commitTalkCollectionPage(
          owned,
          resource,
          states[resource].expectedHash,
          response.page
        );
        states[resource] = result;
        pages++;
        changedRecords += result.changedRecords;
        revisions += result.revisions;
      }
    }
    return {
      status: "collected" as const,
      pages,
      changedRecords,
      revisions,
      elapsedMs: Date.now() - started,
      callsExhausted: states.calls.state.cursor.status === "exhausted",
      legsExhausted: states.legs.state.cursor.status === "exhausted",
      joinedMetricCoverageCertified: false as const,
    };
  } finally {
    await releaseTalkCollection(owned);
  }
}

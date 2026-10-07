import { setTimeout as wait } from "node:timers/promises";
import { assertZendeskAccountBinding } from "./zendesk-account-binding";
import { reportEventPath } from "./zendesk-report-event-cursor";
import {
  beginReportEventCycle,
  claimReportEventCollection,
  commitReportEventPage,
  deferReportEventRequests,
  releaseReportEventCollection,
  reserveReportEventRequest,
  REPORT_EVENT_SPACING_MS,
  type ReportEventScope,
} from "./zendesk-report-event-store";

// Only allowlisted numeric quota fields may leave the transport. Never return raw
// headers, source bodies or URLs in rate-limit diagnostics.
function quotaNumber(headers: Headers, names: string[], maximum: number) {
  for (const name of names) {
    const raw = headers.get(name);
    if (raw !== null && /^\d+$/.test(raw) && Number(raw) <= maximum) return Number(raw);
  }
  return null;
}
function accountQuota(headers: Headers) {
  const remaining = quotaNumber(headers, ["ratelimit-remaining", "x-rate-limit-remaining"], 1e9),
    resetSeconds = quotaNumber(headers, ["ratelimit-reset"], 86400),
    limit = quotaNumber(headers, ["ratelimit-limit", "x-rate-limit"], 1e9);
  const delay =
    remaining === null
      ? 0
      : remaining <= 2
        ? (resetSeconds === null ? 60 : Math.min(86400, resetSeconds + 1)) * 1000
        : resetSeconds === null
          ? 0
          : Math.ceil((resetSeconds * 1000) / (remaining - 2));
  return { remaining, resetSeconds, limit, delayMs: delay > REPORT_EVENT_SPACING_MS ? delay : 0 };
}

/** Credentials never leave the exact GET export allowlist, including on redirects. */
export function createReportEventReader(
  credentials: { subdomain: string; email: string; apiKey: string },
  accountReference: string,
  request: typeof fetch = fetch
) {
  assertZendeskAccountBinding(accountReference, credentials.subdomain);
  if (!credentials.email || !credentials.apiKey)
    throw Error("Report collection credentials unavailable");
  const authorization = `Basic ${Buffer.from(`${credentials.email}/token:${credentials.apiKey}`).toString("base64")}`;
  return async (path: string, signal: AbortSignal) => {
    const url = reportEventPath(accountReference, path);
    let response: Response;
    try {
      response = await request(url, {
        method: "GET",
        headers: { Authorization: authorization },
        redirect: "error",
        signal,
      });
    } catch {
      throw Error("Report event request failed");
    }
    const quota = accountQuota(response.headers);
    if (response.status === 429) {
      const header = response.headers.get("retry-after");
      const seconds = header !== null && /^\d+(?:\.\d+)?$/.test(header) ? Number(header) : null;
      const date = header === null ? NaN : Date.parse(header);
      const delay =
        seconds !== null
          ? seconds * 1000
          : Number.isFinite(date)
            ? Math.max(0, date - Date.now())
            : 60000;
      if (!Number.isFinite(delay) || delay > 86400000)
        throw Error("Report retry delay exceeds collection policy");
      await response.body?.cancel().catch(() => {});
      return {
        rateLimited: true as const,
        retryAfterMs: Math.max(60000, delay, quota.delayMs),
        sourceRetryAfterMs: delay,
        quota: { remaining: quota.remaining, resetSeconds: quota.resetSeconds, limit: quota.limit },
      };
    }
    if (!response.ok) throw Error(`Report event request failed: HTTP ${response.status}`);
    try {
      return {
        rateLimited: false as const,
        page: (await response.json()) as unknown,
        quotaDelayMs: quota.delayMs,
      };
    } catch {
      throw Error("Report event response could not be read");
    }
  };
}

/** Bounded invocation, durable page commits, and no publication or human-attribution writes. */
export async function runReportEventBatch(
  scope: ReportEventScope,
  bootstrapStart: number,
  read: ReturnType<typeof createReportEventReader>,
  options: { maxPages?: number; maxDurationMs?: number } = {}
) {
  const maxPages = options.maxPages ?? 20,
    maxDurationMs = options.maxDurationMs ?? 240000;
  if (
    !Number.isInteger(maxPages) ||
    maxPages < 1 ||
    maxPages > 20 ||
    !Number.isInteger(maxDurationMs) ||
    maxDurationMs < 35000 ||
    maxDurationMs > 240000
  )
    throw Error("Invalid report collection budget");
  const started = Date.now(),
    deadline = AbortSignal.timeout(maxDurationMs);
  const lease = await claimReportEventCollection(scope);
  if (!lease.acquired) return { status: "busy" as const, pages: 0, retryAt: lease.retryAt };
  const owned = { ...scope, token: lease.token };
  let pages = 0,
    newEvents = 0;
  try {
    let current = await beginReportEventCycle(owned, bootstrapStart);
    while (
      pages < maxPages &&
      current.state.cursor.status !== "exhausted" &&
      Date.now() - started < maxDurationMs - 35000
    ) {
      let reservation = await reserveReportEventRequest(owned);
      while (!reservation.reserved) {
        if (
          reservation.waitMs > 30000 ||
          Date.now() - started + reservation.waitMs >= maxDurationMs - 35000
        )
          return { status: "waiting" as const, pages, newEvents, waitMs: reservation.waitMs };
        await wait(reservation.waitMs, undefined, { signal: deadline });
        reservation = await reserveReportEventRequest(owned);
      }
      const response = await read(
        current.state.cursor.path,
        AbortSignal.any([deadline, AbortSignal.timeout(30000)])
      );
      if (response.rateLimited) {
        await deferReportEventRequests(owned, response.retryAfterMs);
        return {
          status: "rate_limited" as const,
          pages,
          newEvents,
          waitMs: response.retryAfterMs,
          sourceRetryAfterMs: response.sourceRetryAfterMs,
          quota: response.quota,
        };
      }
      // Persist quota deferral before advancing the cursor: a failed page commit
      // or worker interruption must not let its successor skip the cooldown.
      if (response.quotaDelayMs > 0) await deferReportEventRequests(owned, response.quotaDelayMs);
      const committed = await commitReportEventPage(owned, current.expectedHash, response.page);
      current = committed;
      pages++;
      newEvents += committed.newEvents;
    }
    return {
      status: "collected" as const,
      pages,
      newEvents,
      elapsedMs: Date.now() - started,
      streamExhausted: current.state.cursor.status === "exhausted",
      joinedMetricCoverageCertified: false as const,
    };
  } finally {
    await releaseReportEventCollection(owned);
  }
}

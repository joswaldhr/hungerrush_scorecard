import { setTimeout as wait } from "node:timers/promises";
import { zendeskAccountReference } from "./zendesk-account-binding";
import { SourceFetchError } from "./source-fetch-error";

/** CSAT has its own global budget; neither transport retries nor pagination can extend it. */
export function createBoundedCsatReader(
  credentials: { subdomain: string; email: string; apiKey: string },
  options: {
    fetch?: typeof fetch;
    now?: () => number;
    elapsedMs?: number;
    requestBudget?: number;
    spacingMs?: number;
    /** Explicit opt-in; the allowance is shared across the whole collection. */
    maxRateLimitRetries?: 0 | 1;
  } = {}
) {
  zendeskAccountReference(credentials.subdomain);
  if (!credentials.email || !credentials.apiKey) throw new Error("CSAT credentials unavailable");
  const elapsedMs = options.elapsedMs ?? 240000,
    requestBudget = options.requestBudget ?? 240,
    spacingMs = options.spacingMs ?? 650,
    maxRateLimitRetries = options.maxRateLimitRetries ?? 0;
  if (
    !Number.isInteger(requestBudget) ||
    requestBudget < 1 ||
    requestBudget > 300 ||
    !Number.isInteger(elapsedMs) ||
    elapsedMs < 1 ||
    elapsedMs > 240000 ||
    !Number.isFinite(spacingMs) ||
    spacingMs < 0 ||
    spacingMs > 5000 ||
    ![0, 1].includes(maxRateLimitRetries)
  )
    throw new Error("Invalid CSAT collection budget");
  const now = options.now ?? Date.now,
    started = now(),
    deadline = AbortSignal.timeout(elapsedMs);
  const origin = `https://${credentials.subdomain}.zendesk.com`;
  const authorization = `Basic ${Buffer.from(`${credentials.email}/token:${credentials.apiKey}`).toString("base64")}`;
  const request = options.fetch ?? fetch;
  let requests = 0,
    lastStarted: number | null = null,
    rateLimitRetries = 0,
    backoffWaitMs = 0,
    quotaWaitMs = 0,
    quotaNextAt = 0;
  let accountQuota: { accountLimit: number; accountRemaining: number } | undefined;
  const headerCount = (headers: Headers, key: string) => {
    const value = headers.get(key)?.trim();
    return value && /^\d+$/.test(value) && Number.isSafeInteger(Number(value))
      ? Number(value)
      : null;
  };
  const observeQuota = (headers: Headers, requireReset = true) => {
    const limit = headerCount(headers, "ratelimit-limit"),
      remaining = headerCount(headers, "ratelimit-remaining"),
      reset = headerCount(headers, "ratelimit-reset");
    accountQuota = undefined;
    quotaNextAt = 0;
    if (limit === null || remaining === null || limit < 1 || remaining > limit) return;
    accountQuota = { accountLimit: limit, accountRemaining: remaining };
    if (reset === null || reset > 86400) {
      if (remaining === 0 && requireReset)
        throw Error("CSAT account quota exhausted without a usable reset time");
      return;
    }
    // Leave two requests for competing account clients. Integer reset headers have
    // second precision; allow one additional second at the exhausted boundary.
    const delay = remaining <= 2 ? (reset + 1) * 1000 : Math.ceil((reset * 1000) / (remaining - 2));
    quotaNextAt = now() + delay;
  };
  let failure: Pick<
    SourceFetchError["diagnostics"],
    "endpoint" | "httpStatus" | "retryAfterMs" | "retryStoppedBy"
  > = {};
  const stats = () => ({
    requests,
    elapsedMs: Math.max(0, now() - started),
    requestBudget,
    elapsedBudgetMs: elapsedMs,
    rateLimitRetries,
    backoffWaitMs,
    quotaWaitMs,
    ...accountQuota,
  });
  const checkTime = () => {
    if (deadline.aborted || now() - started >= elapsedMs)
      throw new Error("CSAT collection elapsed-time budget exhausted");
  };
  const read = async (path: string): Promise<unknown> => {
    failure = {};
    checkTime();
    const url = new URL(path.startsWith("http") ? path : `${origin}/api/v2${path}`);
    if (
      url.origin !== origin ||
      url.username ||
      url.password ||
      url.hash ||
      !/^\/api\/v2\/(users|search\/export|tickets\/show_many)\.json$/.test(url.pathname)
    )
      throw new Error("CSAT source URL outside the account endpoint allowlist");
    failure.endpoint = url.pathname.slice("/api/v2/".length, -".json".length) as NonNullable<
      typeof failure.endpoint
    >;
    // A retry consumes the same global request/time budget and repeats only this GET.
    for (;;) {
      if (requests >= requestBudget) throw new Error("CSAT collection request budget exhausted");
      const quotaDelay = quotaNextAt - now();
      if (quotaDelay > 0) {
        if (quotaDelay > 65000 || now() - started + quotaDelay + 30000 >= elapsedMs) {
          failure.retryStoppedBy = "quota_budget";
          throw Error("CSAT account quota wait exceeds remaining collection budget");
        }
        quotaWaitMs += quotaDelay;
        try {
          await wait(quotaDelay, undefined, { signal: deadline });
        } catch {
          throw Error("CSAT collection elapsed-time budget exhausted");
        }
        checkTime();
      }
      if (lastStarted !== null) {
        const remaining = spacingMs - (now() - lastStarted);
        if (remaining > 0) {
          try {
            await wait(remaining, undefined, { signal: deadline });
          } catch {
            throw new Error("CSAT collection elapsed-time budget exhausted");
          }
        }
      }
      checkTime();
      if (requests >= requestBudget) throw new Error("CSAT collection request budget exhausted");
      lastStarted = now();
      requests++;
      let response: Response;
      try {
        response = await request(url, {
          method: "GET",
          headers: { Authorization: authorization },
          redirect: "error",
          signal: AbortSignal.any([deadline, AbortSignal.timeout(30000)]),
        });
      } catch {
        checkTime();
        throw new Error("CSAT source request failed");
      }
      if (!response.ok) {
        failure.httpStatus = response.status;
        // Failed fetches do not return collection stats. Preserve only this bounded
        // endpoint category and a parsed delay in the sync error, never the URL,
        // query (employee/ticket IDs), response body or raw vendor header.
        const endpoint = url.pathname.slice("/api/v2/".length, -".json".length);
        let delay = "";
        if (response.status === 429) {
          observeQuota(response.headers, false);
          const header = response.headers.get("retry-after")?.trim();
          const retryAfterMs = header
            ? /^\d+$/.test(header)
              ? Number(header) * 1000
              : Date.parse(header) - now()
            : NaN;
          delay =
            Number.isSafeInteger(retryAfterMs) && retryAfterMs >= 0
              ? `; retryAfterMs=${retryAfterMs}`
              : "; retryAfterMs=unavailable";
          const waitMs = Math.max(retryAfterMs, spacingMs, quotaNextAt - now());
          failure.retryAfterMs =
            Number.isSafeInteger(retryAfterMs) && retryAfterMs >= 0 ? retryAfterMs : null;
          failure.retryStoppedBy =
            maxRateLimitRetries === 0
              ? "disabled"
              : failure.retryAfterMs === null
                ? "invalid_delay"
                : waitMs > 60_000
                  ? "delay_too_long"
                  : rateLimitRetries >= maxRateLimitRetries
                    ? "retry_allowance"
                    : requests >= requestBudget
                      ? "request_budget"
                      : "time_budget";
          if (
            Number.isSafeInteger(retryAfterMs) &&
            retryAfterMs >= 0 &&
            waitMs <= 60_000 &&
            rateLimitRetries < maxRateLimitRetries &&
            requests < requestBudget &&
            // Reserve a full request timeout; never borrow from publication time.
            now() - started + waitMs + 30_000 < elapsedMs
          ) {
            await response.body?.cancel();
            rateLimitRetries++;
            backoffWaitMs += waitMs;
            try {
              await wait(waitMs, undefined, { signal: deadline });
            } catch {
              throw new Error("CSAT collection elapsed-time budget exhausted");
            }
            checkTime();
            failure = { endpoint: failure.endpoint };
            continue;
          }
        }
        throw new Error(
          `CSAT source request failed: HTTP ${response.status}; endpoint=${endpoint}${delay}`
        );
      }
      observeQuota(response.headers);
      try {
        const result: unknown = await response.json();
        checkTime();
        return result;
      } catch {
        checkTime();
        throw new Error("CSAT source response could not be read");
      }
    }
  };
  return {
    stats,
    read: async (path: string) => {
      try {
        return await read(path);
      } catch (error) {
        throw new SourceFetchError(error, { family: "csat", ...stats(), ...failure });
      }
    },
  };
}

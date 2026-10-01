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
    backoffWaitMs = 0;
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
          const waitMs = Math.max(retryAfterMs, spacingMs);
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

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { SourceRetryLaterError } from "./source-retry";

const MAX_RETRIES = 3;
// A stalled connection with no timeout hangs the whole sync forever — nothing
// ever throws, so the fetch phase's try/catch (sync-engine.ts) never gets a
// chance to run, and the sync_runs row is left at "running" indefinitely.
// Found empirically: a real sync attempt hung with zero progress for 15+
// minutes with no error anywhere. 30s is generous for a single Zendesk call
// (429 backoff is handled separately, below) while still failing fast on a
// genuinely dead connection.
const REQUEST_TIMEOUT_MS = 30_000;

export function authHeader(): string {
  const { ZENDESK_EMAIL, ZENDESK_API_KEY } = env;
  if (!ZENDESK_EMAIL || !ZENDESK_API_KEY) {
    throw new Error("ZENDESK_EMAIL and ZENDESK_API_KEY must be set");
  }
  return `Basic ${Buffer.from(`${ZENDESK_EMAIL}/token:${ZENDESK_API_KEY}`).toString("base64")}`;
}

export function baseUrl(): string {
  if (!env.ZENDESK_SUBDOMAIN) throw new Error("ZENDESK_SUBDOMAIN must be set");
  return `https://${env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`;
}

// Optional accumulator a caller can pass to observe rate-limit behavior across
// a whole paging loop (see fetchCallsForWeek) -- diagnostic only, has no
// effect on request/retry behavior itself.
export interface RequestStats {
  requests: number;
  retries429: number;
  backoffWaitMs: number;
}

export async function zendeskGet<T>(
  pathOrUrl: string,
  stats?: RequestStats,
  options?: { deferRateLimit?: boolean }
): Promise<T> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${baseUrl()}${pathOrUrl}`;
  const parsed = new URL(url);
  // Pagination links are vendor response data, not authorization to send the
  // account credential to another host. Redirects must not widen this boundary.
  if (
    parsed.origin !== new URL(baseUrl()).origin ||
    !parsed.pathname.startsWith("/api/v2/") ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    throw new Error("Zendesk request rejected: URL is outside the configured API");
  }
  // Query strings can contain emails/actor IDs; resource paths can identify tickets.
  const diagnosticPath = parsed.pathname.replace(/\/\d+(?=\/|\.|$)/g, "/[id]");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (stats) stats.requests++;
    const res = await fetch(url, {
      headers: { Authorization: authHeader() },
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.status === 429) {
      const parsedRetryAfter = Number(res.headers.get("Retry-After") ?? "60");
      const retryAfter =
        Number.isFinite(parsedRetryAfter) && parsedRetryAfter > 0 ? parsedRetryAfter : 60;
      if (options?.deferRateLimit) throw new SourceRetryLaterError(retryAfter * 1000);
      if (attempt === MAX_RETRIES) {
        throw new Error(`Zendesk GET ${diagnosticPath} rate-limited after ${MAX_RETRIES} retries`);
      }
      const waitMs = Math.min(retryAfter, 120) * 1000;
      logger.warn("Zendesk 429 rate limit", { path: diagnosticPath, retryAfter, attempt });
      if (stats) {
        stats.retries429++;
        stats.backoffWaitMs += waitMs;
      }
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    if (!res.ok) {
      throw new Error(`Zendesk GET ${diagnosticPath} failed: HTTP ${res.status}`);
    }

    return (await res.json()) as T;
  }

  throw new Error(`Zendesk GET ${diagnosticPath} exhausted retries`);
}

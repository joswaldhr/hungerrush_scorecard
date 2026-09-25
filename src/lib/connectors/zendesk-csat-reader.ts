import { setTimeout as wait } from "node:timers/promises";
import { zendeskAccountReference } from "./zendesk-account-binding";

/** CSAT has its own global budget; neither transport retries nor pagination can extend it. */
export function createBoundedCsatReader(
  credentials: { subdomain: string; email: string; apiKey: string },
  options: {
    fetch?: typeof fetch;
    now?: () => number;
    elapsedMs?: number;
    requestBudget?: number;
    spacingMs?: number;
  } = {}
) {
  zendeskAccountReference(credentials.subdomain);
  if (!credentials.email || !credentials.apiKey) throw new Error("CSAT credentials unavailable");
  const elapsedMs = options.elapsedMs ?? 240000,
    requestBudget = options.requestBudget ?? 240,
    spacingMs = options.spacingMs ?? 650;
  if (
    !Number.isInteger(requestBudget) ||
    requestBudget < 1 ||
    requestBudget > 300 ||
    !Number.isInteger(elapsedMs) ||
    elapsedMs < 1 ||
    elapsedMs > 240000 ||
    !Number.isFinite(spacingMs) ||
    spacingMs < 0 ||
    spacingMs > 5000
  )
    throw new Error("Invalid CSAT collection budget");
  const now = options.now ?? Date.now,
    started = now(),
    deadline = AbortSignal.timeout(elapsedMs);
  const origin = `https://${credentials.subdomain}.zendesk.com`;
  const authorization = `Basic ${Buffer.from(`${credentials.email}/token:${credentials.apiKey}`).toString("base64")}`;
  const request = options.fetch ?? fetch;
  let requests = 0,
    lastStarted: number | null = null;
  const checkTime = () => {
    if (deadline.aborted || now() - started >= elapsedMs)
      throw new Error("CSAT collection elapsed-time budget exhausted");
  };
  return {
    stats: () => ({
      requests,
      elapsedMs: now() - started,
      requestBudget,
      elapsedBudgetMs: elapsedMs,
    }),
    read: async (path: string): Promise<unknown> => {
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
          headers: { Authorization: authorization },
          redirect: "error",
          signal: AbortSignal.any([deadline, AbortSignal.timeout(30000)]),
        });
      } catch {
        checkTime();
        throw new Error("CSAT source request failed");
      }
      if (!response.ok) throw new Error(`CSAT source request failed: HTTP ${response.status}`);
      try {
        const result: unknown = await response.json();
        checkTime();
        return result;
      } catch {
        checkTime();
        throw new Error("CSAT source response could not be read");
      }
    },
  };
}

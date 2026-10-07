import { setTimeout as wait } from "node:timers/promises";
import { assertZendeskAccountBinding } from "./zendesk-account-binding";

/** Report-credit joins only; existing CSAT/first-reply transports remain unchanged. */
export function createReportJoinReader(
  credentials: { subdomain: string; email: string; apiKey: string },
  accountReference: string,
  options: {
    request?: typeof fetch;
    requestBudget?: number;
    elapsedMs?: number;
    spacingMs?: number;
  } = {}
) {
  assertZendeskAccountBinding(accountReference, credentials.subdomain);
  if (!credentials.email || !credentials.apiKey) throw Error("Report join credentials unavailable");
  const origin = `https://${credentials.subdomain}.zendesk.com`;
  const authorization = `Basic ${Buffer.from(`${credentials.email}/token:${credentials.apiKey}`).toString("base64")}`;
  const request = options.request ?? fetch,
    budget = options.requestBudget ?? 100,
    elapsed = options.elapsedMs ?? 240000,
    spacing = options.spacingMs ?? 2000;
  if (
    !Number.isInteger(budget) ||
    budget < 1 ||
    budget > 100 ||
    !Number.isInteger(elapsed) ||
    elapsed < 1 ||
    elapsed > 240000 ||
    !Number.isInteger(spacing) ||
    spacing < 0 ||
    spacing > 5000
  )
    throw Error("Invalid report join budget");
  const began = Date.now(),
    deadline = AbortSignal.timeout(elapsed);
  let requests = 0,
    nextAllowed = began,
    failed = false;
  const allow = (path: string) => {
    const url = new URL(path.startsWith("http") ? path : `${origin}/api/v2${path}`),
      q = url.searchParams;
    if (url.origin !== origin || url.username || url.password || url.hash)
      throw Error("Report join outside account allowlist");
    let allowed: string[] = [];
    if (url.pathname === "/api/v2/users.json") {
      allowed = ["role[]", "page[size]", "page[after]", "include_boundary_indicators"];
      if (
        q.getAll("role[]").sort().join(",") !== "admin,agent" ||
        q.get("page[size]") !== "100" ||
        q.get("include_boundary_indicators") !== "true" ||
        (q.get("page[after]")?.length ?? 0) > 4096
      )
        throw Error("Report identity query outside allowlist");
    } else if (url.pathname === "/api/v2/tickets/show_many.json") {
      allowed = ["ids", "include"];
      const ids = (q.get("ids") ?? "").split(",");
      if (
        !ids.length ||
        ids.length > 100 ||
        new Set(ids).size !== ids.length ||
        ids.some(
          (id) => !/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1
        ) ||
        q.get("include") !== "metric_sets"
      )
        throw Error("Report parent query outside allowlist");
    } else if (url.pathname === "/api/v2/deleted_tickets.json") {
      allowed = ["per_page", "page", "sort_by", "sort_order"];
      if (
        q.get("per_page") !== "100" ||
        q.get("sort_by") !== "deleted_at" ||
        q.get("sort_order") !== "desc" ||
        (q.has("page") &&
          (!/^\d+$/.test(q.get("page")!) ||
            Number(q.get("page")) < 1 ||
            Number(q.get("page")) > 100))
      )
        throw Error("Report deletion query outside allowlist");
    } else throw Error("Report join endpoint outside allowlist");
    if (
      [...q.keys()].some(
        (k) => !allowed.includes(k) || (k !== "role[]" && q.getAll(k).length !== 1)
      )
    )
      throw Error("Report join parameters outside allowlist");
    return url;
  };
  return async (path: string): Promise<unknown> => {
    const url = allow(path);
    if (failed || requests >= budget || deadline.aborted || Date.now() - began >= elapsed)
      throw Error("Report join budget exhausted or stopped");
    const delay = Math.max(0, nextAllowed - Date.now());
    if (delay + Date.now() - began + 30000 >= elapsed)
      throw Error("Report join quota exceeds remaining budget");
    if (delay) await wait(delay, undefined, { signal: deadline });
    requests++;
    nextAllowed = Date.now() + spacing;
    let response: Response;
    try {
      response = await request(url, {
        method: "GET",
        redirect: "error",
        headers: { Authorization: authorization },
        signal: AbortSignal.any([deadline, AbortSignal.timeout(30000)]),
      });
    } catch {
      failed = true;
      throw Error("Report join source request failed");
    }
    if (!response.ok) {
      failed = true;
      await response.body?.cancel();
      throw Error(`Report join source request failed: HTTP ${response.status}`);
    }
    const remaining = response.headers.get("ratelimit-remaining"),
      reset = response.headers.get("ratelimit-reset");
    if (remaining !== null && /^\d+$/.test(remaining)) {
      if (reset !== null && /^\d+$/.test(reset) && Number(reset) <= 86400) {
        const quotaWait =
          Number(remaining) <= 2
            ? (Number(reset) + 1) * 1000
            : Math.ceil((Number(reset) * 1000) / (Number(remaining) - 2));
        nextAllowed = Math.max(nextAllowed, Date.now() + quotaWait);
      } else if (Number(remaining) <= 2) {
        failed = true;
        throw Error("Report join quota lacks a reset time");
      }
    }
    try {
      return await response.json();
    } catch {
      failed = true;
      throw Error("Report join source response could not be read");
    }
  };
}

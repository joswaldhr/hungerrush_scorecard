import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const MAX_RETRIES = 3;

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

export async function zendeskGet<T>(pathOrUrl: string): Promise<T> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${baseUrl()}${pathOrUrl}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, { headers: { Authorization: authHeader() } });

    if (res.status === 429) {
      if (attempt === MAX_RETRIES) {
        throw new Error(`Zendesk GET ${pathOrUrl} rate-limited after ${MAX_RETRIES} retries`);
      }
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10);
      const waitMs = Math.min(retryAfter, 120) * 1000;
      logger.warn("Zendesk 429 rate limit", { path: pathOrUrl, retryAfter, attempt });
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    if (!res.ok) {
      throw new Error(`Zendesk GET ${pathOrUrl} failed: ${res.status} ${res.statusText}`);
    }

    return (await res.json()) as T;
  }

  throw new Error(`Zendesk GET ${pathOrUrl} exhausted retries`);
}

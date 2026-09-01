import { env } from "@/lib/env";
import type { HealthStatus } from "./types";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const BATCH_SIZE = 20;

export interface EntraCandidate {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  accountEnabled: boolean;
}

export interface EntraAccountStatus {
  accountEnabled: boolean;
  displayName: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const { ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET } = env;
  if (!ENTRA_TENANT_ID || !ENTRA_CLIENT_ID || !ENTRA_CLIENT_SECRET) {
    throw new Error("ENTRA_TENANT_ID, ENTRA_CLIENT_ID, and ENTRA_CLIENT_SECRET must be set");
  }

  const res = await fetch(
    `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: ENTRA_CLIENT_ID,
        client_secret: ENTRA_CLIENT_SECRET,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Entra token request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function graphGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Graph GET ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

interface BatchRequest {
  id: string;
  method: "GET";
  url: string;
}

interface BatchResponseItem {
  id: string;
  status: number;
  body: {
    id?: string;
    displayName?: string;
    accountEnabled?: boolean;
  };
}

async function graphBatch(requests: BatchRequest[]): Promise<BatchResponseItem[]> {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH_BASE_URL}/$batch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    throw new Error(`Graph batch request failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { responses: BatchResponseItem[] };
  return data.responses;
}

export class EntraClient {
  async healthCheck(): Promise<HealthStatus> {
    try {
      await graphGet(`/users?$top=1`);
      return { connected: true, message: "Entra connection healthy", lastSyncAt: null };
    } catch (err) {
      return {
        connected: false,
        message: err instanceof Error ? err.message : "Unknown error",
        lastSyncAt: null,
      };
    }
  }

  /** Proposes candidates for a person by display name -- always requires human confirmation
   * before the match is trusted; see docs/INTEGRATIONS.md's identity-matching rules. */
  async searchByName(displayName: string): Promise<EntraCandidate[]> {
    const escaped = displayName.replace(/'/g, "''");
    const data = await graphGet<{ value: EntraCandidate[] }>(
      `/users?$filter=${encodeURIComponent(`startswith(displayName,'${escaped}')`)}&$select=id,displayName,mail,userPrincipalName,accountEnabled&$top=10`
    );
    return data.value;
  }

  /** Batched account-status lookup by Entra objectId (stable across renames). */
  async getAccountStatus(objectIds: string[]): Promise<Map<string, EntraAccountStatus>> {
    const result = new Map<string, EntraAccountStatus>();

    for (let i = 0; i < objectIds.length; i += BATCH_SIZE) {
      const batch = objectIds.slice(i, i + BATCH_SIZE);
      const requests: BatchRequest[] = batch.map((id, idx) => ({
        id: String(idx),
        method: "GET",
        url: `/users/${id}?$select=id,displayName,accountEnabled`,
      }));
      const responses = await graphBatch(requests);
      for (let idx = 0; idx < batch.length; idx++) {
        const objectId = batch[idx]!;
        const response = responses.find((r) => r.id === String(idx));
        if (response?.status === 200 && response.body.id) {
          result.set(objectId, {
            accountEnabled: response.body.accountEnabled ?? false,
            displayName: response.body.displayName ?? objectId,
          });
        }
      }
    }

    return result;
  }
}

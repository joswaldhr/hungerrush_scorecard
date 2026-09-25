// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

// Exercise our startup guard without bootstrapping Next.js routing in Node.
vi.mock("next-auth", () => ({
  default: () => {
    throw new Error("Auth initialization must not run with missing production SSO");
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("hosting environment overrides", () => {
  it("disables optional integrations and SSO when branch overrides are empty", async () => {
    for (const key of [
      "ZENDESK_SUBDOMAIN",
      "ZENDESK_EMAIL",
      "ZENDESK_API_KEY",
      "ASSEMBLED_API_KEY",
      "AUTH_MICROSOFT_ENTRA_ID_ID",
      "AUTH_MICROSOFT_ENTRA_ID_SECRET",
      "AUTH_MICROSOFT_ENTRA_ID_ISSUER",
      "SYNC_HEARTBEAT_URL",
    ]) {
      vi.stubEnv(key, "");
    }
    const { env } = await import("./env");
    expect(env.ZENDESK_API_KEY).toBeUndefined();
    expect(env.ASSEMBLED_API_KEY).toBeUndefined();
    expect(env.AUTH_MICROSOFT_ENTRA_ID_ID).toBeUndefined();
    expect(env.AUTH_MICROSOFT_ENTRA_ID_SECRET).toBeUndefined();
    expect(env.SYNC_HEARTBEAT_URL).toBeUndefined();
  });

  it.each(["DATABASE_URL", "AUTH_SECRET"])("still rejects an empty required %s", async (key) => {
    vi.stubEnv(key, "");
    await expect(import("./env")).rejects.toThrow(key);
  });

  it("still rejects malformed optional URLs", async () => {
    vi.stubEnv("SYNC_HEARTBEAT_URL", "not-a-url");
    await expect(import("./env")).rejects.toThrow("SYNC_HEARTBEAT_URL");
  });

  it("refuses production sign-in startup when SSO overrides are empty", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_MICROSOFT_ENTRA_ID_ID", "");
    vi.stubEnv("AUTH_MICROSOFT_ENTRA_ID_SECRET", "");
    await expect(import("./auth")).rejects.toThrow("Microsoft Entra ID is not configured");
  });
});

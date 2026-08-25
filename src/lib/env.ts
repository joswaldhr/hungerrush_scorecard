import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Zendesk connector (optional — only required once the live connector is wired in)
  ZENDESK_SUBDOMAIN: z.string().min(1).optional(),
  ZENDESK_EMAIL: z.string().min(1).optional(),
  ZENDESK_API_KEY: z.string().min(1).optional(),

  // Assembled connector (optional)
  ASSEMBLED_API_KEY: z.string().min(1).optional(),

  // Microsoft Graph app-only access for org sync (client-credentials flow — optional)
  ENTRA_TENANT_ID: z.string().min(1).optional(),
  ENTRA_CLIENT_ID: z.string().min(1).optional(),
  ENTRA_CLIENT_SECRET: z.string().min(1).optional(),

  // Microsoft Entra ID interactive sign-in (SSO) — a separate app registration
  // from the Graph app-only credentials above; optional until configured.
  AUTH_MICROSOFT_ENTRA_ID_ID: z.string().min(1).optional(),
  AUTH_MICROSOFT_ENTRA_ID_SECRET: z.string().min(1).optional(),
  AUTH_MICROSOFT_ENTRA_ID_ISSUER: z.string().min(1).optional(),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Missing or invalid environment variables:\n${formatted}`);
  }
  return result.data;
}

export const env = validateEnv();

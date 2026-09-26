import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Zendesk connector (optional — only required once the live connector is wired in)
  ZENDESK_SUBDOMAIN: z.string().min(1).optional(),
  ZENDESK_EMAIL: z.string().min(1).optional(),
  ZENDESK_API_KEY: z.string().min(1).optional(),
  // Private, explicit prospective CSAT ownership policy. Unset until release qualification.
  ZENDESK_CSAT_POLICY: z.string().min(1).optional(),
  // Separate prospective first-reply collector; disabled until qualified.
  ZENDESK_FIRST_REPLY_POLICY: z.string().min(1).optional(),
  // Independent opt-ins: retaining Talk evidence does not enable outbound publication.
  ZENDESK_TALK_COLLECTION_POLICY: z.string().min(1).optional(),
  ZENDESK_OUTBOUND_POLICY: z.string().min(1).optional(),

  // Assembled connector (optional)
  ASSEMBLED_API_KEY: z.string().min(1).optional(),

  // Microsoft Entra ID interactive sign-in (SSO) — a separate app registration
  // from the Graph app-only credentials above; optional until configured.
  AUTH_MICROSOFT_ENTRA_ID_ID: z.string().min(1).optional(),
  AUTH_MICROSOFT_ENTRA_ID_SECRET: z.string().min(1).optional(),
  AUTH_MICROSOFT_ENTRA_ID_ISSUER: z.string().min(1).optional(),

  // Rippling has no real integration yet (see docs/ARCHITECTURE.md's Known
  // Gaps) — this is a plain link-out, not a deep link to a specific employee
  // record, per PRODUCT.md's sanctioned fallback. Optional; the 1:1 Prep
  // page's "Open Rippling" link only renders once this is set.
  RIPPLING_MANAGER_URL: z.string().url().optional(),

  // Shared secret the Vercel Cron job sends as a header to authenticate
  // /api/cron/sync, since that route runs with no user session. Optional so
  // local dev doesn't need it, but the route itself requires it be set.
  CRON_SECRET: z.string().min(1).optional(),
  // Explicit single-source opt-in. Unset on production and Preview until rollout validation.
  ACTION_SHADOW_SOURCE_ID: z.string().uuid().optional(),
  // Optional dedicated scheduler credential; when set, the shadow route stops accepting CRON_SECRET.
  ACTION_SHADOW_SECRET: z.string().min(32).optional(),

  // Optional dead-man's-switch URL (e.g. a Healthchecks.io or Cronitor check
  // URL) pinged after /api/cron/sync completes its real work. Left unset,
  // the ping is skipped entirely — this app never creates the monitoring
  // account itself, a human wires up the URL once one exists.
  SYNC_HEARTBEAT_URL: z.string().url().optional(),
});

function validateEnv() {
  // A branch-scoped empty value overrides an inherited hosting credential.
  // Treat it as unset so optional integrations stay disabled; required keys
  // still fail validation and production sign-in retains its own guard.
  const configured = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== "")
  );
  const result = envSchema.safeParse(configured);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Missing or invalid environment variables:\n${formatted}`);
  }
  return result.data;
}

export const env = validateEnv();

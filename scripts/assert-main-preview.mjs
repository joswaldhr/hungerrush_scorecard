/** Build gate for the separate main-app Preview; never prints connection values. */
import assert from "node:assert/strict";

assert.equal(process.env.VERCEL_ENV, "preview", "Only an isolated Preview is allowed");
assert.equal(process.env.VERCEL_GIT_COMMIT_REF, "codex/main-operational-upgrade");
const database = new URL(process.env.DATABASE_URL ?? "");
assert.equal(database.protocol, "postgresql:");
assert.equal(database.hostname, "nozomi.proxy.rlwy.net", "Unexpected Preview database");
assert.equal(database.port, "24570", "Unexpected Preview database port");
assert.equal(database.pathname, "/railway");
assert(database.password, "Preview database authentication missing");
for (const name of [
  "ZENDESK_EMAIL",
  "ZENDESK_API_KEY",
  "ASSEMBLED_API_KEY",
  "ENTRA_CLIENT_SECRET",
  "ZENDESK_TALK_COLLECTION_POLICY",
  "ZENDESK_LEGACY_TALK_RESUME",
  "ZENDESK_OUTBOUND_POLICY",
  "ZENDESK_INBOUND_REPORT_RELEASE",
  "ZENDESK_CSAT_POLICY",
  "ZENDESK_FIRST_REPLY_POLICY",
  "ACTION_SHADOW_SOURCE_ID",
  "ROSTER_DISCOVERY_SOURCE_ID",
]) {
  assert(!process.env[name], "Source work must be disabled for main UI rehearsal");
}
console.log("Main Preview isolation verified; source publication remains disabled.");

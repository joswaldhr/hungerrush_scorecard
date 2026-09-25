/** Read-only identity census. Reports aggregate counts, never employee/source identifiers. */
import { writeFile } from "node:fs/promises";
import postgres from "postgres";
import { resolveActionActor } from "../src/lib/connectors/zendesk-action-identity";

async function main() {
  const output = process.argv[2];
  if (!process.env.DATABASE_URL || !output) throw new Error("Require DATABASE_URL and output path");
  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const counts = await client.begin("read only", async (tx) => {
      await tx`SET LOCAL statement_timeout = '15s'`;
      const [identities] = await tx`
        SELECT count(*)::int AS total,
          count(*) FILTER (WHERE e.employment_status = 'active')::int AS active_employee,
          count(*) FILTER (WHERE i.verified_at IS NOT NULL)::int AS verification_timestamp_present,
          count(*) FILTER (WHERE i.external_id ~ '^[0-9]+$')::int AS numeric_external_id,
          count(*) FILTER (WHERE position('@' IN i.external_id) > 0)::int AS email_external_id,
          count(*) FILTER (WHERE e.organization_id <> s.organization_id)::int AS organization_mismatch
        FROM external_identities i
        JOIN employees e ON e.id = i.employee_id
        JOIN data_sources s ON s.id = i.data_source_id
        WHERE s.type = 'zendesk'`;
      const methods = await tx`
        SELECT i.match_method AS method, count(*)::int AS count
        FROM external_identities i JOIN data_sources s ON s.id = i.data_source_id
        WHERE s.type = 'zendesk' GROUP BY i.match_method ORDER BY i.match_method`;
      const [duplicates] = await tx`
        SELECT count(*)::int AS employee_source_pairs_with_multiple_identities FROM (
          SELECT i.data_source_id, i.employee_id
          FROM external_identities i JOIN data_sources s ON s.id = i.data_source_id
          WHERE s.type = 'zendesk'
          GROUP BY i.data_source_id, i.employee_id HAVING count(*) > 1
        ) duplicate_pairs`;
      return { identities, methods, duplicates };
    });
    let vendorVerification;
    if (process.argv.includes("--verify-vendor")) {
      const rows = await client.begin("read only", async (tx) => {
        await tx`SET LOCAL statement_timeout = '15s'`;
        const [sources] =
          await tx`SELECT count(*)::int AS count FROM data_sources WHERE type = 'zendesk'`;
        if (sources!.count !== 1)
          throw new Error("Verification requires one configured Zendesk source");
        return tx`SELECT i.external_id AS email, e.employment_status AS employment
          FROM external_identities i JOIN employees e ON e.id = i.employee_id
          JOIN data_sources s ON s.id = i.data_source_id
          WHERE s.type = 'zendesk' AND e.organization_id = s.organization_id`;
      });
      const { zendeskGet } = await import("../src/lib/connectors/zendesk-shared");
      const results = {
        matched: 0,
        missing: 0,
        ambiguous: 0,
        currentActiveEmployeeAgent: 0,
        suspended: 0,
        inactive: 0,
        unverifiedEmail: 0,
        endUser: 0,
        duplicateNumericId: 0,
      };
      const ids = new Set<number>();
      for (const row of rows) {
        const result = await resolveActionActor(row.email, (path) =>
          zendeskGet(path, undefined, { deferRateLimit: true })
        );
        results[result.status]++;
        if (result.user) {
          const user = result.user;
          if (ids.has(user.id)) results.duplicateNumericId++;
          ids.add(user.id);
          if (user.suspended) results.suspended++;
          if (!user.active) results.inactive++;
          if (!user.verified) results.unverifiedEmail++;
          if (user.role === "end-user") results.endUser++;
          if (
            row.employment === "active" &&
            user.active &&
            !user.suspended &&
            user.role !== "end-user"
          )
            results.currentActiveEmployeeAgent++;
        }
      }
      vendorVerification = { completed: true, ...results };
    }
    const report = {
      observedAt: new Date().toISOString(),
      readOnly: true,
      ...counts,
      vendorVerification,
      limitation: vendorVerification
        ? "Current exact-email Zendesk matches only. Numeric IDs were checked transiently, not persisted. Does not establish historical eligibility, service accounts, or manual human action."
        : "Current Cadence mapping census only; does not verify Zendesk numeric IDs, historical eligibility, service accounts, or manual human action.",
    };
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report));
  } finally {
    await client.end();
  }
}
main().catch(() => {
  console.error("Read-only identity census failed; no credentials or row values logged.");
  process.exitCode = 1;
});

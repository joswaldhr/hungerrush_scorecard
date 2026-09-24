/** Read-only census before enforcing nullable visibility scope uniqueness. */
import { writeFile } from "node:fs/promises";
import postgres from "postgres";

async function main() {
  if (!process.env.DATABASE_URL || !process.argv[2])
    throw new Error("Require database URL and report path");
  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const result = await client.begin("read only", async (tx) => {
      await tx`SET LOCAL statement_timeout = '15s'`;
      const [server] = await tx`SELECT current_setting('server_version_num')::int AS version`;
      const [rows] = await tx`SELECT count(*)::int AS count FROM metric_visibility_overrides`;
      const [duplicates] = await tx`SELECT count(*)::int AS scopes,
        count(*) FILTER (WHERE hidden_values > 1)::int AS conflicting_scopes FROM (
          SELECT count(DISTINCT hidden) AS hidden_values FROM metric_visibility_overrides
          GROUP BY scope, manager_user_id, target_employee_id, metric_definition_id, team_id, line
          HAVING count(*) > 1
        ) duplicates`;
      return {
        serverVersion: server!.version,
        ruleCount: rows!.count,
        duplicateScopes: duplicates!.scopes,
        conflictingScopes: duplicates!.conflicting_scopes,
      };
    });
    const report = { observedAt: new Date().toISOString(), readOnly: true, ...result };
    await writeFile(process.argv[2], `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report));
  } finally {
    await client.end();
  }
}
main().catch(() => {
  console.error("Visibility census failed; no credentials or row values logged.");
  process.exitCode = 1;
});

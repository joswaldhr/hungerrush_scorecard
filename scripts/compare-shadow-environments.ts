/** Compare retained local and hosted observations without copying records or calling the vendor. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import postgres from "postgres";

async function main() {
  const [hostedReport, output] = process.argv.slice(2);
  assert(hostedReport && output);
  const hosted = JSON.parse(await readFile(hostedReport, "utf8"));
  assert(hosted.stagingOnly && hosted.accountBindingMatched && hosted.checkpoints.length === 2);
  const day = hosted.checkpoints[0].start.slice(0, 10);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(day));
  assert(
    hosted.checkpoints.every(
      (row: { status: string; start: string }) =>
        row.status === "complete" && row.start === `${day}T00:00:00.000Z`
    )
  );
  const url = new URL(process.env.LOCAL_SHADOW_DATABASE_URL ?? "");
  assert.equal(url.protocol, "postgresql:");
  assert(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
  assert(/^[a-z0-9_]+_test$/.test(url.pathname.slice(1)) && !url.search);
  const hex = createHash("sha256").update(`local-action-rehearsal:${day}:source`).digest("hex");
  const sourceId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  const sql = postgres(url.toString(), {
    max: 1,
    connection: { default_transaction_read_only: true, statement_timeout: 10_000 },
  });
  try {
    const streams = await sql.begin("read only isolation level repeatable read", async (tx) => {
      const [source] = await tx`select display_name,type from data_sources where id=${sourceId}`;
      assert(source?.display_name === "Local action rehearsal" && source.type === "staging");
      const result = [];
      for (const expected of hosted.checkpoints) {
        assert(["tickets", "legs"].includes(expected.stream));
        const checkpointType =
          expected.stream === "tickets"
            ? "zendesk_ticket_action_checkpoint_v2_shadow"
            : "zendesk_agent_leg_checkpoint_v2_shadow";
        const recordType =
          expected.stream === "tickets"
            ? "zendesk_ticket_action_event_v2_shadow"
            : "zendesk_agent_leg_record_v2_shadow";
        const [checkpoint] =
          await tx`select id,payload_json payload from source_records where data_source_id=${sourceId} and external_record_type=${checkpointType} and external_record_id=${expected.start + "/" + expected.endExclusive}`;
        assert(checkpoint?.payload.status === "complete");
        const [cohort] =
          await tx`select count(*)::int count,md5(coalesce(string_agg(payload_hash,',' order by external_record_id),'')) fingerprint
          from source_records where data_source_id=${sourceId} and external_record_type=${recordType}
          and external_record_id like ${checkpoint.id + ":%"} and occurred_at >= ${expected.start}::timestamptz and occurred_at < ${expected.endExclusive}::timestamptz`;
        result.push({
          stream: expected.stream,
          localRecords: cohort!.count,
          hostedRecords: expected.inPeriodRecords,
          countMatches: cohort!.count === expected.inPeriodRecords,
          fingerprintMatches: cohort!.fingerprint === expected.cohortFingerprint,
        });
      }
      return result;
    });
    const report = {
      observedAt: new Date().toISOString(),
      day,
      databaseWrites: 0,
      vendorRequests: 0,
      streams,
      limitation:
        "Consistency across retained observations using the same source-export model; not independent metric reconciliation or human attribution proof.",
    };
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report));
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error("Retained observation comparison failed; no records or credentials logged.");
  process.exitCode = 1;
});

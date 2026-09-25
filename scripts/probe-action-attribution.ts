/** Read-only, bounded channel-evidence census. No identities or source payloads in output. */
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { parseTicketActionPage } from "../src/lib/connectors/zendesk-ticket-actions";
import { zendeskGet, type RequestStats } from "../src/lib/connectors/zendesk-shared";

const stats: RequestStats = { requests: 0, retries429: 0, backoffWaitMs: 0 };
const via = z.object({
  channel: z.union([z.string(), z.number().int()]).optional(),
  source: z
    .object({ type: z.string().optional(), rel: z.string().nullable().optional() })
    .optional(),
});
const auditSchema = z.object({
  audit: z.object({
    id: z.number().int().positive().safe(),
    ticket_id: z.number().int().positive().safe(),
    author_id: z.number().int().safe(),
    created_at: z.string().datetime({ offset: true }),
    via: via.optional(),
    events: z.array(
      z.object({ id: z.number().int().positive().safe(), type: z.string(), via: via.optional() })
    ),
  }),
});
function bucket(channel: string | number | undefined) {
  return channel === undefined
    ? "missing"
    : typeof channel === "number"
      ? "numeric"
      : ["web", "api", "system", "email", "mobile", "rule"].includes(channel)
        ? channel
        : "other";
}

async function main() {
  const output = process.argv[2];
  if (!output) throw new Error("An output path is required");
  const sampledFrom = process.argv[3]
    ? new Date(z.iso.datetime({ offset: true }).parse(process.argv[3]))
    : new Date(Date.now() - 30 * 60_000);
  if (sampledFrom.getTime() > Date.now() - 120_000)
    throw new Error("Sample start must be older than two minutes");
  const page = parseTicketActionPage(
    await zendeskGet<unknown>(
      `/incremental/ticket_events.json?start_time=${Math.floor(sampledFrom.getTime() / 1000)}&per_page=100`,
      stats
    )
  );
  const candidates = page.ticket_events.filter(
    (event) =>
      event.updater_id !== null &&
      event.updater_id > 0 &&
      event.child_events.some(
        (child) => child.event_type === "Change" || child.comment_present === true
      )
  );
  const ids = [...new Set(candidates.map((event) => event.updater_id!))].slice(0, 100);
  const users = ids.length
    ? z
        .object({
          users: z.array(
            z.object({
              id: z.number().int().positive().safe(),
              role: z.enum(["agent", "admin", "end-user"]),
            })
          ),
        })
        .parse(await zendeskGet<unknown>(`/users/show_many.json?ids=${ids.join(",")}`, stats)).users
    : [];
  const received = new Set(users.map((user) => user.id));
  if (received.size !== users.length || users.some((user) => !ids.includes(user.id)))
    throw new Error("Inconsistent actor lookup");
  const eligible = new Set(users.filter((user) => user.role !== "end-user").map((user) => user.id));
  const sample = candidates.filter((event) => eligible.has(event.updater_id!)).slice(0, 12);
  const auditChannels: Record<string, number> = {};
  const childChannels: Record<string, number> = {};
  let eligibleChanges = 0,
    explicitChildOverrides = 0,
    ruleChanges = 0,
    missingAuditChildren = 0;
  for (const event of sample) {
    const { audit } = auditSchema.parse(
      await zendeskGet<unknown>(`/tickets/${event.ticket_id}/audits/${event.id}.json`, stats)
    );
    if (
      audit.id !== event.id ||
      audit.ticket_id !== event.ticket_id ||
      audit.author_id !== event.updater_id ||
      Date.parse(audit.created_at) !== Date.parse(event.created_at)
    )
      throw new Error("Audit mismatch");
    if (new Set(audit.events.map((child) => child.id)).size !== audit.events.length)
      throw new Error("Duplicate audit child IDs");
    const channel = bucket(audit.via?.channel);
    auditChannels[channel] = (auditChannels[channel] ?? 0) + 1;
    for (const child of event.child_events) {
      if (child.event_type !== "Change" && child.comment_present !== true) continue;
      eligibleChanges++;
      const matched = audit.events.find(
        (row) => row.id === child.id && row.type === child.event_type
      );
      if (!matched) {
        missingAuditChildren++;
        continue;
      }
      if (matched.via) explicitChildOverrides++;
      const evidence = matched.via ?? audit.via;
      const childChannel = bucket(evidence?.channel);
      childChannels[childChannel] = (childChannels[childChannel] ?? 0) + 1;
      if (
        evidence?.channel === "rule" ||
        evidence?.source?.type === "rule" ||
        ["trigger", "automation", "rule"].includes(evidence?.source?.rel ?? "")
      )
        ruleChanges++;
    }
  }
  const report = {
    observedAt: new Date().toISOString(),
    sampledFrom: sampledFrom.toISOString(),
    mode: "read-only bounded sample; no human certification or metric publication",
    sampling:
      "first export page; at most 12 current agent/admin audits; not representative or complete",
    exportedEvents: page.ticket_events.length,
    requestedActors: ids.length,
    unresolvedActors: ids.filter((id) => !received.has(id)).length,
    sampledAudits: sample.length,
    eligibleChanges,
    missingAuditChildren,
    auditChannels,
    childChannels,
    explicitChildOverrides,
    ruleChanges,
    requests: stats,
  };
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
main().catch(() => {
  console.error(
    JSON.stringify({
      status: "failed",
      reason: "Attribution sample incomplete; raw error omitted",
      requests: stats,
    })
  );
  process.exitCode = 1;
});

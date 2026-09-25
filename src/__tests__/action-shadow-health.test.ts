// @vitest-environment node
import { afterAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, dataSources, sourceRecords } from "@/lib/db/schema";
import {
  readActionShadowHealth,
  summarizeActionShadowHealth,
} from "@/lib/connectors/action-shadow-health";

const account = "zendesk-account:synthetic";
const now = new Date("2026-09-24T06:00:00Z");
const tickets = "zendesk_ticket_action_checkpoint_v2_shadow",
  legs = "zendesk_agent_leg_checkpoint_v2_shadow";
function pair(day = 23, status = "complete", updatedAt = new Date("2026-09-24T05:00:00Z")) {
  const start = `2026-09-${day}T00:00:00.000Z`,
    endExclusive = `2026-09-${day + 1}T00:00:00.000Z`;
  return [tickets, legs].map((type) => ({
    type,
    key: `${start}/${endExclusive}`,
    accountReference: account,
    start,
    endExclusive,
    status,
    pages: 3,
    watermark: Date.parse(endExclusive) / 1000,
    notBefore: null as string | null,
    updatedAt,
  }));
}
it("requires both completed streams and never certifies published metrics", () => {
  expect(summarizeActionShadowHealth(pair(), account, now)).toMatchObject({
    status: "current",
    completedDays: 1,
    publicationVerified: false,
    oldestPendingDay: null,
  });
  expect(summarizeActionShadowHealth(pair().slice(0, 1), account, now)).toMatchObject({
    status: "pending",
    completedDays: 0,
  });
  expect(summarizeActionShadowHealth([], account, now)).toMatchObject({
    status: "not_started",
    completedDays: 0,
  });
});
it("detects missing days even if the latest day is complete", () => {
  expect(summarizeActionShadowHealth([...pair(21), ...pair(23)], account, now)).toMatchObject({
    status: "attention",
    reason: "missing_day",
  });
});
it("distinguishes recent progress from three missed hourly opportunities", () => {
  expect(summarizeActionShadowHealth(pair(23, "pending"), account, now)).toMatchObject({
    status: "pending",
  });
  expect(
    summarizeActionShadowHealth(pair(23, "pending", new Date("2026-09-24T02:00:00Z")), account, now)
  ).toMatchObject({ status: "attention", reason: "no_progress" });
});
it("honors persisted retry deadlines without deferring a missing or ready stream", () => {
  const rows = pair(23, "pending", new Date("2026-09-24T02:00:00Z"));
  rows.forEach((row) => (row.notBefore = "2026-09-24T07:00:00Z"));
  expect(summarizeActionShadowHealth(rows, account, now)).toMatchObject({
    status: "pending",
    nextRetryAt: "2026-09-24T07:00:00.000Z",
  });
  expect(summarizeActionShadowHealth(rows.slice(0, 1), account, now)).toMatchObject({
    status: "attention",
    nextRetryAt: null,
  });
});
it("preserves the oldest day's retry deadline when later work is also missing", () => {
  const rows = pair(22, "pending", new Date("2026-09-23T02:00:00Z"));
  rows.forEach((row) => (row.notBefore = "2026-09-24T07:00:00Z"));
  expect(summarizeActionShadowHealth(rows, account, now)).toMatchObject({
    status: "pending",
    oldestPendingDay: "2026-09-22T00:00:00.000Z",
    nextRetryAt: "2026-09-24T07:00:00.000Z",
  });
  expect(
    summarizeActionShadowHealth(
      [...rows, ...pair(23, "pending", new Date("2026-09-24T01:00:00Z"))],
      account,
      now
    )
  ).toMatchObject({ status: "pending", nextRetryAt: "2026-09-24T07:00:00.000Z" });
});

it("allows the new closed-day collection window before declaring no progress", () => {
  const rows = pair(22, "complete", new Date("2026-09-23T02:00:00Z"));
  expect(
    summarizeActionShadowHealth(rows, account, new Date("2026-09-24T00:03:00Z"))
  ).toMatchObject({ status: "pending", oldestPendingDay: "2026-09-23T00:00:00.000Z" });
  expect(summarizeActionShadowHealth(rows, account, now)).toMatchObject({
    status: "attention",
    reason: "no_progress",
  });
});
it("excludes the most recent day until its two-minute source cutoff", () => {
  expect(
    summarizeActionShadowHealth(
      pair(22, "complete", new Date("2026-09-23T02:00:00Z")),
      account,
      new Date("2026-09-24T00:01:00Z")
    )
  ).toMatchObject({ status: "current", expectedThrough: "2026-09-23T00:00:00.000Z" });
});
it.each(["account", "key", "watermark", "type", "status", "time", "duration"])(
  "rejects invalid %s evidence",
  (kind) => {
    const rows = pair();
    const row = rows[0]!;
    if (kind === "account") row.accountReference = "zendesk-account:other";
    if (kind === "key") row.key = "private";
    if (kind === "watermark") row.watermark = 0;
    if (kind === "type") row.type = "private";
    if (kind === "status") row.status = "private";
    if (kind === "time") row.updatedAt = new Date("2026-09-25T00:00:00Z");
    if (kind === "duration") row.endExclusive = "2026-09-25T00:00:00.000Z";
    const result = summarizeActionShadowHealth(rows, account, now);
    expect(result).toMatchObject({ status: "attention", reason: "invalid_checkpoint" });
    expect(JSON.stringify(result)).not.toContain("private");
  }
);
it("does not report duplicate or truncated inventories as current", () => {
  expect(summarizeActionShadowHealth([...pair(), pair()[0]], account, now)).toMatchObject({
    status: "attention",
    reason: "duplicate_stream",
  });
  expect(summarizeActionShadowHealth(Array(1001).fill({}), account, now)).toMatchObject({
    status: "attention",
    reason: "checkpoint_limit",
  });
});

const org = randomUUID(),
  source = randomUUID();
afterAll(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, source));
  await db.delete(dataSources).where(eq(dataSources.id, source));
  await db.delete(organizations).where(eq(organizations.id, org));
});
it("reads only owned bound checkpoints, ignores re-observations and never mutates them", async () => {
  await db.insert(organizations).values({ id: org, name: "Synthetic checkpoint health" });
  await db.insert(dataSources).values({
    id: source,
    organizationId: org,
    type: "staging",
    displayName: "Synthetic health",
    configurationReference: account,
  });
  for (const row of pair())
    await db.insert(sourceRecords).values({
      dataSourceId: source,
      externalRecordType: row.type,
      externalRecordId: row.key,
      payloadJson: { ...row, private: "must not escape", path: "private continuation" },
      payloadHash: "fixture",
      ingestedAt: row.updatedAt,
    });
  await db.insert(sourceRecords).values({
    dataSourceId: source,
    externalRecordType: tickets,
    externalRecordId: `${pair()[0]!.key}/observation/${randomUUID()}`,
    payloadJson: { private: "unrelated observation" },
    payloadHash: "fixture",
  });
  const before = await db
    .select()
    .from(sourceRecords)
    .where(eq(sourceRecords.dataSourceId, source));
  const result = await readActionShadowHealth(org, source, account, now);
  expect(result).toMatchObject({ status: "current", completedDays: 1 });
  expect(JSON.stringify(result)).not.toContain("private");
  await expect(readActionShadowHealth(randomUUID(), source, account, now)).rejects.toThrow(
    "binding"
  );
  await expect(readActionShadowHealth(org, source, "zendesk-account:other", now)).rejects.toThrow(
    "binding"
  );
  expect(
    await db.select().from(sourceRecords).where(eq(sourceRecords.dataSourceId, source))
  ).toEqual(before);
  await db.update(dataSources).set({ status: "disabled" }).where(eq(dataSources.id, source));
  expect(await readActionShadowHealth(org, source, account, now)).toMatchObject({
    status: "disabled",
    publicationVerified: false,
  });
});

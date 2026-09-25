// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, dataSources, sourceRecords } from "@/lib/db/schema";
import { advanceTicketActionExport } from "@/lib/connectors/ticket-action-checkpoint";
import { captureActionAuditEvidence } from "@/lib/connectors/action-audit-evidence";

const organizationId = randomUUID(),
  dataSourceId = randomUUID();
const accountReference = "zendesk-account:synthetic";
const scope = {
  organizationId,
  dataSourceId,
  accountReference,
  start: new Date("2026-09-13T00:00:00Z"),
  endExclusive: new Date("2026-09-20T00:00:00Z"),
};
const event = {
  id: 1,
  ticket_id: 10,
  updater_id: 42,
  created_at: "2026-09-16T12:00:00Z",
  child_events: [
    { id: 100, event_type: "Change", status: "solved", previous_value: "open" },
    { id: 101, event_type: "Comment", comment_present: true },
  ],
};
const response = () => ({
  audit: {
    id: 1,
    ticket_id: 10,
    author_id: 42,
    created_at: event.created_at,
    via: { channel: "web", source: { from: { email: "private@example.test" } } },
    metadata: { private: "private metadata" },
    events: [
      {
        id: 100,
        type: "Change",
        field_name: "status",
        value: "solved",
        previous_value: "open",
        via: {
          channel: "rule",
          source: { rel: "automation", type: "rule", title: "private title" },
        },
      },
      { id: 101, type: "Comment", body: "private comment", value: "private field" },
    ],
  },
});
const evidenceFilter = and(
  eq(sourceRecords.dataSourceId, dataSourceId),
  eq(sourceRecords.externalRecordType, "zendesk_action_audit_evidence_v2_shadow")
);
const eventFilter = and(
  eq(sourceRecords.dataSourceId, dataSourceId),
  eq(sourceRecords.externalRecordType, "zendesk_ticket_action_event_v2_shadow")
);
const checkpointFilter = and(
  eq(sourceRecords.dataSourceId, dataSourceId),
  eq(sourceRecords.externalRecordType, "zendesk_ticket_action_checkpoint_v2_shadow")
);
async function complete(observationId?: string) {
  await advanceTicketActionExport(
    { ...scope, workerAccountReference: accountReference, observationId },
    async () => ({
      ticket_events: [event],
      count: 1,
      end_time: scope.endExclusive.getTime() / 1000,
      end_of_stream: true,
      next_page: null,
    })
  );
}
beforeAll(async () => {
  await db.insert(organizations).values({ id: organizationId, name: "Synthetic audit evidence" });
  await db.insert(dataSources).values({
    id: dataSourceId,
    organizationId,
    type: "staging",
    displayName: "Synthetic audit evidence",
    configurationReference: accountReference,
  });
});
beforeEach(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, dataSourceId));
  await db
    .update(dataSources)
    .set({ configurationReference: accountReference, status: "configured" })
    .where(eq(dataSources.id, dataSourceId));
  await complete();
});
afterAll(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, dataSourceId));
  await db.delete(dataSources).where(eq(dataSources.id, dataSourceId));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
});

it("retains source-bound child overrides, strips private content and replays without fetching", async () => {
  const get = vi.fn().mockResolvedValue(response());
  const saved = await captureActionAuditEvidence(scope, 1, get);
  expect(get).toHaveBeenCalledWith("/tickets/10/audits/1.json");
  expect(saved).toMatchObject({
    accountReference,
    historicalEligibility: "unknown",
    humanActivityAttribution: "unknown",
  });
  expect(saved.audit.via?.channel).toBe("web");
  expect(saved.audit.children[0]).toMatchObject({
    id: 100,
    hasViaOverride: true,
    via: { channel: "rule", relation: "automation", sourceType: "rule" },
    statusBefore: "open",
    statusAfter: "solved",
  });
  expect(saved.audit.children[1]).toMatchObject({
    id: 101,
    via: null,
    hasViaOverride: false,
    statusBefore: null,
  });
  expect(JSON.stringify(saved)).not.toContain("private");
  const noFetch = vi.fn();
  expect(await captureActionAuditEvidence(scope, 1, noFetch)).toEqual(saved);
  expect(noFetch).not.toHaveBeenCalled();
  expect(await db.select().from(sourceRecords).where(evidenceFilter)).toHaveLength(1);
});

it.each([
  "id",
  "ticket_id",
  "created_at",
  "child_missing",
  "child_duplicate",
  "child_type",
  "status",
  "previous_status",
])("rejects mismatched %s without retaining evidence", async (kind) => {
  const data = response();
  if (kind === "id") data.audit.id = 2;
  if (kind === "ticket_id") data.audit.ticket_id = 20;
  if (kind === "created_at") data.audit.created_at = "2026-09-16T12:01:00Z";
  if (kind === "child_missing") data.audit.events.pop();
  if (kind === "child_duplicate") data.audit.events.push(data.audit.events[0]!);
  if (kind === "child_type") data.audit.events[0]!.type = "Comment";
  if (kind === "status") data.audit.events[0]!.value = "open";
  if (kind === "previous_status") data.audit.events[0]!.previous_value = "pending";
  await expect(captureActionAuditEvidence(scope, 1, async () => data)).rejects.toThrow("match");
  expect(await db.select().from(sourceRecords).where(evidenceFilter)).toHaveLength(0);
});

it("retains an author/updater disagreement as unknown evidence, never as a verified actor", async () => {
  const data = response();
  data.audit.author_id = 99;
  const saved = await captureActionAuditEvidence(scope, 1, async () => data);
  expect(saved.audit).toMatchObject({
    actorId: 99,
    retainedUpdaterId: 42,
    actorMatchesUpdater: false,
  });
  expect(saved.humanActivityAttribution).toBe("unknown");
  expect(saved.historicalEligibility).toBe("unknown");
  const noFetch = vi.fn();
  expect(await captureActionAuditEvidence(scope, 1, noFetch)).toEqual(saved);
  expect(noFetch).not.toHaveBeenCalled();
});

it("rejects foreign, unbound, incomplete and wrong-observation requests before fetching", async () => {
  const get = vi.fn();
  await expect(
    captureActionAuditEvidence({ ...scope, organizationId: randomUUID() }, 1, get)
  ).rejects.toThrow("permitted");
  await expect(
    captureActionAuditEvidence({ ...scope, accountReference: "zendesk-account:other" }, 1, get)
  ).rejects.toThrow("binding");
  await expect(
    captureActionAuditEvidence({ ...scope, observationId: randomUUID() }, 1, get)
  ).rejects.toThrow("checkpoint");
  const [checkpoint] = await db.select().from(sourceRecords).where(checkpointFilter);
  await db
    .update(sourceRecords)
    .set({ payloadJson: { ...(checkpoint!.payloadJson as object), status: "pending" } })
    .where(checkpointFilter);
  await expect(captureActionAuditEvidence(scope, 1, get)).rejects.toThrow("checkpoint");
  expect(get).not.toHaveBeenCalled();
});

it.each(["disable", "rebind", "event"])(
  "rejects %s during the fetch without saving partial evidence",
  async (kind) => {
    await expect(
      captureActionAuditEvidence(scope, 1, async () => {
        if (kind === "disable")
          await db
            .update(dataSources)
            .set({ status: "disabled" })
            .where(eq(dataSources.id, dataSourceId));
        if (kind === "rebind")
          await db
            .update(dataSources)
            .set({ configurationReference: "zendesk-account:other" })
            .where(eq(dataSources.id, dataSourceId));
        if (kind === "event") {
          const [record] = await db.select().from(sourceRecords).where(eventFilter);
          await db
            .update(sourceRecords)
            .set({ payloadJson: { ...(record!.payloadJson as object), updater_id: 43 } })
            .where(eventFilter);
        }
        return response();
      })
    ).rejects.toThrow(/permitted|binding|changed/);
    expect(await db.select().from(sourceRecords).where(evidenceFilter)).toHaveLength(0);
  }
);

it("keeps separate re-observations isolated even when they contain the same event", async () => {
  const original = await captureActionAuditEvidence(scope, 1, async () => response());
  const observationId = randomUUID();
  await complete(observationId);
  const revised = await captureActionAuditEvidence({ ...scope, observationId }, 1, async () =>
    response()
  );
  expect(revised.checkpointId).not.toBe(original.checkpointId);
  expect(revised.sourceEventRecordId).not.toBe(original.sourceEventRecordId);
  expect(await db.select().from(sourceRecords).where(evidenceFilter)).toHaveLength(2);
});

it("retains one immutable winner for concurrent matching captures", async () => {
  let arrived = 0,
    release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const get = async () => {
    if (++arrived === 2) release();
    await barrier;
    return response();
  };
  const [first, second] = await Promise.all([
    captureActionAuditEvidence(scope, 1, get),
    captureActionAuditEvidence(scope, 1, get),
  ]);
  expect(first).toEqual(second);
  expect(await db.select().from(sourceRecords).where(evidenceFilter)).toHaveLength(1);
});

it("rejects conflicting concurrent evidence and preserves the winner", async () => {
  let arrived = 0,
    release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const get = async () => {
    const ordinal = ++arrived;
    if (arrived === 2) release();
    await barrier;
    const data = response();
    data.audit.via.channel = ordinal === 1 ? "web" : "api";
    return data;
  };
  const results = await Promise.allSettled([
    captureActionAuditEvidence(scope, 1, get),
    captureActionAuditEvidence(scope, 1, get),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  expect(await db.select().from(sourceRecords).where(evidenceFilter)).toHaveLength(1);
});

// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, dataSources, sourceRecords } from "@/lib/db/schema";
import { SourceRetryLaterError } from "@/lib/connectors/source-retry";
import {
  advanceTicketActionExport,
  readTicketActionExport,
} from "@/lib/connectors/ticket-action-checkpoint";

const organizationId = randomUUID();
const dataSourceId = randomUUID();
const scope = {
  organizationId,
  dataSourceId,
  start: new Date("2026-09-20T00:00:00Z"),
  endExclusive: new Date("2026-09-27T00:00:00Z"),
};
const event = (id: number, updater_id = 42) => ({
  id,
  ticket_id: id,
  updater_id,
  created_at: "2026-09-21T00:00:00Z",
  child_events: [
    {
      id: id + 100,
      event_type: "Change",
      status: "solved",
      previous_value: "open",
      subject: "private subject",
    },
  ],
});
const page = (events: unknown[], complete = false) => ({
  ticket_events: events,
  count: events.length,
  end_time: (complete ? scope.endExclusive : new Date("2026-09-22T00:00:00Z")).getTime() / 1000,
  end_of_stream: complete,
  next_page: complete ? null : "/next-page",
});

beforeAll(async () => {
  await db.insert(organizations).values({ id: organizationId, name: "Synthetic checkpoint test" });
  await db.insert(dataSources).values({
    id: dataSourceId,
    organizationId,
    type: "staging",
    displayName: "Synthetic event source",
  });
});
beforeEach(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, dataSourceId));
});

it("persists the retry window across invocations and resumes the same cursor afterward", async () => {
  const first = await advanceTicketActionExport(scope, async () => {
    throw new SourceRetryLaterError(46000);
  });
  expect(first.state.pages).toBe(0);
  expect(first.state.notBefore).not.toBeNull();
  const blocked = vi.fn();
  await advanceTicketActionExport(scope, blocked);
  expect(blocked).not.toHaveBeenCalled();
  // Move only the application's clock forward; database I/O and timers remain real.
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse(first.state.notBefore!) + 1);
  try {
    const resumed = vi.fn().mockResolvedValue(page([event(1)], true));
    await advanceTicketActionExport(scope, resumed);
    expect(resumed).toHaveBeenCalledWith(first.state.path);
    expect((await readTicketActionExport(scope)).state.notBefore).toBeNull();
  } finally {
    clock.mockRestore();
  }
});
afterAll(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, dataSourceId));
  await db.delete(dataSources).where(eq(dataSources.id, dataSourceId));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
});

it("resumes persisted progress after a failed fetch and exposes only a complete cohort", async () => {
  expect((await readTicketActionExport(scope)).cohort).toBeNull();
  expect(
    await db.select().from(sourceRecords).where(eq(sourceRecords.dataSourceId, dataSourceId))
  ).toHaveLength(0);
  await advanceTicketActionExport(scope, async () => page([event(1)]));
  expect((await readTicketActionExport(scope)).cohort).toBeNull();
  const failed = vi.fn().mockRejectedValue(new Error("Synthetic rate limit"));
  await expect(advanceTicketActionExport(scope, failed)).rejects.toThrow("rate limit");
  expect(failed).toHaveBeenCalledWith("/next-page");
  const resumed = vi.fn().mockResolvedValue(page([event(1), event(2)], true));
  await advanceTicketActionExport(scope, resumed);
  expect(resumed).toHaveBeenCalledWith("/next-page");
  const result = await readTicketActionExport(scope);
  expect(result.state.pages).toBe(2);
  expect(result.cohort?.events.map((row) => row.id).sort()).toEqual([1, 2]);
  const stored = await db
    .select()
    .from(sourceRecords)
    .where(eq(sourceRecords.dataSourceId, dataSourceId));
  expect(stored).toHaveLength(3);
  expect(JSON.stringify(stored)).not.toContain("private subject");
  const noFetch = vi.fn();
  expect((await advanceTicketActionExport(scope, noFetch)).advanced).toBe(false);
  expect(noFetch).not.toHaveBeenCalled();
});

it("detects pagination cycles across separate worker invocations", async () => {
  await advanceTicketActionExport(scope, async () => page([event(1)]));
  await advanceTicketActionExport(scope, async () => page([event(1)]));
  const get = vi.fn();
  await expect(advanceTicketActionExport(scope, get)).rejects.toThrow("stalled");
  expect(get).not.toHaveBeenCalled();
  expect((await readTicketActionExport(scope)).cohort).toBeNull();
});

it("discards a stale competing fetch without duplicating records or advancing twice", async () => {
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const get = async () => {
    if (++arrivals === 2) release();
    await gate;
    return page([event(1)]);
  };
  const results = await Promise.all([
    advanceTicketActionExport(scope, get),
    advanceTicketActionExport(scope, get),
  ]);
  expect(results.filter((result) => result.advanced)).toHaveLength(1);
  expect((await readTicketActionExport(scope)).state.pages).toBe(1);
  expect(
    await db.select().from(sourceRecords).where(eq(sourceRecords.dataSourceId, dataSourceId))
  ).toHaveLength(2);
});

it("rejects conflicting event history without moving the checkpoint", async () => {
  await advanceTicketActionExport(scope, async () => page([event(1)]));
  await expect(
    advanceTicketActionExport(scope, async () => page([event(2), event(1, 84)], true))
  ).rejects.toThrow("Conflicting");
  expect((await readTicketActionExport(scope)).state.pages).toBe(1);
  expect(
    await db.select().from(sourceRecords).where(eq(sourceRecords.dataSourceId, dataSourceId))
  ).toHaveLength(2);
});

it("allows a lagging provider boundary to be retried without reporting zero", async () => {
  await advanceTicketActionExport(scope, async () => ({ ...page([]), end_of_stream: true }));
  expect(await readTicketActionExport(scope)).toMatchObject({
    state: { status: "waiting" },
    cohort: null,
  });
  await advanceTicketActionExport(scope, async () => page([event(1)], true));
  expect((await readTicketActionExport(scope)).cohort?.events).toHaveLength(1);
});

it("rejects another organization's source before invoking the vendor", async () => {
  const get = vi.fn();
  await expect(
    advanceTicketActionExport({ ...scope, organizationId: randomUUID() }, get)
  ).rejects.toThrow("not permitted");
  expect(get).not.toHaveBeenCalled();
});

it("rolls event inserts back if the checkpoint write fails", async () => {
  const name = `checkpoint_fail_${dataSourceId.replaceAll("-", "")}`;
  // This suite runs only against the loopback test DB guarded by vitest.config.mts.
  await db.execute(
    sql.raw(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.data_source_id = '${dataSourceId}' AND NEW.external_record_type = 'zendesk_ticket_action_checkpoint_v2_shadow' THEN
      RAISE EXCEPTION 'Synthetic checkpoint failure';
    END IF; RETURN NEW; END $$`)
  );
  try {
    await db.execute(
      sql.raw(
        `CREATE TRIGGER ${name} BEFORE UPDATE ON source_records FOR EACH ROW EXECUTE FUNCTION ${name}()`
      )
    );
    await expect(
      advanceTicketActionExport(scope, async () => page([event(1)], true))
    ).rejects.toThrow();
    expect((await readTicketActionExport(scope)).state.pages).toBe(0);
    expect(
      await db.select().from(sourceRecords).where(eq(sourceRecords.dataSourceId, dataSourceId))
    ).toHaveLength(1);
  } finally {
    await db.execute(sql.raw(`DROP TRIGGER IF EXISTS ${name} ON source_records`));
    await db.execute(sql.raw(`DROP FUNCTION IF EXISTS ${name}()`));
  }
  await advanceTicketActionExport(scope, async () => page([event(1)], true));
  expect((await readTicketActionExport(scope)).cohort?.events).toHaveLength(1);
});

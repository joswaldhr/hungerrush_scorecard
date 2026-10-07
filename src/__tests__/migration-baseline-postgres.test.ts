// @vitest-environment node
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  adoptFactIdentityBaseline,
  readBaselineEntries,
  type BaselineEntry,
} from "../../scripts/migration-baseline";

let admin: postgres.Sql;
let client: postgres.Sql;
let database: string;
let entries: BaselineEntry[];

beforeEach(async () => {
  const url = new URL(process.env.TEST_DATABASE_URL ?? "");
  assert(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  assert(url.pathname.endsWith("_test"), "Require explicit isolated test database");
  assert(!url.search, "No endpoint overrides");
  database = `cadence_baseline_${randomUUID().replaceAll("-", "")}_test`;
  admin = postgres(url.toString(), { max: 1 });
  await admin.unsafe(`create database "${database}"`);
  url.pathname = `/${database}`;
  client = postgres(url.toString(), { max: 2 });
  entries = await readBaselineEntries("drizzle");
  await client`create schema drizzle`;
  await client`create table drizzle.__drizzle_migrations
    (id serial primary key, hash text not null, created_at bigint)`;
  for (const entry of entries.filter((entry) => entry.tag !== "0009_fact_identity")) {
    await client`insert into drizzle.__drizzle_migrations(hash,created_at)
      values (${entry.lfHash},${entry.when})`;
  }
  await client`create table normalized_facts
    (source_record_id uuid not null, fact_type text not null,
    source_observed_at timestamptz not null, numeric_value numeric)`;
  await client`create unique index normalized_facts_identity_idx
    on normalized_facts(source_record_id,fact_type)`;
  await client`create table metric_definitions
    (team_aggregation text not null default 'simple_average')`;
  await client`insert into normalized_facts values
    (${randomUUID()},'synthetic','2026-10-05T00:00:00Z',42)`;
  await client`insert into metric_definitions default values`;
});
afterEach(async () => {
  if (client) await client.end();
  if (admin) {
    assert(/^cadence_baseline_[a-f0-9]{32}_test$/.test(database));
    await admin.unsafe(`drop database "${database}"`);
    await admin.end();
  }
});
const journal = () => client`select hash,created_at from drizzle.__drizzle_migrations
  order by created_at`;
const application = async () => ({
  facts: await client`select * from normalized_facts`,
  definitions: await client`select * from metric_definitions`,
});

describe("transactional migration baseline adoption", () => {
  it("adds exactly one known journal row, preserves application data and is idempotent", async () => {
    const before = await application();
    const priorJournal = await journal();
    expect(await adoptFactIdentityBaseline(client, entries)).toMatchObject({
      adopted: true,
      journalRowsAdded: 1,
      applicationRowsChanged: 0,
      historicalCleanupProven: false,
    });
    expect(await application()).toEqual(before);
    const after = await journal();
    expect(after).toHaveLength(priorJournal.length + 1);
    for (const row of priorJournal) expect(after).toContainEqual(row);
    expect(await adoptFactIdentityBaseline(client, entries)).toMatchObject({ adopted: false });
    expect(await journal()).toEqual(after);
  });
  it("serializes concurrent adoption attempts without duplicate rows", async () => {
    const results = await Promise.all([
      adoptFactIdentityBaseline(client, entries),
      adoptFactIdentityBaseline(client, entries),
    ]);
    expect(results.filter((result) => result.adopted)).toHaveLength(1);
    expect(await journal()).toHaveLength(entries.length);
  });
  it("rolls back on an incompatible observation type", async () => {
    await client`alter table normalized_facts alter column source_observed_at
      type timestamp using source_observed_at at time zone 'UTC'`;
    const before = await journal();
    await expect(adoptFactIdentityBaseline(client, entries)).rejects.toThrow();
    expect(await journal()).toEqual(before);
  });
  it("refuses an index with an extra included column", async () => {
    await client`drop index normalized_facts_identity_idx`;
    await client`create unique index normalized_facts_identity_idx
      on normalized_facts(source_record_id,fact_type) include(numeric_value)`;
    const before = await journal();
    await expect(adoptFactIdentityBaseline(client, entries)).rejects.toThrow();
    expect(await journal()).toEqual(before);
  });
  it("refuses incompatible defaults and leaves the journal unchanged", async () => {
    await client`alter table metric_definitions alter column team_aggregation set default 'sum'`;
    const before = await journal();
    await expect(adoptFactIdentityBaseline(client, entries)).rejects.toThrow();
    expect(await journal()).toEqual(before);
  });
  it("refuses an unknown stored hash", async () => {
    await client`update drizzle.__drizzle_migrations set hash='unknown' where id=1`;
    const before = await journal();
    await expect(adoptFactIdentityBaseline(client, entries)).rejects.toThrow();
    expect(await journal()).toEqual(before);
  });
});

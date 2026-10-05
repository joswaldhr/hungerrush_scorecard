/** Explicit adoption of an already-present 0009 schema; never replays its data cleanup. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type postgres from "postgres";

export type BaselineEntry = { tag: string; when: number; lfHash: string; crlfHash: string };
export type AppliedEntry = { hash: string; created_at: number | string };

export async function readBaselineEntries(folder: string): Promise<BaselineEntry[]> {
  const journal = JSON.parse(await readFile(path.join(folder, "meta/_journal.json"), "utf8"));
  return Promise.all(
    journal.entries.map(async (entry: { tag: string; when: number }) => {
      const text = (await readFile(path.join(folder, `${entry.tag}.sql`), "utf8")).replaceAll(
        "\r\n",
        "\n"
      );
      const hash = (value: string) => createHash("sha256").update(value).digest("hex");
      return { ...entry, lfHash: hash(text), crlfHash: hash(text.replaceAll("\n", "\r\n")) };
    })
  );
}

export function planBaselineAdoption(expected: BaselineEntry[], applied: AppliedEntry[]) {
  assert(expected.length && applied.length, "Require a populated known baseline");
  assert.equal(new Set(expected.map((entry) => entry.when)).size, expected.length);
  const seen = new Set<number>();
  for (const row of applied) {
    const when = Number(row.created_at);
    const entry = expected.find((candidate) => candidate.when === when);
    assert(entry && Number.isSafeInteger(when), "Unknown migration timestamp");
    assert(!seen.has(when), "Duplicate migration timestamp");
    assert([entry.lfHash, entry.crlfHash].includes(row.hash), "Unknown migration hash");
    seen.add(when);
  }
  const latest = Math.max(...seen);
  const missing = expected.filter((entry) => entry.when <= latest && !seen.has(entry.when));
  if (!missing.length) return null;
  assert.equal(missing.length, 1, "Refuse multiple journal gaps");
  assert.equal(missing[0]!.tag, "0009_fact_identity", "Only documented 0009 adoption is supported");
  return missing[0]!;
}

/** Caller owns exact-candidate, backup and release gates. No production caller is installed.
 * Returned receipt describes present-schema adoption, not proof of historical cleanup.
 */
export async function adoptFactIdentityBaseline(client: postgres.Sql, expected: BaselineEntry[]) {
  return client.begin(async (tx) => {
    await tx`set local lock_timeout = '5s'`;
    await tx`set local statement_timeout = '30s'`;
    await tx`lock table drizzle.__drizzle_migrations in share row exclusive mode`;
    await tx`lock table normalized_facts, metric_definitions in share mode`;
    const applied = await tx<AppliedEntry[]>`select hash, created_at
      from drizzle.__drizzle_migrations order by created_at, id`;
    const missing = planBaselineAdoption(expected, applied);
    if (!missing) return { adopted: false, applicationRowsChanged: 0 };
    const [schema] = await tx`select
      exists(select 1 from information_schema.columns where table_schema='public'
        and table_name='normalized_facts' and column_name='source_record_id'
        and data_type='uuid' and is_nullable='NO') as source_identity,
      exists(select 1 from information_schema.columns where table_schema='public'
        and table_name='normalized_facts' and column_name='source_observed_at'
        and data_type='timestamp with time zone' and is_nullable='NO') as observation,
      exists(select 1 from pg_index i join pg_class c on c.oid=i.indexrelid
        join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname='normalized_facts_identity_idx'
        and i.indrelid='public.normalized_facts'::regclass
        and i.indisunique and i.indisvalid and i.indisready
        and i.indpred is null and i.indexprs is null
        and i.indnkeyatts=2 and i.indnatts=2
        and pg_get_indexdef(i.indexrelid,1,true)='source_record_id'
        and pg_get_indexdef(i.indexrelid,2,true)='fact_type') as unique_identity,
      exists(select 1 from information_schema.columns where table_schema='public'
        and table_name='metric_definitions' and column_name='team_aggregation'
        and data_type='text' and is_nullable='NO'
        and column_default='''simple_average''::text') as aggregation`;
    assert(
      schema && Object.values(schema).every((value) => value === true),
      "Present schema does not satisfy the adopted migration contract"
    );
    const inserted = await tx`insert into drizzle.__drizzle_migrations (hash,created_at)
      values (${missing.lfHash},${missing.when}) returning id`;
    assert.equal(inserted.length, 1);
    const after = await tx<AppliedEntry[]>`select hash,created_at
      from drizzle.__drizzle_migrations order by created_at,id`;
    assert.equal(planBaselineAdoption(expected, after), null);
    assert.equal(after.length, applied.length + 1);
    return {
      adopted: true,
      tag: missing.tag,
      hash: missing.lfHash,
      journalRowsAdded: 1,
      applicationRowsChanged: 0,
      historicalCleanupProven: false,
    };
  });
}

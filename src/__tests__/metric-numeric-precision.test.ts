// @vitest-environment node
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { expect, it } from "vitest";
import { assertLocalFixtureDatabase } from "@/lib/fixtures/local-database";

it("widens populated numeric columns without altering prior values, nulls or zero", async () => {
  const url = process.env.DATABASE_URL!;
  assertLocalFixtureDatabase(url);
  const connection = postgres(url, { max: 1 });
  try {
    const migration = await readFile("drizzle/0015_metric_numeric_precision.sql", "utf8");
    await connection.begin(async (tx) => {
      // PostgreSQL resolves these session-local tables before public tables.
      // The actual migration SQL is exercised on synthetic pre-migration data.
      for (const table of ["metric_values", "normalized_facts"]) {
        await tx.unsafe(
          `create temporary table ${table} (id integer primary key, numeric_value real) on commit drop`
        );
        await tx.unsafe(
          `insert into ${table} values (1,null), (2,0), (3,100.0/3), (4,100), (5,16777217), (6,-0.25)`
        );
      }
      const before =
        await tx`select id, numeric_value::double precision as value from metric_values order by id`;
      for (const statement of migration.split("--> statement-breakpoint"))
        await tx.unsafe(statement);
      for (const table of ["metric_values", "normalized_facts"]) {
        expect(
          await tx.unsafe(`select id, numeric_value as value from ${table} order by id`)
        ).toEqual(before);
        await tx.unsafe(`insert into ${table} (id, numeric_value) values (7,$1)`, [100 / 3]);
        const [fraction] = await tx.unsafe(
          `select numeric_value as value from ${table} where id=7`
        );
        expect(fraction!.value).toBe(100 / 3);
      }
    });
  } finally {
    await connection.end();
  }
});

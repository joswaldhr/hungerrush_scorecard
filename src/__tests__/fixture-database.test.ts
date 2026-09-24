// @vitest-environment node
import { expect, it } from "vitest";
import { assertLocalFixtureDatabase } from "@/lib/fixtures/local-database";

it.each([
  "postgresql://cadence:dev@localhost:5432/cadence",
  "postgres://cadence@127.0.0.1:55439/cadence_test",
  "postgresql://cadence@[::1]/rehearsal_123_test",
])("allows the explicit local fixture destination %s", (url) => {
  expect(() => assertLocalFixtureDatabase(url)).not.toThrow();
});
it.each([
  "postgresql://user:synthetic-secret@metro.proxy.rlwy.net:57223/railway",
  "postgresql://user:synthetic-secret@nozomi.proxy.rlwy.net:24570/railway",
  "postgresql://user:synthetic-secret@127.0.0.1/production",
  "postgresql://user:synthetic-secret@127.0.0.1/cadence_test?host=production.example.invalid",
  "postgresql://user:synthetic-secret@127.0.0.1/cadence_test?options=-c%20search_path%3Dpublic",
  "postgresql://user:synthetic-secret@127.0.0.1/cadence_test#override",
  "invalid-synthetic-secret",
])("rejects unsafe fixture destinations without echoing their credentials (%#)", (url) => {
  try {
    assertLocalFixtureDatabase(url);
    throw new Error("Guard accepted unsafe destination");
  } catch (error) {
    expect((error as Error).message).toContain("Fixture reset requires");
    expect((error as Error).message).not.toContain("synthetic-secret");
  }
});

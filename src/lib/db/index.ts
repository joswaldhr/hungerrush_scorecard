import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DbInstance = PostgresJsDatabase<typeof schema>;

function createDb(): DbInstance {
  const client = postgres(process.env.DATABASE_URL!);
  return drizzle(client, { schema });
}

const globalForDb = globalThis as unknown as { _cadenceDb?: DbInstance };

// Lazy proxy: the postgres connection is only created on first property access,
// not during Next.js build-time module resolution.
export const db: DbInstance = new Proxy({} as DbInstance, {
  get(_, prop) {
    const instance = (globalForDb._cadenceDb ??= createDb());
    const val = (instance as unknown as Record<string | symbol, unknown>)[prop];
    return typeof val === "function" ? (val as Function).bind(instance) : val;
  },
});

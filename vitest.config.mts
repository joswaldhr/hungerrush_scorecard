import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    pool: "threads",
    testTimeout: 10000,
    env: {
      // Always the local/CI test database, never a developer's real .env —
      // integration tests must not touch the shared pilot database.
      // Run `docker compose up -d && pnpm db:migrate` before `pnpm test`.
      DATABASE_URL: "postgresql://cadence:cadence_dev@localhost:5432/cadence",
      AUTH_SECRET: "test-secret-not-for-production-use",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});

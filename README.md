# HungerRush Cadence

Manager performance and 1:1 meeting-preparation application. Brings together employee data from multiple company systems (Zendesk, Assembled, Rippling) into a clear weekly briefing.

## Prerequisites

- Node.js 22+
- pnpm 11+
- PostgreSQL 17 (via Docker Compose or a managed instance)

## Setup

```bash
# Install dependencies
pnpm install

# Copy environment template and fill in values
cp .env.example .env

# Start local Postgres (if using Docker)
docker compose up -d

# Run database migrations
pnpm db:migrate

# Seed pilot data (POS Support + Menufy Support rosters)
pnpm db:seed

# Start dev server
pnpm dev
```

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start Next.js dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm lint` | ESLint + Prettier check |
| `pnpm lint:fix` | Auto-fix lint and formatting |
| `pnpm test` | Run Vitest test suite |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm db:generate` | Generate new migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm db:seed` | Seed database with pilot roster data |
| `pnpm connectors:health` | Check connector API connectivity |

## Architecture

Modular monolith on Next.js App Router. Server Components handle all data access and authorization. Vendor-specific logic is isolated in connectors; the UI reads only Cadence-owned normalized data.

See `docs/ARCHITECTURE.md` for the full reference.

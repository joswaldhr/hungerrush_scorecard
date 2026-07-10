# Architectural Decisions

Append-only. Never delete or edit existing entries.

| Date | Decision | Reason |
|---|---|---|
| Project start | React + Supabase + Railway | Low-ops · modular connectors · strong RLS · fastest path to a working demo |
| Project start | Supabase + Vercel over all-Azure | Company already trusts third-party data tools (Zendesk, Assembled); speed prioritized; IT flagged, stack kept portable in case they require Azure |
| Project start | Express backend scoped to connectors/jobs only | Supabase + RLS handles reads; Express earns its place only for secret-holding scheduled syncs |
| Project start | Redis deferred, not included | Postgres is the cache; frontend reads snapshots, not live APIs. Add Redis only on proven rate-limit pressure |
| Project start | `packages/shared` for domain types + Zod schemas | Single source of truth prevents frontend/backend contract drift |
| Project start | No individual composite score; aggregate trend direction allowed | Coaching-first for individuals; rollup still needs a focus signal that doesn't rank people |
| Project start | Microsoft 365 SSO only | Company standard · no separate passwords |
| Project start | Forethought stubbed as unavailable | API not ready · interface locked for future drop-in |
| Project start | Two data windows (live + snapshot) | Current context + stable record for 1:1 discussion |
| Project start | PDF export must watermark + log to audit_log | A forwardable performance doc outside access controls is a liability for a non-punitive tool |
| Project start | MCP servers deferred to Phase 2+ | Phase 1 needs none; add the Supabase MCP only once the DB exists, and point it at local/staging only — never production |
| 2026-06-24 | Zod schemas are source of truth for domain types | `z.infer` derives TS types from schemas; types.ts holds only connector interfaces that cannot be expressed as Zod |
| 2026-06-24 | ESLint added as dev dependency (not on original approved list) | FRONTEND.md requires a coaching-language lint rule enforced at Phase 1; ESLint + inline plugin is the only way to flag forbidden words in JSXText nodes |
| 2026-06-24 | Microsoft SSO deferred to dedicated session | Requires IT Azure AD app registration access; will be wired once confirmed |

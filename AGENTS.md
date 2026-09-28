# Cadence working safeguards

Read `CLAUDE.md`, `docs/SAFETY_GUARDRAILS.md`, and the current checkpoint at the top of
`docs/audits/2026-09-23-implementation-progress.md` before continuing this project.

- Zendesk is read-only under the user's September 25 instruction. Do not change its
  reports, dashboards, tickets, configuration or permissions. Do not open report or
  dashboard editors even for unsaved inspection: audit editor sessions locked a manager
  out. Use retained downloads and bounded, allowlisted GET APIs.
- Keep tests and synthetic fixtures isolated from production. A merge to `master`
  deploys production; pass the documented technical release gates first.
- Keep unverified human ticket metrics unavailable and ticket-action shadow ingestion,
  action-v2 publication and historical repair disabled. Qualified CSAT/first-reply
  policies are separate; do not change them incidentally.
- Commit only code, synthetic fixtures and aggregate evidence. This repository is public.
- Continue authorized work without routine approval requests. Failed checks stop the
  affected action; keep working on independent safe tasks and report real blockers.

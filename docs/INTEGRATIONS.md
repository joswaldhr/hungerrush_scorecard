# HungerRush Cadence — Integration Rules v0.1

## General

External systems are data sources.

The connector boundary isolates vendor-specific schemas and APIs from Cadence's domain.

Never invent endpoints or fields.

Before implementing a live connector, confirm:
- approved access
- authentication method
- scopes
- exact fields
- historical availability
- rate limits
- pagination
- timezone/period semantics
- privacy/security requirements

## Zendesk

The September 25 user instruction makes this investigation read-only: no account changes
and no report/dashboard editor sessions. Follow [the safety guardrails](SAFETY_GUARDRAILS.md).
Retained evidence and bounded documented GETs are the permitted source surfaces.

The audit branch contains an inactive resumable Talk collector and dedicated outbound
connector. Publication requires a complete joined observation, explicit source/team/key
policy, numeric staff identity resolution and atomic retained revisions. Before activation,
coordinate the legacy Talk reader with the new collector; their separate leases do not yet
establish a shared request budget. The official
[Talk incremental export reference](https://developer.zendesk.com/api-reference/voice/talk-api/incremental_exports/)
specifies ten requests per minute across these endpoints and use of Retry-After on rate
limiting. Exact candidate validation and unresolved scope/export evidence are owned by the
[implementation ledger](audits/2026-09-23-implementation-progress.md).

Expected role:
Support/customer operational source.

Potential data categories:
- ticket activity
- ticket volume
- quality/customer measures
- SLA-related measures
- other approved support metrics

Exact fields and calculations must be verified.

New-hire candidates discovered via Zendesk group diffing are auto-approved unless a circuit
breaker (more than 5 absolute, or more than 30% of the active mapped-team roster, in one run)
trips, in which case the batch falls back to manual review via `/admin/roster-review`.
Departures are never auto-processed. See docs/ARCHITECTURE.md's Roster discovery section.

## Entra ID (Microsoft)

Expected role:
Identity/authentication, not a metric source. Contributes zero metric values.

Live today: the sole SSO provider for production sign-in, via Auth.js (`src/lib/auth/index.ts`,
`next-auth/providers/microsoft-entra-id`). If its env vars are absent in production, the app
refuses to start rather than booting with no working sign-in method.

No Entra roster connector is implemented. Data Health no longer displays the old placeholder
"employees checked / flagged as disabled" counters. It labels source types without a shipped
connector as unsupported and offers no sync action. Entra sign-in remains independent of
roster synchronization.

## Assembled

**Status: Removed.** The Assembled connector code was deleted. The `schedule_adherence`
metric definition still exists (unassigned from both pilot teams). If Assembled is
revisited, start from `docs/ARCHITECTURE.md`'s connector status notes — the Agent State
Mapping configuration issue that prevented meaningful data was never resolved.
Data Health labels its retained source record as retired and preserves historical records.
Manual sync requests for unsupported source types are rejected before fetching or publishing.

## Rippling

**Status: No connector.** No Rippling connector code exists in the codebase. A plain
"Open Rippling" link-out exists on the 1:1s page via `RIPPLING_MANAGER_URL`.

Expected role if integrated:
- employee identity
- manager relationships
- meeting references
- approved meeting context/action items

Do not assume 1:1 content or action-item API access exists. Real API integration is
blocked on HungerRush confirming API access/scopes.

## Identity

Use a canonical Cadence Employee.

External identities map to it.

Preferred matching:
1. authoritative HR ID
2. verified source mapping
3. exact normalized company email
4. manual admin mapping

Do not merge people using fuzzy name matching alone.

## Sync

Syncs should be:
- scheduled/background
- idempotent
- retryable
- observable
- provenance-preserving

A sync failure must not take down the manager UI.

## Freshness

Every source should expose:
- last successful sync
- current sync state
- expected freshness
- errors/warnings

Manager-facing metrics must communicate stale/partial data when relevant.

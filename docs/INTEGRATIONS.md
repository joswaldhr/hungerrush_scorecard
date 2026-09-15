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

Expected role:
Support/customer operational source.

Potential data categories:
- ticket activity
- ticket volume
- quality/customer measures
- SLA-related measures
- other approved support metrics

Exact fields and calculations must be verified.

## Assembled

**Status: Removed.** The Assembled connector code was deleted. The `schedule_adherence`
metric definition still exists (unassigned from both pilot teams). If Assembled is
revisited, start from `docs/ARCHITECTURE.md`'s connector status notes — the Agent State
Mapping configuration issue that prevented meaningful data was never resolved.

## Rippling

**Status: No connector.** No Rippling connector code exists in the codebase. A plain
"Open Rippling" link-out exists on the 1:1 Prep page via `RIPPLING_MANAGER_URL`.

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

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

Expected role:
Workforce/scheduling source.

Potential data categories:
- schedule/adherence/workforce measures
- availability/time measures
- other approved workforce metrics

Exact fields and calculations must be verified.

## Rippling

Expected role:
Employee/organizational and potentially meeting-context source.

Potential data:
- employee identity
- manager relationships
- meeting references
- approved meeting context/action items

Do not assume 1:1 content or action-item API access exists.

If the needed capability is unavailable, use a link-out to Rippling instead.

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

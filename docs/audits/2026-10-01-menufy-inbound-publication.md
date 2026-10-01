# Menufy inbound publisher — October 1

The user authorized completing verification and production delivery. This candidate
implements the missing publication path; it is not yet activated or released.

## Change manifest

- Family: Menufy inbound call participation only. Nine allowed report keys preserve
  offered/accepted/declined/missed/unreachable legs, answer percentage, abandoned
  participating calls, total talk and maximum hold. Existing average keys are not
  replaced by totals or maxima.
- Contract: `zendesk-call-created-agent-leg-inbound-v1`, calculation version 2.
  The earlier `zendesk-inbound-report-v1` audit contract remains blocked.
- Opt-in: private `ZENDESK_INBOUND_REPORT_RELEASE` contains a strict `policy` using
  the existing inbound policy schema and `releaseEvidenceSha256` referring to the
  retained release evidence. A digest is traceability, not automatic certification.
  No real environment value, assignment or release digest has been set by this change.
- Route: authenticated `/api/cron/inbound?week=0..3`, disabled without opt-in, skips
  before the explicit Sunday cutover, requires a matching Talk collection policy,
  and honors the source cooldown. No schedule is added in this candidate.
- Collection: existing account lease/pacing, 22 pages/150 seconds, complete durable
  streams and observation checks, then up to 20 bounded staff GETs/90 seconds.
- Publication: exact fetched-record digest plus revalidation of active employees,
  source identity and effective definitions/assignments inside the write transaction.
  A short SHARE table lock fences configuration/identity changes including newly
  inserted assignments; lock acquisition times out at five seconds. Review hosted
  latency before enabling this publisher. These locks run only for its explicit opt-in.
- Replacement: one complete employee-period snapshot supersedes only legacy
  `call_stats` for its allowed keys. Later legacy refresh cannot add old counts back.
  Raw predecessor records and revisions remain; null corrections retract values,
  measured zeros stay numeric, and new definition/scope comparisons and targets
  remain withheld under the existing reader safeguards.
- Presentation: explanations distinguish offers from calls, participation from
  responsibility, SUM/MAX from averages and missing measurements from zero. Duration
  sample coverage survives into the common source context used by views and exports.

## Verification status

Local typecheck and 29 targeted calculator, route, contract and containment tests
pass. PostgreSQL tests cover successful replacement, later legacy refresh, null/zero
corrections, changed configuration, required transaction validation and concurrent
assignment fencing. Exact-candidate full CI/build results remain pending.

## Release gates still open

Additional period/current coverage reconciliation; production assignment manifest;
hosted synthetic scorecard/export and recovery verification; exact rollback reference;
scoped production canary; actual scheduled operation. No production merge or activation
is justified by the local tests alone. Historical repair remains disabled, the demo
stays frozen, and human ticket attribution and historical state-time sources remain
separate unresolved requirements. No Zendesk changes or new source reads were performed.

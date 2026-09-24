# Documentation ownership

Use one owner for each decision. Repository implementation and dated deployment evidence must
be distinguished: an audit-branch fix is not automatically a production fix.

| Document | Owns |
|---|---|
| [CLAUDE.md](../CLAUDE.md) | Concise engineering rules and change discipline |
| [PRODUCT.md](PRODUCT.md) | Product purpose, supported manager journey and explicit scope decisions |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Module boundaries, active data flows and integration structure |
| [DATA_MODEL.md](DATA_MODEL.md), [schema](../src/lib/db/schema.ts) | Data relationships and executable schema/invariants |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Shared UI tokens, components and interaction conventions |
| [METRIC_REGISTRY.md](METRIC_REGISTRY.md) | Metric configuration reference, with explicit current-policy notes and historical limitations |
| [METRIC_TRACEABILITY.md](METRIC_TRACEABILITY.md) | Source-to-display paths and known semantic gaps |
| [INTEGRATIONS.md](INTEGRATIONS.md) | Verified vendor interfaces, identity requirements and unresolved source behavior |
| [RUNBOOK.md](RUNBOOK.md) | Safe validation, deployment and recovery procedures |
| [Implementation ledger](audits/2026-09-23-implementation-progress.md) | Active audit branch, accepted process, completed checks and remaining release gates |
| [Contract audit](audits/2026-09-23-metric-contracts.md) | September 23 inventory and observed/proposed contract differences |
| [Action contract](audits/2026-09-23-action-metric-v2-contract.md) | Approved human-only policy and version-2 shadow evidence/activation requirements |

The [application audit](audits/2026-09-23-application-audit.md) is the historical baseline
and roadmap. Dated JSON reports support only their stated cohort, environment and time.
HANDOFF, INVESTIGATION, FIX_LOG, MVP and BUILD_SPEC retain earlier decisions and investigations;
they do not override later product decisions or the current implementation ledger. Do not
interpret an old “complete” statement as the current overhaul's release status.

When changing behavior, update its owner and record the validation in the ledger. Link to
source evidence instead of copying long incident histories into CLAUDE.md. Keep uncertainty
explicit, and mark superseded sections before relying on a contradictory older claim.

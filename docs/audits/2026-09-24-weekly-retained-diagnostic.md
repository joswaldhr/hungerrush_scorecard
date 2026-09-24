# Closed-week collection and account coverage

The September 13–19 observation completed locally on September 24 without publishing
metrics. The account census reproduced an incomplete default lookup: one requested
account was omitted. Repeating that batch with `include_deleted=true` returned all
100 accounts. Zendesk documents that option as including inactive or deleted users;
it does not establish which condition applies or the account's historical role.
[Zendesk Show Many Users](https://developer.zendesk.com/api-reference/ticketing/users/users/#show-many-users)

| Check | Result |
|---|---|
| Retained ticket events in the interval | 85,066 across 88 export pages |
| Retained call legs in the interval | 17,172 across 32 export pages |
| Collection execution | 24 fresh processes; 128 GET requests; checkpoint continuity verified |
| Account inventory | 10,607 distinct positive IDs; six bounded processes; 107 batches |
| Default account lookup | One missing account; no duplicate or unexpected results |
| Inactive/deleted-inclusive diagnostic | One additional GET; exact coverage restored for that batch |
| Database publication | Zero normalized facts; publication timestamp unchanged |
| Historical eligibility and human activity | Unverified |

Collection persists stripped observations and checkpoints only in the explicit loopback
test database. Its separate multi-day fixture has a checked source-account binding.
Subsequent account lookups use a read-only database connection and never export tickets
or calls again. Published reports contain aggregate counts and an inventory fingerprint,
not account IDs, credentials, subjects, comments, names or email addresses.

The combined report validates every process's resumed page counts, contiguous account
slices, the same inventory fingerprint across those slices, and all 107 batch numbers.
See [aggregate evidence](2026-09-24-weekly-retained-summary.json), which names each
individual collection and account report.

## Reproduction

`scripts/rehearse-action-worker.ts` accepts the existing start-day/report arguments and
the optional `LOCAL_SHADOW_END_DAY=2026-09-19`. Set `LOCAL_SHADOW_DATABASE_URL` to an
explicit loopback PostgreSQL database ending in `_test`, then run fresh processes with
start day `2026-09-13` until both streams report complete. Each process performs at most
six steps, retains any retry deadline, and does not count incomplete streams as success.
Honor `notBefore` before retrying a deferred stream.

After collection, use `scripts/probe-retained-action-actors.ts` with the same interval and
database. Begin with `LOCAL_SHADOW_ACTOR_OFFSET=0`, save each report separately, and
continue at its `nextActorOffset` until that field is null. A process evaluates at most
2,000 accounts; success for a slice is not full-inventory completeness. A missing-only
batch may receive the documented inclusive diagnostic, whose result remains separate
from the default lookup result. A failed lookup never supplies plausible partial totals.

Both scripts read only the three vendor connection settings from `.env`; the production
database URL is not imported into their connections. They make vendor GET requests only.
Do not run the scripts against a shared staging or production database.

## Interpretation and remaining gates

The new census identifies a concrete, reproduced default-lookup omission. The original
failed probe discarded its in-memory response, so its exact omitted account cannot be
compared retrospectively. The event and leg counts agree with the earlier weekly export,
but an unretained export cannot support a record-by-record equality claim.

No lookup option establishes historical employee eligibility or verified human authorship.
The inclusive result is diagnostic evidence, not permission to credit the activity. The
human-only availability policy remains enforced. Independent metric reconciliation,
source/observation-bound attribution evidence, historical reporting context, and ongoing
scheduling/retention/monitoring remain release work. Production rollout and historical
repair were not performed.

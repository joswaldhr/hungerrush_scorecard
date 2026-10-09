# Manager context query candidate

Production phase timing after PR68 places manager-context resolution around
1.30–1.43 seconds in two observed requests. This candidate replaces the context
builder's three sequential database statements with one relational read. It does
not change authentication, administrator view-as precedence, caching or pooling.
Two removed round trips are a structural improvement, not a measured speedup.

## Authorization semantics

The query starts from the authenticated user's currently effective manager
assignments. Organization predicates constrain joined teams and employees;
membership dates remain in the join condition. Distinct scoped team/employee pairs
are reduced to the same authorized sets as before.

- No effective assignments produces `null` context.
- An effective but invalid or foreign-only assignment produces an empty context,
  preserving own-assignment precedence over administrator view-as.
- Empty assigned teams retain their team grant.
- A direct employee assignment does not grant their primary team.
- Mixed team/direct grants preserve their union without duplicate identities.
- Future and exclusive-end assignments/memberships do not grant access.
- Foreign employees are rejected even through a corrupt local-team membership.
- Employment status filtering remains in the existing downstream employee reader.

## Validation boundaries

Focused real PostgreSQL authorization and metric-query tests use only the explicit
isolated loopback test database. Added cases cover empty-vs-null context and view-as
precedence, mixed grants, duplicates, foreign memberships and effective dates.
The existing empty-team/date and direct-grant tests remain in place. All 70 tests
in four focused files pass, along with typecheck, scoped ESLint, modified-source
formatting and diff checks.

Exact full CI/build, hosted acceptance and production phase timing remain release
gates. Automatic deployment for this candidate branch is disabled. No production
data, source calls, metric semantics, scheduler settings or frozen demo changes are
included.

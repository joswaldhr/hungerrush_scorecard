# Presentation demo and navigation upgrade

## Scope

The September 28 request expands Adam's demo to 15 believable fictional employees:
eight POS and seven Menufy (four Restaurant, three Consumer). Full names are invented,
not copied from the employee roster. Adam Seow is the named demo manager; this label
does not provision an account or grant access.

An authenticated `/demo/one-on-ones` workspace uses the existing picker, scorecard,
week navigation, status and export components with a separate pure fixture provider.
Every fictional employee has 22 populated metrics, comparisons, illustrative targets,
definitions and simulated observation times. Closed weeks are repeatable; this week's
count values represent simulated progress with neutral status. Backlog remains a
snapshot. Six recent demo weeks are linked, with arrows/calendar available for others.
The demo history deliberately does not imitate retained vendor evidence or revisions.

The provider preserves simple accounting relationships: outbound attempts equal
completed plus non-answered, accepted inbound is within offered, abandoned on hold is
a subset of accepted, and avoided elevations/resolved tickets stay within their parent
counts. Survey/first-contact denominators are shown. Zero is intentional where applicable.
Demo-only active handling, first-contact resolution and adherence are explicitly
illustrations, not claims that production sources support those measures.

## Isolation and entry

- No seed/reset, database writes, live metric reader changes or vendor requests.
- `CADENCE_DEMO_ENABLED=true` plus `CADENCE_DEMO_ALLOWED_EMAILS` exact allowlist;
  normal authentication is still required. A Vercel production deployment always denies
  the demo, even if someone accidentally enables its flag there.
- Every demo page and week-loading server action rechecks access. Unknown employee IDs
  fail; demo IDs never grant access through normal production actions.
- Sidebar destinations stay inside the demo. No administration tools are shown.
- Demo sign-in goes to `/demo/one-on-ones`; callback handling returns only local constants.
- Persistent demo labeling appears in the workspace, captured/printed scorecard,
  export period and every metric's source definition. Exported figures are synthetic.
- Adam's exact sign-in email remains required before an allowlist entry can be added.
  No guessed email, password or expanded production permissions.
- Generic branch Preview inheritance is unsafe. Automatic deployments for this branch
  are disabled. Use only the documented isolated staging environment and exact candidate.

## Navigation work

The parallel UI agent supplied a local commit, integrated into this branch. It adds a
clearer brand/workspace/admin hierarchy, route-derived scorecard context, one correct
active item, a usable collapsed account disclosure, accessible keyboard dismissal and
a mobile modal drawer. Existing authorization and destinations remain server-owned.
An optional brand destination keeps the demo inside its own workspace.

## Validation and release state

Initial 38 focused tests pass, including fixture invariants, exact allowlisting,
server-action reauthorization, production denial, shared scorecard navigation and
sidebar keyboard/mobile behavior. Typecheck passes. Full suite, final lint, exact CI
and hosted visual/export verification are recorded as they complete below.

Local authenticated inspection verifies 15 linked people, both teams/lines and the new
sidebar. Production is unchanged. The separate PR39 last-week review release remains
held until actual hosted export bytes are inspected. This demo is not metric certification.

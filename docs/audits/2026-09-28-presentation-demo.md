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

## Verified hosted candidate

- App candidate `1798ab8d00a9aaaa5774cb03f651d6a2c3e4507f`, PR40 stacked on PR39.
- Exact CI `36477916159` passed typecheck, lint, migrations, 840 tests / 109 files and
  the production build. Local full suite and static checks also passed.
- Isolated Preview `dpl_57WTtMQAhk5YAwrCngr2t5rBz8Xd` is READY, with the staging branch's
  database/auth/vendor isolation and two explicit branch-only demo configuration entries.
  Only the existing reviewer was allowlisted. No production environment entry changed.
- Entry: `https://hungerrush-scorecard-git-code-20e6ca-water-hungerrush-scorecard.vercel.app/demo/one-on-ones`.
- Authenticated hosted inspection opened all 15 scorecards: 330 metric rows, every
  current/comparison/target cell populated, and every page shows 22/22 available with
  persistent synthetic labeling. Names, team/line groups and links match the fixture.
- Current-week check shows 22 values and exclusively neutral In Progress statuses.
  Demo history offers six prior weeks; returning restores the explicit current week.
  All seven category tables have identical column widths.
- Light/dark roster and scorecard views inspected. At 390px, document/client width
  agree at 375px, with contained horizontal table scrolling. Mobile navigation opens
  as a labeled dialog; Escape closes it and restores focus to the expand control.
- The active-handling illustration uses its own demo key, avoiding the legacy live-source
  resolution-time caption. No live metric availability guard was loosened.
- Actual download bytes remain unverified: the local browser CSV action produced no
  downloadable file/event, consistent with the existing hosted export-inspection limit.
  CSV/PDF/PNG must not be called presentation-verified solely from a success notification.
- An exact-name, read-only lookup of existing presenter user/employee records found no
  match; the presenter's sign-in email remains unknown. No account or role was invented.

To rehearse, open the entry URL, choose a POS or Menufy employee, review last week, switch
to this week's progress, then return to Last week before presenting comparisons. Every
demo profile is populated; fictional targets illustrate different review statuses.
Use on-screen review until actual downloaded-file checks pass. The separate production
release stays held; Zendesk, source publication policies, schedules and assignments remain
unchanged. Preview rollback is the prior `dpl_BfBrmQrvkEfL82ZWibVGkLXaoFgF` candidate;
remove/disable only the two demo Preview entries if demo access needs to be withdrawn.

# September 28 visual refresh — isolated UI candidate

Scope: presentation of the authorized employee picker and individual scorecard,
shared metric table and navigation. No database, source connector, authorization,
calculation, target or publication changes. The metric release remains independent.
This is a draft candidate, not a production deployment.

## Local evidence

- Existing picker, snapshot navigation, keyboard export and metric-data-detail suites:
  28 tests / 5 files passed. Coverage includes stale response races, hidden export
  controls while loading, zero versus missing values and source/target explanations.
- ESLint passed. Application typecheck passed using a temporary config excluding an
  existing ignored recovery script; a normal clean-CI typecheck is still required.
- Prettier passed with Windows line-ending auto normalization. Normal clean-CI lint,
  full PostgreSQL suite and production build are required before merge.
- Browser used a loopback-only synthetic harness rendering the real UI components;
  server actions were stubbed, with no database connection or vendor requests.
  It is not hosted Preview or full Next/auth integration evidence.
- Light/dark rendering, employee search, zero/no-sample display and 390px responsive
  containment inspected. Three tables had identical column coordinates. At 390px,
  document width was 375px and each 277px region contained a 680px scrollable table;
  all regions were keyboard-focusable. Temporary viewport override was reset.
- Actual synthetic PDF downloaded (16,010,109 bytes, one A4 page), rendered via Poppler
  and visually inspected: all seven rows, current/previous periods, values, duration
  labels and source detail appendix present with no clipping. Large raster PDF size
  is preexisting exporter behavior and remains a separate optimization opportunity.
- Actual synthetic CSV inspected (2,774 bytes, seven metric rows plus header): duration
  formatting, numeric zero and unavailable explanation preserved.
- Synthetic screenshots: `visual-refresh/picker-light.png`,
  `visual-refresh/scorecard-light.png`, `visual-refresh/scorecard-dark.png`.

## Remaining release checks

Clean CI, hosted synthetic current/history/export checks on an explicitly isolated
Preview, and the standard fresh backup/rollback/deployment gates remain. Do not visit
the new branch Preview until its environment isolation is verified. No fixture scripts
or source calls are configured in its build. No production or Zendesk changes occurred.

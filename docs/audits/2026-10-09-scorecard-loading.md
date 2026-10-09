# Scorecard loading candidate

This local candidate addresses the October 9 review's measured sequential-read and
week-navigation delays. The review recorded 3,671 ms for the employee list and
4,482 ms for a scorecard, with a representative metric SQL query taking 0.257 ms.
Those measurements motivate reducing round trips; they are not a post-change benchmark.

## Changes

- After authentication and employee scope validation, independent team, manager,
  archive and metric reads run together. The list similarly combines independent
  scope reads and then independent team/directory display reads. Empty lists avoid
  unnecessary team/directory reads.
- Week navigation uses a same-origin authenticated GET for one employee and week,
  with private/no-store responses. The endpoint re-derives the employee's team from
  current authorized scope, uses the existing week resolver and metric reader, and
  returns generic failures without SQL or employee diagnostics.
- Browser navigation aborts superseded requests and times out after 30 seconds.
  The request sequence guard remains: old responses cannot replace or export a new
  selection. Cancellation does not promise to cancel an already-running SQL query.
- The existing eight-entry, 60-second in-memory cache is preserved. Focus uses a
  fresh cached selection and does not restart a pending request for that week.
  Expiration, retries, default-week rollover and explicit fixed-week links retain
  their behavior. No prior employee selection is persisted.

## Validation and release limits

45 focused tests pass across six files: navigation/races/retries, cache/focus,
rollover, keyboard controls, presentation, date resolution, endpoint authorization,
team derivation, zero/date serialization, no-store behavior and browser cancellation.
Typecheck, scoped ESLint, modified-source Prettier and diff whitespace checks pass. Tests use an explicit isolated loopback test database configuration;
these focused cases mock readers and perform no vendor/production reads or writes.

Integration still requires the exact candidate's full CI/build, isolated hosted
synthetic checks, actual export consistency and representative post-change timings.
No deployment, source policy, metric computation, target, roster assignment or demo
data change is included. The frozen demo branch is untouched.

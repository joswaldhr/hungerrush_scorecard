# Presentation readiness and reusable product upgrades

Reviewed September 28, 2026 against the isolated 15-person Preview. This is a product
and presentation review, not production metric certification. No vendor changes.

## Assessment

The demo is a credible walkthrough of employee selection, last-week review, weekly
comparison and progress monitoring. Its team grouping, navy/teal styling, aligned
tables and stable sidebar form a consistent foundation. It is still visually a long
worksheet: too much repeated framing precedes the metrics, all rows have nearly equal
emphasis, and the presenter must explain what changed. The next improvements should
make the weekly conversation obvious, not add decoration or employee rankings.

The repeated demo labels have been removed at the user's request. The supplied PDF
and PNG exposed a long, tiny audit appendix that made both outputs look unfinished.
The follow-up replaces that appendix with concise source notes and grouped essential
caveats; detailed provenance remains in CSV and optional app disclosures.

## Evidence and remaining checks

| Area | Observed result | Remaining limit |
| --- | --- | --- |
| Team selection | 15 full-name profiles; POS and Menufy/Restaurant/Consumer grouping; searching Maya gives exactly one result | Presenter-specific first sign-in not observed |
| Scorecard | Prior hosted sweep: all 15 profiles, 22 populated metrics each; latest Maya review preserves values and ordinary manager name | Synthetic completeness does not imply live metric coverage |
| Review period | Last week Sep 20–26 compares Sep 13–19; current week remains neutral progress | No certification claim for either period |
| Navigation | Fixed control positions across collapse/expand; history offers six weeks and preserves returnWeek | History is generated scenarios, not retained vendor revisions |
| Presentation copy | No repeated workspace/scorecard banners, manager Demo suffix or sidebar demo subtitle | Sample provenance intentionally stays in detailed source metadata |
| Exports | Native HTTP attachment delivery succeeds for PDF, PNG and CSV on `0109468`. Actual saved files inspected: 828,518-byte PDF, 1,267,645-byte PNG and 10,910-byte CSV. PDF/PNG decoded pixels match exactly; all 22 CSV rows retain 20 columns and selected dates. Three-line footer replaces the audit dump | PDF remains a long single page; standard pagination is a later upgrade. Files over 3.5 MB require preview saving or CSV |
| Safety | Exact Microsoft email allowlist, separate Preview, production denial and pure fixtures remain | Production release remains separately held |

## Prioritized upgrades

The user subsequently authorized the first presentation pass. Candidate `0109468`
implements priorities 1 below: reduced repeated review framing, three configured
headline metrics, guarded neutral week-over-week differences and a reversible larger
presentation view with category navigation. Print retains the selected dates.
Exact CI `36484057126` passes 872 tests / 111 files and build; hosted 1366×768 and
1920×1080 checks confirm three headlines, seven aligned tables and 22 retained rows.
Current-week cards and all 22 rows are neutral In Progress, with no weekly delta.
Both themes and category controls were inspected. A browser check found an existing
outer-scroll overflow from absolutely positioned accessible labels; the final follow-up
positions both app/demo main scrollers to contain them and prevent blank page scrolling.
Final app candidate `f17821c` passes exact CI `36484866012` (872 tests / 111 files and
build) and is READY on `dpl_6zgVGDyR2tW1JMVmbmv7hTm4fTYR`. Final 1920x1080 inspection
confirms document height equals viewport height, no horizontal overflow, and keyboard
category navigation focuses the selected section with outer scroll remaining zero.
The headline selection never hides unavailable metrics in favor of available ones.
Current-week, unknown-source, incompatible, partial and snapshot comparisons are withheld.
The download relay and prepared-file dialog accompany this pass. Fifty-nine focused
tests and local static checks pass. Deltas use unrounded source values before display
rounding, so subtracting two rounded percentage labels may differ by 0.1 percentage
points. Keep this calculation basis explicit when evolving the explanatory UI.

The priority 2/3 items remain recommendations for later implementation.
Use the same shared components for demo and live views; never let presentation fixtures
loosen real-source availability or historical-target rules.

| Priority | Upgrade | Why it improves the demo and live use | Acceptance and constraints | Relative scope |
| --- | --- | --- | --- | --- |
| 1 | One strong review header | Combine employee, selected interval, comparison, week controls and export into one clear opening. Removes repeated period/status copy and brings values above the fold. | At 1366×768 the employee, chosen week and first meaningful metric group are visible without scrolling. Keyboard controls and fixed-week links still work; loading hides old exports. | Small |
| 1 | Three selected headline metrics | Give the presenter an immediate opening using a few team-appropriate values, comparison and eligible target. Keep the full table below. | Choose metrics from team configuration, not a universal set. Show unavailable honestly; no synthetic values in live cards, employee ranking or new aggregate performance score. | Medium |
| 1 | Explicit week-over-week change | Put a small signed difference beside a value so managers do not mentally subtract two columns. | Counts use absolute changes, percentages use percentage points, durations use signed H:MM:SS. Only comparable definitions/periods receive a delta. Direction is neutral unless the approved target semantics support an interpretation. Zero baselines never produce infinity. | Medium |
| 1 | Presentation view and readable density | Increase projector readability and reduce visual noise with larger text, stronger secondary-text contrast, compact contextual notes and a clearly labeled category navigation. | A reversible on-screen toggle; same values, warnings, targets and dates. Test 1366×768 and 1920×1080 in both themes, keyboard focus, reduced motion and 125% zoom. Do not hide unavailable rows to make the screen look complete. | Medium |
| 2 | Four-to-six-week trend strip | A restrained sparkline for a selected metric gives more context than a pair of columns and makes progress visually clear. | Requires a real multi-period reader and compatible source versions. Gaps stay gaps, no interpolated zeros. Never average percentages/means without denominators or imply a multi-week rollup is a stored weekly result. Include an accessible table and explicit dates. | Medium–large |
| 2 | Discussion points connected to the existing meeting workflow | Let the manager select a few rows and carry those factual observations into their established 1:1 workflow. Demonstrates an outcome beyond reading a dashboard. | Manager chooses the points; no AI employment judgments. Reuse the existing meeting/Rippling path where applicable, preserve authorization, and make save state clear. Demo notes must be isolated and resettable, not writes to live employee records. | Medium–large |
| 2 | Proper meeting-ready PDF layout | Standard Letter/A4 pages, consistent header, page numbers, repeat table headings and no split rows make an export comfortable to print and email. | Keep the loaded snapshot, attribution/target caveats and time units. Verify actual pages and bytes. Prefer selectable text when practical. Do not force all 22 metrics onto one unreadably small page. PNG remains a shareable full-scorecard image; CSV remains detailed. | Medium |
| 3 | Faster movement between employees | Add previous/next employee and a searchable switcher within the authorized roster, avoiding a repeated return to the picker. | Only already-authorized employees; a fresh employee opens last week as approved. No prior employee values flash while loading. Arrow controls need names and keyboard support. | Medium |
| 3 | More purposeful data details | Consolidate repetitive source language into a readable drawer with definition, observation, sample size and any caveat. Helps explain a number when challenged without cluttering every row. | Preserve per-metric context and raw audit exports. Source definition, missing versus zero, timezone, denominators and target eligibility remain inspectable. No editorial badges suggesting certification that has not occurred. | Medium |

Recommended sequence: consolidate the header, add honest selected highlights and deltas,
then presentation readability. Trend history, meeting workflow and paginated exports
follow as separate checked increments. These changes have more practical value than
animations, decorative charts, a new dashboard or more sidebar destinations.

## Five-minute rehearsal

1. Sign in with the presenter's own Microsoft identity and verify the demo link before
   the meeting. The staging share link expires October 5 at 15:27 Central.
2. Start at the employee picker; show POS and Menufy, then search for Maya Bennett.
3. Lead with the last complete reporting week and its comparison. Use two or three
   observations rather than reading every row. Maya's inspected sample includes 68
   resolved versus 66 previously, and a 72.1% first-contact figure versus a 75% sample
   target; those are fictional scenario values, not a live-source claim.
4. Briefly switch to this week to show provisional progress, then restore last week.
5. Open a prior reporting week and return; finish with Export, select a file format,
   then choose Save file in the prepared-file dialog. Keep an inspected local PDF as a presentation
   fallback. Do not showcase unverified production metrics as completed capabilities.

Do not start a broad visual rewrite immediately before a presentation. Ship changes
through the existing isolated Preview, meaningful tests and exact deployment checks;
keep the last known-good Preview available for rollback. Adam's access and file-download
rehearsal are practical readiness checks, not routine permission checkpoints.

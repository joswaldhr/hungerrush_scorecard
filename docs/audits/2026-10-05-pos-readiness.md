# October 5 POS readiness and hosted export verification

## Production observations

Read-only, repeatable-read production diagnostics at 14:51–14:54 UTC made no database
writes or vendor requests. Aggregate evidence is retained in
`2026-10-05-production-operational-census.json` and `2026-10-05-pos-reporting-census.json`.
Private diagnostic inputs and downloaded files remain outside tracked paths.

- The assignment inventory remains 40 team assignments / 23 keys, including 19 POS
  assignments. All 39 currently active POS employees have exactly one source mapping.
  This is a database mapping census, not a fresh independent vendor identity verification;
  the unused binding-verification field does not invalidate earlier identity evidence.
- The last 24 hours contain ten completed runs, no failures or unfinished runs. Across
  seven days there are 57 completed and seven failed runs. Success alone does not establish
  coverage: the oldest legacy offset completed without normalized records or intervals.
- CSAT's three October 5 runs each normalized 85 records for October 4–10, September
  27–October 3 and September 20–26, lasting 52.23, 197.38 and 219.69 seconds respectively.
  Project-wide invocation lookup returned only three retained entries, including one CSAT
  HTTP 200. It did not expose user agent or duration. This does not independently establish
  scheduler attribution for all database runs, nor prove the earlier 429's cause resolved.
- Qualified POS outbound values for September 27–October 3 cover 39 employees for each of
  five keys, but their last observation is September 28 at 17:51 UTC, before the week ended.
  October 4–10 rows use the legacy source rather than the qualified outbound contract.
  Neither period is certified complete by the earlier controlled canary.
- Production configuration confirms the new Talk collection, outbound, inbound-release
  and legacy-resume policies remain absent. Dedicated CSAT/first-reply settings exist;
  sensitive values were not printed. Human action shadow remains disabled.

The present roster is only a diagnostic denominator; it does not reconstruct historical
eligibility. Null averages without measured samples are distinct from missing ingestion.
Legacy ticket counts can exist in storage while manager readers withhold them under the
human-attribution policy. No assignment, calculation, policy, schedule or source was changed.

## Hosted export finding

The supported in-app browser control is now available. It supersedes the October 2
tooling limitation: CSV, PDF and PNG were actually saved from authenticated, isolated
main Preview `dpl_381BvP38NGsSypBe6vMCCYsttfPL`, code `8210d7a`, on October 5.
The synthetic September 20–26 scorecard loaded after one successful retry from an initial
error screen; that observation does not establish the transient error's cause.

The CSV has 26 metric rows and 20 columns. The PDF contains one raster page matching
the PNG pixel-for-pixel. Inspection found a genuine narrow-window export defect: the
rightmost Status column was clipped because the capture could be narrower than the
tables. The frozen export now has a minimum 1,024-pixel content width and explicit
border-box sizing. It preserves the loaded snapshot, values, definitions and warnings.
Twenty-four focused export/download tests, typecheck and file lint pass. Full CI
`37329827500` passes on recovery commit `8be1e3c`; the same code was cherry-picked to
main Preview commit `dbc1e5af92129265ee92e0c772b8b446cb44c934`.

Corrected Preview `dpl_JCLBg3VBGxLktJnbzwyhy4cXwij2` is Ready. Its build verifies the
isolated database/branch and disabled source credentials/policies. The synthetic inbound
rehearsal publishes nine results for each of September 27–October 3 and October 4–10:
eight numeric, one unavailable, with unrelated values unchanged and zero production
writes/vendor requests. Fresh hosted PDF and PNG were saved and inspected: all columns
are visible; their 2,144 × 8,322 rasters match pixel-for-pixel. The PDF was also rendered
with Poppler and inspected. It remains a single tall page; print pagination is not
claimed improved by this correction.

The new CSV matches all 104 displayed current-value, previous-value, target and status
cells across 26 rows. Stored history matches all 26 selected-period values; its back link
restores September 20. The October 4 current-week view and downloaded CSV match another
104 cells, with only neutral In Progress or No Data statuses. Loading hides the earlier
snapshot and export actions. Last-week navigation selects September 27 correctly.
Checksums and aggregate evidence are in `2026-10-05-hosted-export-verification.json`.
Current-week PDF/PNG, clipboard/print behavior, theme/keyboard coverage and unauthorized
employee scope were not re-exercised in this check; these are not silently counted as passed.

## Next release dependencies

The export correction is not a metric certification. Finish exact-candidate CI and
hosted file verification, then refresh recovery evidence and execute the documented
family-specific canary/independent comparison before changing production. POS inbound
still needs its own report semantics and period/source coverage resolved; Menufy's
SUM/MAX and offer definitions must not silently replace POS definitions. Retention,
delayed parent recovery, targets, human attribution and genuine scheduled publication
remain separate gates. Production and the frozen demonstration remain unchanged.

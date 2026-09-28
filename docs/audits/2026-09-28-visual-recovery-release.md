# Scorecard visual refresh and inactive parent recovery release

Released: PR36 merged to `390dae9`. Final head `ea96e21` passed CI 36461746114 and
36461753911; master CI 36462126005 passed. Actual final hosted PDF: 955,294 bytes,
identical decoded pixels, all 12 rows and source appendix inspected. Fresh 17:58 backup
restored all 33 tables / 63,132 rows with exact digests. Production required explicit
promotion after the earlier rollback; `dpl_DvfxY6H3bNESQvQByoHMQvgVemJN` owns the alias.
Admin/POS manager reads pass, 39 employees visible; seven protected data checks and all
18 environment entries unchanged. Outbound disabled-route check: HTTP 200, enabled false.
See the final hosted PDF, final backup and visual production deployment JSON reports.

Application candidate: `e13d42a`, PR36, adding lossless PDF compression to the
previously verified combined candidate `08b95e0`. Final exact CI remains required.
UI commit `fe34493` was separately reviewed in PR35 and integrated into the existing
isolated Preview branch. The release improves picker/scorecard hierarchy, readable
aligned columns, keyboard labels, mobile scrolling and print layout. Data selection,
calculation, availability, targets and export meaning remain unchanged.

The connector change can recover delayed parent calls from a recorded failed leg
observation within the original freshness window. It remains inactive: neither
`ZENDESK_TALK_COLLECTION_POLICY` nor `ZENDESK_OUTBOUND_POLICY` is present in production.
No source collection, publication, schema, assignment, target, historical repair or
Zendesk change is part of this code release. Existing CSAT/first-reply settings remain.
The separate inbound offered formula is an explicitly versioned inactive candidate.

Exact combined CI runs 36460314540 and 36460319508 passed: normal typecheck, lint,
PostgreSQL migrations, 802 tests / 105 files, and production build. Isolated Preview
`dpl_6LbkrHhAJeR5CHGy3fi9NTAaYMDL` is READY on that exact SHA and the audit branch's
19 unchanged staging overrides. UI-local current/mobile/dark/keyboard and actual
CSV/PDF/PNG checks passed; `2026-09-28-visual-hosted-verification.json` records final
hosted current/history/mobile/keyboard checks, exact 12-row CSV parity and inspected
PDF/PNG bytes. The large raster PDF triggered a measured compression correction:
lossless PNG FAST plus compressed PDF streams. Actual local component export fell
from 16,010,109 to 394,562 bytes with identical decoded image pixels. Repackaging the
hosted capture separately fell from 28,976,447 to 955,294 bytes with identical pixels;
that offline check is not yet an actual hosted export from the final candidate.

Fresh backup at 17:46 UTC: `2026-09-28-visual-recovery-release-backup.json`.
The encrypted backup restored 33 tables / 63,132 rows with all digests matching and
migration compatibility through 0015. The restore service stopped; private recovery
files remain outside Git. Seven production table digests and all 18 production
environment metadata entries are privately retained for post-deployment comparison.

Rollback: `e95c3710353209f79b73201d6bd2a4d70e5b40b8` /
`dpl_GXbbnN2xNxFKeqq7uLTu7MCbHest`, which currently owns the production alias after
the earlier refresh containment. Check actual alias assignment after the merge;
deploy readiness alone does not prove promotion following an explicit rollback.
If a UI/runtime regression appears, select this compatible deployment. No database
restore or configuration change is needed for application rollback.

Post-deployment: verify exact alias/SHA, sign-in, manager scope/current/history views,
unchanged protected data/configuration and no unexpected source activation. The
outbound route must report disabled under its absent policy. A disabled-route check
does not count as real source ingestion or scheduler certification.

Remaining metric gates are unaffected. Current source reconstruction now qualifies
all 62 POS/Menufy cases without parent gaps. Independent inbound candidate replay
also matches 5,146 field/set comparisons; this is retained-data qualification, not
inbound publication. Reliable scheduled recovery still depends on an appropriate
hosting schedule, and human attribution, target compatibility and other family
contracts remain open. No claim of 100% metric certification is made by this release.

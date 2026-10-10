# Dashboard branch visibility hotfix

Integrated on `fix/dashboard-branch-visibility` against GitHub main `59aead511b13306552cce7419efd36fb87616ded`, which reverts the original visibility update. The hotfix was already present locally and was reviewed file by file; the delivery patch was not reapplied. GitHub integration does not establish that the live customer data is correct. Current authenticated production evidence remains unavailable.

## Cause and evidence

The original update `0be245f` filters branches with the case-sensitive REST predicate `name=in.(Palma,Manar,Haykaliye)` and requires exactly one result per title-case name. The read-only production capture at `2026-10-06T14:27:40.582355+00:00` instead contains:

| Display | Stored name | Branch ID |
| --- | --- | --- |
| Palma | palma | 93cbc500-8177-42a8-a74c-4a57c2113956 |
| Manar | manar | 12de0c1c-57fe-4367-9016-818f0ee3a88d |
| Haykaliye | haykaliye | c0dbbe76-61ac-4c8f-b970-472a6751e810 |

All belong to Daily Supermarket, business `1593a757-910c-4e45-8dd2-26436bae0347`. The exact-name REST filter excludes all three observed rows; the resolver then throws the reported validation error. This reproduces the regression with the saved catalog, but is not a current production verification. No requested branch was missing in that capture.

The capture had zero products/sales/refunds in these three branches. All 14 products, 61 historical sales, and 15 historical refunds belonged to Main Branch (`64bb012f-4070-4ef8-87b7-a3f836e522a9`). Those records must remain excluded. Do not relabel or move them to populate the allowed branches. The acceptance branch was absent from this older capture.

Evidence source, read only during this task: `C:/Users/Lenovo/Desktop/swift-till-main/delivery/evidence/overnight-production-data.json`. No desktop files were modified.

## Behavior

Catalog reads query the observed IDs within the authenticated business scope. Resolution requires the pinned ID, matching business ID, and expected name after trimming/case normalization. The selector displays the requested capitalization; database records remain untouched. Unknown IDs and businesses receive no name-based fallback.

A missing, renamed, or ambiguous branch is excluded individually; other valid branches remain available. Empty catalogs issue no snapshot RPC. A removed or hidden selection repairs to the first available allowed branch. No branches are created. All Branches requests contain only existing allowed IDs.

Dashboard, inventory, analytics, reports, settings, realtime subscriptions, and CSV/JSON exports share that subset. Snapshot contamination is rejected before aggregation. The original update's explicit historical-row scope checks are restored to prevent hidden or unidentified historical records entering exports. Authentication, RLS, RPC definitions, and financial arithmetic are unchanged.

## Missing current production evidence

The REST diagnostic reached production but received PostgreSQL error `42501` for businesses and branches. No authenticated Supabase connection is available in this session. Public Vercel bundle access failed, so the currently served deployment is unconfirmed. GitHub main was fetched successfully and contains the revert described above.

Run `diagnostics/dashboard-branches.sql` in the SQL editor for project `ncbyahoyhrbmunqkisuq`. Its read-only transaction returns every Daily Supermarket branch's actual ID, stored name, and association; requested names in other businesses; the deployed RPC definition; and each existing allowed branch's RPC counts, keys, and returned scopes using the owner's existing authenticated context.

Confirm the three IDs and associations above. If one is absent, report it and verify that the remaining branches load. Confirm the RPC applies business and branch scope to every current/historical array and returns nested sales/refund `record` objects compatible with the existing normalizer. Do not change production data, RLS, or the RPC as part of this hotfix.

Then verify an authenticated customer session on all five routes, selecting each existing allowed branch and All Branches, and inspect CSV/JSON exports. Empty data must be distinguished from missing branches. No live fix is claimed until this evidence is available.

## Validation and release

Run `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, and `npm.cmd run test:build-credentials`.

Integration validation: 38 unit tests (including branch visibility), 44 mocked browser scenarios, typecheck, ESLint, production build, and the build credential guard passed. The files selected for commit also passed a scan for private keys, GitHub/AWS/Supabase tokens, raw JWTs, local environment secrets, and database dumps. Live production branch data was not part of these mocked checks.

The optional browser regression uses an existing Playwright installation:

```powershell
$env:DASHBOARD_PLAYWRIGHT_MODULE='C:/Users/Lenovo/Desktop/pos-dashboard-backup/dashboard-work/node_modules/playwright-core/index.mjs'
node --experimental-strip-types scripts/test-dashboard-branches.mjs
```

Browser traffic is mocked and transactions are synthetic. Catalog IDs match the saved capture. Scenarios cover lowercase REST results, missing/duplicate/empty catalogs, hidden branches, totals, selectors, exports, stale responses, and malformed snapshots.

The original delivery patch and status file are preserved locally as preparation artifacts and are not included in the integration commit. They must not be reapplied to this integrated source. Before integration, all 21 modified/untracked files were copied to a verified local backup, and `backup/dashboard-branch-visibility-20261010T202419Z` preserved the original local main commit.

The user authorized merging and pushing after repository validation. GitHub branch protections and required checks must still be respected; no force push or history rewriting is allowed. Use the existing Vercel project, environment, Vite build command, and `dist` output. No dependency, hosting, environment, POS desktop, or database changes are needed. Verify the deployed commit and authenticated customer data after release; production verification is separate from the repository checks.

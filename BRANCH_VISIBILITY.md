# Dashboard branch visibility delivery

Only Palma, Manar, and Haykaliye are returned to customer branch selectors/lists. The existing All Branches option aggregates only these three branches. Every catalog read resolves each exact name once within the selected authenticated business, verifies distinct UUIDs, and rejects missing or ambiguous matches. These Supabase IDs are resolved at runtime; no production IDs are guessed or copied from test fixtures.

Financial and inventory reads share the same allowlist and send only its IDs to `pos_dashboard_snapshot`. Totals are calculated from validated, scoped sale/refund/item/product rows. Aggregate-only responses fail closed. Historical downloads also require explicit matching business and branch IDs on every record. Invalid selections switch to Palma. Old catalogs and data are hidden synchronously when scope changes, and superseded requests cannot replace current data.

## Changed files

- `src/lib/branchPolicy.ts`, `src/lib/dashboardData.ts`: branch resolution, selection validation, and shared ID-scoped data access.
- `src/lib/catalog.ts`, `src/lib/financialData.ts`, `src/lib/inventory.ts`, `src/lib/financial.ts`: enforce the policy on catalogs, snapshots, aggregation inputs, and historical exports.
- `src/hooks/useDashboardBranches.ts`: scoped branch lists, stale-request cancellation, and hidden-selection recovery.
- `src/pages/DashboardPage.tsx`, `InventoryPage.tsx`, `AnalyticsPage.tsx`, `ReportsPage.tsx`, `SettingsPage.tsx`: use the scoped catalog and prevent stale/invalid selections from rendering data.
- `tests/dashboardBranches.test.ts`, `tests/fixtures/dashboard.ts`, `tests/financial.test.ts`: allowlist, business/UUID uniqueness, totals, refunds, inventory, exports, invalid selections, and contaminated/unscoped/aggregate-only response regressions.
- `scripts/test-dashboard-branches.mjs`, `package.json`, `package-lock.json`: production-build browser regression command and pinned test-only Playwright dependency.
- `BRANCH_VISIBILITY.md`: this delivery and deployment record.

No Supabase data/schema/auth/RLS changes, POS desktop changes, styling changes, or new Dashboard screens are included. This checkout has five customer routes: Dashboard, Inventory, Analytics, Reports, and Settings. It has no standalone Refunds or Daily movement route. Refund events are included in all relevant snapshot validation and financial tests.

## Validation

Run from the Dashboard checkout:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:build-credentials
npm.cmd run test:branches:browser
```

The browser command serves `dist` on loopback, mocks all Supabase requests using synthetic IDs/records, and blocks other external requests. It uses installed Microsoft Edge by default; set `DASHBOARD_BROWSER_CHANNEL=chrome` for installed Chrome. `DASHBOARD_PLAYWRIGHT_MODULE` optionally selects an existing Playwright module. Browser tests exercise all five routes, each allowed branch, all-branch totals, CSV/JSON exports, restored hidden selections, direct URLs, cached state, loading/switching, and delayed old responses. Malformed, hidden, missing/duplicate, unscoped-history, and aggregate-only responses must fail closed. Tests do not authenticate to or modify production.

Results: 36 unit tests and 39 browser scenarios passed; typecheck, lint, production build, and the Vite build credential guard passed. The browser test dependency was prepared from locally installed package metadata/files because registry access was unavailable; its exact npm version and integrity are recorded in the lockfile.

## Production verification and deployment status

Prepared in an isolated checkout under `C:\Users\Lenovo\Desktop\pos-dashboard-backup\dashboard-work`, based on local Dashboard main commit `4e8343d`. The named Dashboard folder is outside this session's writable workspace and remains unchanged. The isolated branch is `dashboard-allowed-branches`.

Not pushed or deployed. Outbound Supabase/GitHub access failed in this session, and authenticated Supabase query tools/Vercel deployment tools were unavailable. The live customer's business ID and branch IDs, the deployed RPC definition, and current GitHub main therefore remain unverified. Runtime uniqueness/ownership scoping is implemented and tested, but synthetic fixtures are not evidence of live database state.

Before merging/deploying, run these read-only queries in Supabase project `ncbyahoyhrbmunqkisuq` and confirm the business belongs to the intended customer:

```sql
select b.id as business_id, b.name as business_name, b.owner_id,
       br.id as branch_id, br.name as branch_name
from public.businesses b
join public.branches br on br.business_id = b.id
where br.name in ('Palma', 'Manar', 'Haykaliye')
order by b.id, br.name, br.id;

select pg_get_functiondef(
  'public.pos_dashboard_snapshot(uuid,uuid[])'::regprocedure
);
```

Confirm exactly one of each requested name within the intended business. Confirm every products/sales/refunds/historical query in the deployed RPC applies both business ID and `branch_id = ANY(p_branch_ids)` before any aggregation. The locally available reviewed RPC source follows this pattern and returns row arrays, but the production definition could not be inspected.

Once live verification passes, fetch current GitHub main in a writable Dashboard checkout, apply/cherry-pick this isolated change without overwriting unrelated work, resolve conflicts if any, and rerun the checks above. Use an ordinary reviewed merge/push; never force-push. Vercel should use the existing project, Vite build command, `dist` output, SPA routing, and existing public Supabase environment configuration. Do not copy `.env`, credentials, local dependencies, or test artifacts into Git. Verify the customer session on `https://dailys-pos.vercel.app` after deployment. No deployment success is claimed by this delivery.

## Separate server authorization work (not applied)

This Dashboard allowlist controls display and request construction, not direct Supabase access. If the customer must be unable to request hidden branches directly, a separately approved server change must authorize branch IDs for that authenticated identity across branches, products, sales/items, refunds/items, views, realtime, and every readable RPC. The snapshot's security-definer implementation must check every requested ID against that identity's authorized branch membership before querying or aggregating; business ownership alone is insufficient for a restricted Dashboard account. Review broad existing policies and other security-definer functions so they cannot bypass the restriction.

If the Dashboard and POS use the same customer identity, policies cannot securely distinguish them using frontend-controlled inputs. Preserve POS access by designing an appropriate separate Dashboard identity or trusted server-issued authorization context before changing production permissions. No production SQL changes are included or authorized here. See [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) and [database function security](https://supabase.com/docs/guides/database/functions).

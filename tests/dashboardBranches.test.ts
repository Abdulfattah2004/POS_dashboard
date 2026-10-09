import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDashboardBranches, repairBranchSelection, isDashboardSelection } from '../src/lib/branchPolicy.ts';
import { readDashboardSnapshot } from '../src/lib/dashboardData.ts';
import { csvCell } from '../src/lib/financial.ts';
import { allowedIds, branches, businessId, makeSnapshot } from './fixtures/dashboard.ts';

test('branch catalogs expose only the three named branches in the requested order', () => {
  assert.deepEqual(resolveDashboardBranches([...branches].reverse(), businessId).map(branch => branch.name), ['Palma', 'Manar', 'Haykaliye']);
});

test('missing names, duplicate names/IDs, and a different business fail closed', () => {
  assert.throws(() => resolveDashboardBranches(branches.slice(1), businessId), /uniquely/);
  assert.throws(() => resolveDashboardBranches([...branches, { ...branches[0], id: 'duplicate' }], businessId), /uniquely/);
  assert.throws(() => resolveDashboardBranches(branches.map((branch, i) => i === 1 ? { ...branch, id: branches[0].id } : branch), businessId), /distinct/);
  assert.throws(() => resolveDashboardBranches(branches, 'another-business'), /business scope/);
  assert.throws(() => resolveDashboardBranches(branches.map((branch, i) => i === 0 ? { ...branch, id: 'all' } : branch), businessId), /uniquely/);
});

test('hidden, deleted, URL, or cached branch selections repair to Palma; all remains scoped', () => {
  const allowed = resolveDashboardBranches(branches, businessId);
  for (const selection of [branches[3].id, branches[4].id, 'deleted', 'Main Branch', '']) {
    assert.equal(repairBranchSelection(allowed, selection), allowedIds[0]);
    assert.equal(isDashboardSelection(allowed, selection), false);
  }
  assert.equal(repairBranchSelection(allowed, 'all'), 'all');
  assert.equal(repairBranchSelection(allowed, allowedIds[1]), allowedIds[1]);
  assert.equal(isDashboardSelection([], 'all'), false);
});

test('overview, sales, inventory, analytics, refunds, and reports share the ID-scoped snapshot', async () => {
  const requests: unknown[] = [];
  const data = await readDashboardSnapshot(async () => branches, async args => {
    requests.push(args);
    return { data: makeSnapshot(args.p_branch_ids), error: null };
  }, businessId);
  assert.deepEqual(requests, [{ p_business_id: businessId, p_branch_ids: allowedIds }]);
  assert.equal(data.sales.reduce((sum, sale) => sum + sale.total, 0), 60);
  assert.equal(data.sales.filter(sale => sale.kind === 'refund').reduce((sum, sale) => sum + sale.total, 0), -60);
  assert.equal(data.saleItems.reduce((sum, item) => sum + item.quantity * (item.sale_price - item.cost), 0), 54);
  assert.equal(data.products.reduce((sum, product) => sum + product.stock * Number(product.cost), 0), 18);
  for (const rows of [data.sales, data.saleItems, data.products, ...Object.values(data.historical)]) {
    assert.ok(rows.every(row => allowedIds.includes(String(row.branch_id)) && row.business_id === businessId));
  }
  const csv = data.sales.map(sale => Object.values(sale).map(csvCell).join(',')).join('\n');
  for (const serialized of [csv, JSON.stringify(data.historical)]) {
    assert.doesNotMatch(serialized, /HIDDEN_|Main Branch|POS_ACCEPTENCE_ONLY/);
    for (const hidden of branches.slice(3)) assert.ok(!serialized.includes(hidden.id));
  }
});

test('every allowed branch is requested by its actual catalog ID', async () => {
  for (const branchId of allowedIds) {
    const data = await readDashboardSnapshot(async () => branches, async args => {
      assert.deepEqual(args.p_branch_ids, [branchId]);
      return { data: makeSnapshot(args.p_branch_ids), error: null };
    }, businessId, branchId);
    assert.ok(data.sales.every(sale => sale.branch_id === branchId));
    assert.equal(data.products.length, 1);
  }
});

test('hidden selections and ambiguous catalogs never send a snapshot request', async () => {
  let calls = 0;
  const request = async () => { calls++; return { data: makeSnapshot(), error: null }; };
  for (const hidden of branches.slice(3)) {
    const data = await readDashboardSnapshot(async () => branches, request, businessId, hidden.id);
    assert.deepEqual(data.sales, []);
    assert.deepEqual(data.products, []);
  }
  await assert.rejects(readDashboardSnapshot(async () => branches.slice(1), request, businessId));
  assert.equal(calls, 0);
});

test('RPC contamination is rejected before aggregation or either export', async () => {
  const hidden = makeSnapshot([branches[3].id]);
  for (const table of ['products', 'sales', 'refunds'] as const) {
    const raw = makeSnapshot();
    (raw[table] as unknown[]).push(...hidden[table]);
    await assert.rejects(readDashboardSnapshot(async () => branches, async () => ({ data: raw, error: null }), businessId), /scope mismatch/);
  }
  for (const table of ['sales', 'sale_items', 'refunds', 'refund_items'] as const) {
    const raw = makeSnapshot();
    raw.historical[table].push(...hidden.historical[table]);
    await assert.rejects(readDashboardSnapshot(async () => branches, async () => ({ data: raw, error: null }), businessId), /Historical snapshot scope/);
    for (const field of ['business_id', 'branch_id']) {
      const unscoped = makeSnapshot();
      delete (unscoped.historical[table][0] as Record<string, unknown>)[field];
      await assert.rejects(readDashboardSnapshot(async () => branches, async () => ({ data: unscoped, error: null }), businessId), /Historical snapshot scope/);
    }
  }
});

test('pre-aggregated RPC totals cannot be treated as branch-scoped records', async () => {
  await assert.rejects(readDashboardSnapshot(async () => branches, async () => ({ data: { total_revenue: 999999 }, error: null }), businessId));
  const data = await readDashboardSnapshot(async () => branches, async () => ({ data: { ...makeSnapshot(), total_revenue: 999999 }, error: null }), businessId);
  assert.equal(data.sales.reduce((sum, sale) => sum + sale.total, 0), 60);
});

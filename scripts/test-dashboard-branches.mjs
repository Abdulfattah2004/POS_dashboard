// Run against the production build, with all Supabase traffic mocked locally.
// Set DASHBOARD_PLAYWRIGHT_MODULE to an installed playwright-core entry point
// when it is not available through normal Node module resolution.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { allowedIds, branches, businessId, ownerId, makeSnapshot } from '../tests/fixtures/dashboard.ts';

const modulePath = process.env.DASHBOARD_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright-core');
const root = resolve('dist');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.html': 'text/html', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + pathname);
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const target = extname(file) ? file : resolve(root, 'index.html');
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[extname(target)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: process.env.DASHBOARD_BROWSER_CHANNEL ?? 'msedge', headless: true });
let passed = 0;

async function until(check, message) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise(done => setTimeout(done, 50));
  }
  throw new Error(message);
}

async function openScenario(path, mode = 'normal') {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1600, height: 1100 } });
  const errors = [];
  const requests = [];
  let holdBranch = '';
  let releaseHeld;
  let held = false;
  await context.routeWebSocket('**', socket => socket.close());
  await context.addInitScript(({ ownerId, hiddenId }) => {
    const now = Math.floor(Date.now() / 1000);
    const encode = value => btoa(JSON.stringify(value));
    const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: ownerId, role: 'authenticated', aud: 'authenticated', exp: now + 3600 })}.synthetic`;
    localStorage.setItem('sb-ncbyahoyhrbmunqkisuq-auth-token', JSON.stringify({ access_token, refresh_token: 'synthetic', expires_at: now + 3600, expires_in: 3600, token_type: 'bearer', user: { id: ownerId, email: 'synthetic@example.invalid' } }));
    localStorage.setItem('selectedBranch', hiddenId);
    sessionStorage.setItem('selectedBranch', hiddenId);
    window.branchLeaks = [];
    const inspect = () => {
      const text = document.body?.textContent ?? '';
      if (/Main Branch|POS_ACCEPTENCE_ONLY|HIDDEN_/.test(text)) window.branchLeaks.push(text);
    };
    new MutationObserver(inspect).observe(document, { subtree: true, childList: true, characterData: true });
  }, { ownerId, hiddenId: branches[3].id });
  await context.route('**/*', async route => {
    try {
      const url = new URL(route.request().url());
      if (url.origin === base) { await route.continue(); return; }
      if (url.hostname !== 'ncbyahoyhrbmunqkisuq.supabase.co') { await route.abort(); return; }
      let data;
      if (url.pathname === '/auth/v1/user') {
        data = { id: ownerId, aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.invalid', app_metadata: {}, user_metadata: {} };
      } else if (url.pathname === '/rest/v1/businesses') {
        assert.equal(url.searchParams.get('owner_id'), 'eq.' + ownerId);
        data = [{ id: businessId, name: 'Synthetic customer', owner_id: ownerId }];
      } else if (url.pathname === '/rest/v1/branches') {
        assert.equal(url.searchParams.get('business_id'), 'eq.' + businessId);
        assert.equal(url.searchParams.get('name'), 'in.(Palma,Manar,Haykaliye)');
        // Deliberately return hidden catalog rows as well: policy must still hold.
        data = mode === 'duplicate' ? [...branches, { ...branches[0], id: 'duplicate' }] : mode === 'missing' ? branches.slice(1) : branches;
      } else if (url.pathname === '/rest/v1/rpc/pos_dashboard_snapshot') {
        const args = route.request().postDataJSON();
        assert.equal(args.p_business_id, businessId);
        assert.ok(args.p_branch_ids.length > 0);
        assert.ok(args.p_branch_ids.every(id => allowedIds.includes(id)));
        requests.push(args);
        if (args.p_branch_ids.length === 1 && args.p_branch_ids[0] === holdBranch) {
          held = true;
          await new Promise(done => { releaseHeld = done; });
          holdBranch = '';
        }
        data = makeSnapshot(args.p_branch_ids);
        if (mode === 'aggregate') data = { total_revenue: 999999 };
        if (mode.startsWith('hidden-')) {
          const table = mode.slice(7);
          const hidden = makeSnapshot([branches[3].id]);
          if (table === 'history') data.historical.sales.push(...hidden.historical.sales);
          else data[table].push(...hidden[table]);
        }
        if (mode === 'unscoped-history') delete data.historical.sales[0].branch_id;
      } else {
        throw new Error('Unexpected Supabase endpoint: ' + url.pathname);
      }
      await route.fulfill({ json: data, headers: { 'access-control-allow-origin': '*' } });
    } catch (error) {
      errors.push(error);
      await route.abort().catch(() => {});
    }
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error));
  await page.goto(`${base}${path}?branch=${branches[3].id}&branch_id=${branches[4].id}`);
  return { context, page, requests, errors, hold: id => { holdBranch = id; }, held: () => held, release: () => releaseHeld?.() };
}

async function chooseBranch(page, name) {
  await page.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name, exact: true }).click();
}

async function restoreHiddenSelection(page) {
  // Restore a legacy selection directly into React's state without adding a
  // production-only test API or teaching the Dashboard to trust browser caches.
  await page.evaluate(({ businessId, hiddenId }) => {
    const element = document.getElementById('root').firstElementChild;
    const key = Object.keys(element).find(key => key.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) {
      for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        if (hook.memoizedState === businessId && hook.next?.queue?.dispatch) {
          hook.next.queue.dispatch(hiddenId);
          return;
        }
      }
    }
    throw new Error('Unable to restore the legacy branch selection');
  }, { businessId, hiddenId: branches[3].id });
}

async function assertNoLeaks(scenario) {
  assert.deepEqual(scenario.errors, []);
  assert.deepEqual(await scenario.page.evaluate(() => window.branchLeaks), []);
  assert.doesNotMatch(await scenario.page.locator('body').innerText(), /Main Branch|POS_ACCEPTENCE_ONLY|HIDDEN_/);
}

async function downloadText(page, name) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  const download = await pending;
  const stream = await download.createReadStream();
  let text = '';
  for await (const chunk of stream) text += chunk.toString();
  assert.doesNotMatch(text, /HIDDEN_|Main Branch|POS_ACCEPTENCE_ONLY/);
  for (const branch of branches.slice(3)) assert.ok(!text.includes(branch.id));
  return text;
}

try {
  for (const path of ['/dashboard', '/inventory', '/analytics', '/reports', '/settings']) {
    const scenario = await openScenario(path);
    const { page, context, requests } = scenario;
    try {
      await until(async () => (await page.locator('body').innerText()).includes(path === '/settings' ? 'Haykaliye' : path === '/inventory' ? 'Palma-product' : 'Palma-cashier'), 'Allowed data did not load: ' + path);
      if (path === '/settings') {
        for (const branch of branches.slice(0, 3)) assert.equal(await page.getByText(branch.name, { exact: true }).count(), 1);
        assert.equal(requests.length, 0);
      } else {
        assert.deepEqual(requests[0].p_branch_ids, allowedIds);
        assert.ok((await page.locator('body').innerText()).includes(path === '/inventory' ? '$18.00' : '$60.00'));
        await page.getByRole('combobox').nth(1).click();
        assert.deepEqual(await page.getByRole('option').allTextContents(), ['All Branches', 'Palma', 'Manar', 'Haykaliye']);
        await page.keyboard.press('Escape');
        if (path !== '/inventory') {
          const historical = JSON.parse(await downloadText(page, 'Download original historical records'));
          for (const rows of Object.values(historical)) assert.ok(rows.every(row => allowedIds.includes(row.branch_id)));
        }
        if (path === '/reports') {
          const csv = await downloadText(page, 'Export CSV');
          for (const branch of branches.slice(0, 3)) assert.ok(csv.includes(branch.name));
          assert.ok(csv.includes('refund'));
        }
        await restoreHiddenSelection(page);
        await until(async () => (await page.getByRole('combobox').nth(1).innerText()).includes('Palma')
          && (await page.locator('body').innerText()).includes(`Palma-${path === '/inventory' ? 'product' : 'cashier'}`), 'Hidden cached selection did not repair to Palma: ' + path);
        for (const [index, branch] of branches.slice(0, 3).entries()) {
          await chooseBranch(page, branch.name);
          await until(async () => (await page.locator('body').innerText()).includes(`${branch.name}-${path === '/inventory' ? 'product' : 'cashier'}`), 'Branch data did not load: ' + path + '/' + branch.name);
          const text = await page.locator('body').innerText();
          assert.ok(text.includes(`$${path === '/inventory' ? (index + 1) * 3 : (index + 1) * 10}.00`));
          for (const other of branches.slice(0, 3).filter(other => other.id !== branch.id)) {
            assert.ok(!text.includes(other.name + '-product'));
            assert.ok(!text.includes(other.name + '-cashier'));
          }
          if (path === '/reports') {
            const csv = await downloadText(page, 'Export CSV');
            assert.ok(csv.includes(branch.name));
            for (const other of branches.slice(0, 3).filter(other => other.id !== branch.id)) assert.ok(!csv.includes(other.name));
          }
        }
        // An older response must never repaint a newer selected branch.
        scenario.hold(allowedIds[0]);
        await chooseBranch(page, 'Palma');
        await until(scenario.held, 'Expected delayed snapshot');
        assert.doesNotMatch(await page.locator('body').innerText(), /Haykaliye-(product|cashier)/);
        await chooseBranch(page, 'Manar');
        await until(async () => (await page.locator('body').innerText()).includes(`Manar-${path === '/inventory' ? 'product' : 'cashier'}`), 'Newer branch did not load');
        scenario.release();
        await page.waitForLoadState('networkidle');
        assert.doesNotMatch(await page.locator('body').innerText(), /Palma-(product|cashier)/);
      }
      await assertNoLeaks(scenario);
      passed++;
      console.log('PASS ' + path + ': catalogs, totals, selections, loading, URLs/cache, exports, and request races');
    } finally { scenario.release(); await context.close(); }
  }
  for (const path of ['/dashboard', '/inventory', '/analytics', '/reports']) {
    for (const mode of ['hidden-products', 'hidden-sales', 'hidden-refunds', 'hidden-history', 'unscoped-history', 'aggregate', 'missing', 'duplicate']) {
      const scenario = await openScenario(path, mode);
      try {
        await until(async () => path === '/inventory'
          ? (await scenario.page.getByRole('button', { name: 'Retry', exact: true }).count()) > 0
          : (await scenario.page.getByRole('alert').count()) > 0, 'Contaminated response was not rejected: ' + path + '/' + mode);
        assert.doesNotMatch(await scenario.page.locator('body').innerText(), /\$60\.00|\$18\.00|Palma-(product|cashier)/);
        assert.equal(await scenario.page.getByRole('button', { name: 'Download original historical records', exact: true }).count(), 0);
        if (mode === 'missing' || mode === 'duplicate') assert.equal(scenario.requests.length, 0);
        await assertNoLeaks(scenario);
        passed++;
      } finally { await scenario.context.close(); }
    }
    console.log('PASS ' + path + ': 8 malformed/contaminated response scenarios fail closed');
  }
  for (const mode of ['missing', 'duplicate']) {
    const scenario = await openScenario('/settings', mode);
    try {
      await until(async () => (await scenario.page.getByRole('alert').count()) > 0, 'Invalid settings branch catalog did not fail closed');
      for (const branch of branches.slice(0, 3)) assert.equal(await scenario.page.getByText(branch.name, { exact: true }).count(), 0);
      assert.equal(scenario.requests.length, 0);
      await assertNoLeaks(scenario);
      passed++;
    } finally { await scenario.context.close(); }
  }
  console.log(`Dashboard branch browser regression: ${passed} scenarios passed.`);
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}

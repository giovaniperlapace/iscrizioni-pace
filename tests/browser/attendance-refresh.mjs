// Local synthetic transport, real table/provider and reception controls. No remote writes.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:3198';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
assert.ok(!existsSync('.env.local'), 'Run in an isolated copy without credentials');
const routePath = 'app/attendance-refresh-check';
assert.ok(!existsSync(routePath));
mkdirSync(routePath);
writeFileSync(`${routePath}/page.tsx`, 'export { default } from "@/tests/browser/attendance-refresh-fixture";');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const eventId = '11111111-1111-4111-8111-111111111111';
const registrationId = '00000000-0000-4000-8000-000000000000';
const at = '2026-10-17T10:00:00Z';
let entered = false, status = 200, failure = false, commands = 0;
const reads = new Map(), errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/dashboard/attendance?*', async route => {
    const page = route.request().frame().page(); reads.set(page, (reads.get(page) ?? 0) + 1);
    await route.fulfill({ status, json: status !== 200 ? {} : { eventId, updatedAt: new Date().toISOString(), entries: entered ? { [`${registrationId}:adult`]: at } : {}, schoolEntries: {}, totals: { adults: entered ? 1 : 0, children: 0, students: 0, companions: 0, schoolBookings: 0, people: entered ? 1 : 0 } } });
  });
  await context.route('**/fixture-presence-command', async route => {
    const command = JSON.parse(route.request().postData());
    if (command.action !== 'inspect') {
      commands++;
      if (failure) { await route.fulfill({ json: { status: 'unavailable' } }); return; }
      entered = command.action !== 'cancel';
    }
    await route.fulfill({ json: { status: 'valid', kind: 'family', code: 'TEST', revision: commands, outcome: command.action === 'inspect' ? 'verified' : 'saved', registrationStatus: 'confirmed', persons: [{ id: registrationId, kind: 'adult', firstName: 'Persona', lastName: 'Prova 0', checkedInAt: entered ? at : null }] } });
  });
  async function open() {
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.clock.install();
    await page.goto(`${base}/attendance-refresh-check`);
    await page.locator('[data-table] tbody tr').last().waitFor();
    await page.waitForFunction(() => document.querySelector('[data-benchmark]')?.textContent.includes('Partecipazione non confermata'));
    await settled(page);
    return page;
  }
  const settled = page => page.waitForFunction(() => !document.querySelector('button[aria-busy=true]'));
  const page = await open();
  assert.equal(await page.locator('tbody tr').count(), 100);
  const initial = reads.get(page);
  await page.clock.fastForward(10_000); await settled(page);
  assert.equal(reads.get(page), initial, 'no ten-second polling');
  await page.clock.fastForward(889_000); await settled(page);
  assert.equal(reads.get(page), initial, 'no periodic read before fifteen minutes');
  await page.clock.fastForward(1_100); await settled(page);
  assert.equal(reads.get(page), initial + 2, 'one reconciliation per provider after fifteen minutes');
  await page.evaluate(() => { const output = document.querySelector('[data-render-count]'); output.dataset.count = '0'; output.dataset.duration = '0'; });
  await page.locator('[data-benchmark]').getByRole('button', { name: 'Aggiorna presenze', exact: true }).click(); await settled(page);
  assert.equal(await page.locator('[data-render-count]').getAttribute('data-count'), '0', 'unchanged snapshot does not render any of the 500 presence indicators');
  const beforeSave = reads.get(page);
  await page.locator('[data-save]').getByRole('button', { name: 'Conferma partecipazione', exact: true }).click(); await settled(page);
  await page.locator('[data-table] tbody tr').first().getByText(/Partecipazione confermata/).waitFor();
  assert.equal(reads.get(page), beforeSave + 2);
  assert.equal(await page.locator('[data-render-count]').getAttribute('data-count'), '1', 'one saved person renders just one of 500 indicators');
  console.log('PASS 500 loaded rows, 100 visible: zero indicator renders for unchanged data, one for a changed person; no ten-second reads');
  await page.evaluate(id => history.replaceState(null, '', `${location.pathname}?edit=${id}`), registrationId);
  await page.locator('dialog[open]').waitFor();
  await page.keyboard.press('Escape'); await page.locator('dialog[open]').waitFor({ state: 'detached' });
  await page.locator('[data-save]').getByRole('button', { name: 'Rimuovi presenza', exact: true }).click();
  await page.getByRole('button', { name: 'Conferma rimozione', exact: true }).click(); await settled(page);
  await page.locator('[data-table] tbody tr').first().getByText('Partecipazione non confermata', { exact: true }).waitFor();
  const second = await open();
  const beforeBroadcast = reads.get(page);
  await second.locator('[data-save]').getByRole('button', { name: 'Conferma partecipazione', exact: true }).click();
  await second.locator('[data-save]').getByText('✓ Partecipazione confermata', { exact: true }).waitFor(); await settled(second);
  await page.bringToFront();
  // Broadcast delivery is real time while each tab has its own simulated clock.
  // Poll from Node rather than relying on the other tab's mocked animation frames.
  const received = () => page.evaluate(() => document.querySelector('[data-table] tbody tr')?.textContent.includes('Partecipazione confermata'));
  for (let attempt = 0; attempt < 100 && !await received(); attempt++) await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(await received(), 'another tab receives the saved presence');
  assert.equal(reads.get(page), beforeBroadcast + 2, 'another tab invalidates both providers without publishing personal data');
  await second.close();
  status = 503;
  await page.locator('[data-table]').getByRole('button', { name: 'Aggiorna presenze', exact: true }).click(); await settled(page);
  assert.equal(await page.locator('[data-table]').getByText('Partecipazione non disponibile', { exact: true }).count(), 100);
  status = 200;
  await page.locator('[data-table]').getByRole('button', { name: 'Riprova', exact: true }).click(); await settled(page);
  status = 403;
  await page.locator('[data-table]').getByRole('button', { name: 'Aggiorna presenze', exact: true }).click(); await settled(page);
  assert.equal(await page.locator('[data-table]').getByText('Partecipazione non disponibile', { exact: true }).count(), 100);
  const blocked = reads.get(page);
  await page.clock.fastForward(900_100); await settled(page);
  assert.equal(reads.get(page), blocked + 1, 'revoked provider does not poll again; other provider receives revocation once');
  status = 200;
  await page.locator('[data-table]').getByRole('button', { name: 'Riprova', exact: true }).click(); await settled(page);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: '/tmp/pace-attendance-refresh-mobile.png' });
  assert.deepEqual(errors, []);
  console.log('PASS save/removal, cross-tab invalidation, errors/retry, revocation and mobile; no browser runtime errors');
  await context.close();
} finally {
  await browser.close(); rmSync(routePath, { recursive: true, force: true });
}

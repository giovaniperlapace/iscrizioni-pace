import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:3159';
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const context = await browser.newContext();
  // No physical job is submitted by automation. Exercise the real client instead.
  await context.addInitScript(() => {
    window.print = () => {
      window.top.__printCalls = (window.top.__printCalls ?? 0) + 1;
      window.dispatchEvent(new Event('afterprint'));
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const requests = [];
  page.on('request', request => { if (request.url().includes('/silent-label-document.html')) requests.push(request.url()); });
  await page.goto(`${base}/silent-label-test.html`);
  await page.getByRole('button', { name: 'Stampa etichetta QR', exact: true }).click();
  await page.waitForFunction(() => window.__printCalls === 1);
  await page.getByText('Comando di stampa avviato. Verifica l’etichetta fisica.', { exact: true }).waitFor();
  assert.equal(context.pages().length, 1, 'No popup or extra tab');
  assert.equal(await page.locator('iframe').count(), 0, 'Print frame cleaned up');
  await page.screenshot({ path: '/tmp/iscrizioni-silent-button-qa.png' });
  await page.getByRole('button', { name: 'Ristampa etichetta QR', exact: true }).click();
  await page.waitForFunction(() => window.__printCalls === 2);
  await page.getByText('Comando di stampa avviato. Verifica l’etichetta fisica.', { exact: true }).waitFor();
  assert.equal(requests.length, 2, 'Document reread on explicit reprint');
  assert.notEqual(requests[0], requests[1], 'Each print has a fresh request identifier');
  console.log('PASS: one click, same page, fresh reprint, cleanup, no physical success claimed');
  for (const status of [401, 403, 404, 500]) {
    await page.route('**/silent-label-document.html?*', route => route.fulfill({ status, contentType: 'text/plain', body: 'Etichetta non disponibile.' }));
    await page.goto(`${base}/silent-label-test.html`);
    await page.getByRole('button', { name: 'Stampa etichetta QR', exact: true }).click();
    await page.getByText('Impossibile avviare la stampa.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__printCalls ?? 0), 0);
    assert.equal(await page.locator('iframe').count(), 0);
    await page.unroute('**/silent-label-document.html?*');
  }
  console.log('PASS: authentication/scope/error documents never print');
  await page.goto(`${base}/silent-label-test.html`);
  const checks = await page.evaluate(async () => {
    const { printQrLabel } = await import('./print-client.js');
    const controller = new AbortController();
    const pending = printQrLabel('./silent-label-document.html', controller.signal);
    const duplicate = await printQrLabel('./silent-label-document.html', new AbortController().signal).then(() => false, () => true);
    controller.abort();
    const aborted = await pending.then(() => false, error => error.name === 'AbortError');
    const foreign = await printQrLabel('https://foreign.test/label', new AbortController().signal).then(() => false, () => true);
    return { duplicate, aborted, foreign };
  });
  assert.deepEqual(checks, { duplicate: true, aborted: true, foreign: true });
  assert.equal(await page.locator('iframe').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: concurrent clicks, cancellation, and foreign origins rejected');
} finally { await browser.close(); }

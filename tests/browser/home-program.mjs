// Local synthetic service only. Start home-program-mock.mjs and Next dev with
// Supabase URLs pointing to http://127.0.0.1:55441. No real data or email.
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.argv[2] ?? "http://127.0.0.1:3125";
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const control = async params => fetch(`http://127.0.0.1:55441/control?${new URLSearchParams(params)}`);
const requests = async () => (await fetch("http://127.0.0.1:55441/requests")).json();
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const anonymous = await browser.newContext({ locale: "it-IT" });
  const page = await anonymous.newPage();
  await control({ mode: "internal" });
  await page.goto(base);
  assert.equal(await page.locator("#event-program, #panel-program").count(), 0);
  assert.equal(await page.locator('input[type="email"]').count(), 1);
  const denied = await anonymous.request.get(`${base}/dashboard/anteprima-home`, { maxRedirects: 0 });
  assert.equal(denied.status(), 307);
  assert.match(denied.headers().location, /\/login/);
  await control({ mode: "catalog" });
  await page.goto(base);
  assert.equal(await page.locator("#event-program > div > ol > li").count(), 3);
  assert.equal(await page.locator("#schools, a.panel-access-cue").count(), 0);
  assert.match(await page.locator("#panel-program").innerText(), /Panel pubblico sintetico/);
  await control({ mode: "internal", role: "admin" });
  const context = await browser.newContext({ locale: "it-IT" });
  const jwt = [ { alg: "HS256", typ: "JWT" }, { sub: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" } ].map(value => Buffer.from(JSON.stringify(value)).toString("base64url")).join(".") + ".synthetic";
  const session = { access_token: jwt, refresh_token: "synthetic", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "synthetic@example.invalid" } };
  await context.addCookies([{ name: "sb-127-auth-token", value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"), url: base }, { name: "iscrizioni_last_activity", value: String(Date.now()), url: base }]);
  const preview = await context.newPage();
  const errors = [];
  preview.on("pageerror", error => errors.push(error.message));
  for (const role of ["admin", "manager"]) {
    await control({ role });
    await preview.goto(`${base}/dashboard/anteprima-home`);
    assert.match(await preview.locator("#panel-program").innerText(), /Panel sintetico in bozza/);
    assert.match(await preview.locator("#panel-program").innerText(), /50/);
    assert.equal(await preview.locator('input[type="email"]').isDisabled(), true);
    assert.equal(await preview.locator("#schools").count(), 0);
    assert.equal(await preview.locator('a.panel-access-cue[href="#top"]').count(), 1);
    assert.match(await preview.locator('meta[name="robots"]').getAttribute("content"), /noindex/);
  }
  for (const width of [1440, 390]) {
    await preview.setViewportSize({ width, height: 900 });
    assert.equal(await preview.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await preview.locator("#event-program").scrollIntoViewIfNeeded();
    await preview.evaluate(() => window.scrollTo(0, 0));
    await preview.screenshot({ path: `/tmp/pace-home-program-${width}.png`, fullPage: true });
  }
  await control({ changed: "true" });
  await preview.reload();
  const updated = await preview.locator("#panel-program").innerText();
  assert.match(updated, /Titolo modificato/);
  assert.match(updated, /Nuova location/);
  assert.match(updated, /10:00/);
  assert.match(updated, /Posti disponibili per gli iscritti: 0/);
  for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"]) {
    await context.addCookies([{ name: "iscrizioni_locale", value: locale, url: base }]);
    await preview.reload();
    assert.equal(await preview.locator("html").getAttribute("lang"), locale);
    assert.equal(await preview.locator("#event-program > div > ol > li").count(), 3);
    assert.equal(await preview.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, locale);
  }
  for (const role of ["manager_viewer", "foreign", "capogruppo", "partecipante"]) {
    await control({ role });
    const before = (await requests()).length;
    const response = await context.request.get(`${base}/dashboard/anteprima-home`, { maxRedirects: 0 });
    assert.equal(response.status(), 307, role);
    assert.ok(!(await requests()).slice(before).some(request => request.path.includes("event_moments")), role + " cannot load panel data");
  }
  assert.deepEqual(errors, []);
  assert.ok((await requests()).every(request => ["GET", "POST"].includes(request.method) && (!request.path.includes("rpc/") || request.path.endsWith("get_panel_release_mode") || request.path.endsWith("get_panel_seat_availability") || request.path.endsWith("get_public_panel_program"))), "no write or email RPC");
  console.log("PASS hidden/public homes, real private route, drafts, live DB changes, Admin/Manager scope, denied roles, desktop/mobile, no email or writes");
} finally { await browser.close(); }

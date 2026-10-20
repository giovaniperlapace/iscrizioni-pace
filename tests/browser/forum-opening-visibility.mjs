// Actual home and direct Forum route; local synthetic Supabase only.
// Run home-program-mock.mjs and an isolated Next instance pointing to its port.
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.FORUM_VISIBILITY_URL ?? "http://localhost:3199";
const mock = process.env.FORUM_VISIBILITY_MOCK ?? "http://127.0.0.1:55542";
for (const url of [base, mock]) assert.match(url, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const mode of ["open", "internal", "catalog", "open"]) {
      await fetch(`${mock}/control?mode=${mode}`);
      const before = (await (await fetch(`${mock}/requests`)).json()).length;
      await page.goto(`${base}/?forum=99999999-9999-4999-8999-999999999999`);
      if (mode === "open") {
        await page.locator("#panel-program").waitFor();
        assert.match(await page.locator("#panel-program").innerText(), /Panel pubblico sintetico/);
      } else {
        assert.equal(await page.locator("#panel-program, #event-program").count(), 0);
        assert.equal(await page.locator('input[type="email"]').count(), 1);
        const requests = (await (await fetch(`${mock}/requests`)).json()).slice(before);
        assert.ok(requests.every(request => !request.path.endsWith("get_public_panel_program")), "closed home must not load public Forums");
        const direct = await page.request.get(`${base}/forum/99999999-9999-4999-8999-999999999999`);
        assert.equal(direct.status(), 404);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `/tmp/forum-visibility-${mode}-${width}.png`, fullPage: true });
    }
  }
  assert.deepEqual(errors, []);
  console.log("PASS public home desktop/mobile: open visible; internal/catalog hidden without catalog loading; direct closed links 404; reopening visible");
} finally {
  await browser.close();
}

// Local fixture only: real table, filter form, router and server-side filtering.
// Run in a clean checkout without database credentials against next dev.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const base = process.argv[2] ?? "http://127.0.0.1:3142";
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
assert.ok(!existsSync(".env.local"), "Use an isolated checkout without credentials");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const saved = new Map();
for (const dashboard of ["admin", "manager"]) {
  const path = `app/dashboard/${dashboard}/page.tsx`;
  saved.set(path, readFileSync(path, "utf8"));
  writeFileSync(path, `import { PerformanceFixture } from "@/tests/browser/dashboard-performance-fixture";
export default function Page(props: { searchParams: Promise<Record<string, string>> }) {
  return <><div style={{height: 700}}>Fixture sintetica</div><PerformanceFixture {...props} dashboard="${dashboard}" /><div style={{height: 1200}} /></>;
}`);
}

try {
  for (const [engine, browserType] of [["chromium", chromium]]) {
    const browser = await browserType.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE });
    try {
      for (const dashboard of ["admin", "manager"]) for (const mobile of [false, true]) {
        const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("**/api/auth/activity", route => route.fulfill({ json: {} }));
        await page.route("**/dashboard/attendance?*", route => route.fulfill({ status: 403, json: {} }));
        await page.route("**/*_rsc=*", async route => {
          // A slow response exposes accidental replacement of newly typed text.
          await new Promise(resolve => setTimeout(resolve, 700));
          await route.continue();
        });
        await page.goto(`${base}/dashboard/${dashboard}?section=iscritti&nav=mini&columns=name,country,group&sort=name&direction=asc`);
        await page.getByRole("form", { name: "Ricerca iscritti" }).waitFor();
        await page.waitForTimeout(700);
        const form = page.getByRole("form", { name: "Ricerca iscritti" });
        const q = form.locator('[name="q"]');
        const contact = form.locator('[name="contact"]');
        const search = form.getByRole("button", { name: "Cerca", exact: true });
        const reset = form.getByRole("button", { name: "Azzera filtri" });
        const idle = () => page.waitForFunction(() => document.querySelector('[aria-label="Ricerca iscritti"]').getAttribute("aria-busy") === "false");
        let navigations = 0, documents = 0;
        page.on("request", request => {
          if (request.url().includes("_rsc=")) navigations++;
          if (request.resourceType() === "document") documents++;
        });
        await q.fill("Anna");
        await page.waitForTimeout(1200);
        assert.equal(navigations, 0, "typing never starts a search");
        await q.evaluate(el => { window.searchInput = el; window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 150, behavior: "instant" }); });
        const scroll = await page.evaluate(() => scrollY);
        await q.press("Enter");
        await page.waitForFunction(() => document.querySelector('[aria-label="Ricerca iscritti"]').getAttribute("aria-busy") === "true");
        await q.pressSequentially(" Test 49");
        await idle();
        assert.equal(new URL(page.url()).searchParams.get("q"), "Anna");
        assert.equal(await q.inputValue(), "Anna Test 49", "late response preserves new draft");
        assert.equal(await q.evaluate(el => el === window.searchInput && document.activeElement === el), true, "input and focus are preserved");
        const afterScroll = await page.evaluate(() => scrollY);
        assert.ok(Math.abs(afterScroll - scroll) < 5, `search preserves scroll: ${scroll} -> ${afterScroll}`);
        assert.equal(navigations, 1);
        await search.click(); await idle();
        assert.equal(new URL(page.url()).searchParams.get("q"), "Anna Test 49");
        assert.equal(await page.locator("tbody tr").count(), 11);
        await reset.click(); await idle();
        assert.equal(await q.inputValue(), "");
        assert.equal(await page.locator("tbody tr").count(), 100);
        for (const [field, value, count] of [[q, "P123", 1], [q, "Roma", 500], [contact, "fixture123@example.test", 1], [contact, "+39 1234567", 500]]) {
          await field.fill(value);
          const before = navigations;
          await page.waitForTimeout(1100);
          assert.equal(navigations, before);
          await field.press("Enter"); await idle();
          assert.equal(await page.locator("tbody tr").count(), Math.min(count, 100));
          await reset.click(); await idle();
        }
        await form.locator('[name="group"]').selectOption("none");
        await form.locator('[name="service"]').selectOption("none");
        await form.locator('[name="tag"]').selectOption("none");
        await q.fill("No matching person");
        const before = navigations;
        await page.waitForTimeout(1100);
        assert.equal(navigations, before, "select filters also wait for explicit submission");
        await search.click(); await idle();
        assert.equal(new URL(page.url()).searchParams.get("group"), "none");
        assert.equal(new URL(page.url()).searchParams.get("columns"), "name,country,group");
        await reset.click(); await idle();
        for (const name of ["group", "service", "tag"]) assert.equal(await form.locator(`[name="${name}"]`).inputValue(), "all");
        await q.fill("Not submitted");
        await reset.click(); await idle();
        assert.equal(await q.inputValue(), "", "reset clears even an unsubmitted draft");
        const beforeRepeat = navigations;
        await search.click(); await idle();
        assert.equal(navigations, beforeRepeat + 1, "explicit repeat refreshes results");
        assert.equal(documents, 0, "search and reset never reload the document");
        assert.deepEqual(errors, []);
        await form.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `/tmp/pace-search-${engine}-${dashboard}-${mobile ? "mobile" : "desktop"}.png` });
        console.log(`PASS ${engine} ${dashboard} ${mobile ? "mobile" : "desktop"}: explicit search, slow response, focus, scroll, filters, reset, repeat, no reload`);
        await page.close();
      }
    } finally { await browser.close(); }
  }
} finally { for (const [path, content] of saved) writeFileSync(path, content); }

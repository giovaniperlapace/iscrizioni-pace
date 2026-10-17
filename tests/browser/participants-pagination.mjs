// Run only in an isolated copy without database credentials against next dev.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const base = process.argv[2] ?? "http://127.0.0.1:3157";
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
assert.ok(!existsSync(".env.local"), "Use an isolated checkout without credentials");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const saved = new Map();
for (const dashboard of ["admin", "manager"]) {
  const path = `app/dashboard/${dashboard}/page.tsx`;
  saved.set(path, readFileSync(path, "utf8"));
  writeFileSync(path, `import { PaginationFixture } from "@/tests/browser/participants-pagination-fixture";
export default function Page(props: { searchParams: Promise<Record<string, string>> }) {
  return <PaginationFixture {...props} dashboard="${dashboard}" />;
}`);
}

// Reception is independently tested with its SQL service; here only sheet navigation is exercised.
const receptionPath = "app/dashboard/participants/reception-actions.ts";
saved.set(receptionPath, readFileSync(receptionPath, "utf8"));
writeFileSync(receptionPath, `"use server";
export async function participantReceptionCommand() { return { status: "forbidden" } as const; }
export async function participantLabelCommand() { return { status: "forbidden" } as const; }
`);

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE });
try {
  for (const dashboard of ["admin", "manager", "viewer"]) for (const mobile of [false, true]) {
    const routeDashboard = dashboard === "viewer" ? "manager" : dashboard;
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/auth/activity", route => route.fulfill({ json: {} }));
    await page.route("**/dashboard/participants/qr?*", route => route.fulfill({ status: 403, json: {} }));
    await page.route("**/dashboard/attendance?*", route => route.fulfill({ json: {
      eventId: "event", updatedAt: "2026-10-17T10:00:00Z", schoolEntries: {},
      entries: { "00000000-0000-4000-8000-000000000100:adult": "2026-10-17T10:00:00Z" },
      totals: { people: 1, adults: 1, children: 0, students: 0, companions: 0, schoolBookings: 0 },
    } }));
    const start = `${base}/dashboard/${routeDashboard}?section=iscritti&nav=mini&columns=name,country,group&sort=name&direction=asc${dashboard === "viewer" ? "&viewer=1" : ""}`;
    const form = page.getByRole("form", { name: "Ricerca iscritti" });
    const q = form.locator('[name="q"]');
    const top = page.getByRole("navigation", { name: "Pagine iscritti, inizio elenco" });
    const bottom = page.getByRole("navigation", { name: "Pagine iscritti, fine elenco" });
    const firstName = () => page.locator("tbody tr").first().locator("td").first().getByRole("link").innerText();
    const idle = () => page.waitForFunction(() => document.querySelector('[aria-label="Ricerca iscritti"]').getAttribute("aria-busy") === "false");
    const pageIs = async (value) => {
      await page.waitForFunction(value => document.querySelector('[aria-label="Pagine iscritti, inizio elenco"] select')?.value === value, String(value));
    };
    let serverNavigations = 0, documents = 0;
    page.on("request", request => {
      if (request.url().includes("_rsc=")) serverNavigations++;
      if (request.resourceType() === "document") documents++;
    });
    await page.goto(start);
    await form.waitFor();
    await page.waitForTimeout(300);
    assert.equal(await page.locator("tbody tr").count(), 100);
    assert.match(await top.innerText(), /1–100 di 1203/);
    assert.equal(await top.getByRole("button", { name: "Precedente" }).isDisabled(), true);
    assert.equal(await firstName(), "Anna Test 0");
    const initialServer = serverNavigations, initialDocuments = documents;
    await q.fill("Non ancora applicato");
    await bottom.getByRole("button", { name: "Successiva" }).click(); await pageIs(2);
    assert.equal(await firstName(), "Anna Test 100");
    assert.equal(await q.inputValue(), "Non ancora applicato", "page change preserves unapplied draft");
    assert.equal(new URL(page.url()).searchParams.has("q"), false);
    assert.equal(await page.locator("tbody tr").count(), 100);
    assert.match(await page.locator("tbody tr").first().innerText(), /Minore Prova/);
    assert.match(await page.locator("tbody tr").first().innerText(), /Partecipazione confermata/);
    assert.match(await page.locator("tbody tr li").first().innerText(), /Partecipazione non confermata/);
    await page.locator("tbody tr").first().locator("td").first().getByRole("link").click();
    await page.locator("dialog[open]").waitFor();
    assert.equal(await page.locator('dialog input[name="lastName"]').first().inputValue(), "Test 100");
    assert.equal(await page.locator('dialog input[name="lastName"]').first().isDisabled(), dashboard === "viewer");
    assert.equal(new URL(await page.locator('dialog input[name="returnTo"]').first().inputValue(), base).searchParams.get("participantPage"), "2");
    if (dashboard !== "viewer") await page.waitForFunction(() => document.querySelector('[aria-label="Partecipazione e stampa QR"]')?.getAttribute("aria-busy") === "false");
    await page.keyboard.press("Escape");
    await page.locator("dialog[open]").waitFor({ state: "detached" }); await pageIs(2);
    await top.getByLabel("Pagina", { exact: true }).selectOption("13"); await pageIs(13);
    assert.equal(await page.locator("tbody tr").count(), 3);
    assert.equal(await firstName(), "Anna Test 1200");
    assert.equal(await top.getByRole("button", { name: "Successiva" }).isDisabled(), true);
    await page.goBack(); await pageIs(2);
    await page.goForward(); await pageIs(13);
    assert.equal(serverNavigations, initialServer, "page changes and dialogs do not requery server");
    assert.equal(documents, initialDocuments);
    await page.reload(); await form.waitFor(); await pageIs(13);
    assert.equal(await firstName(), "Anna Test 1200", "reload preserves page");

    // Search locates a record outside page one, and starts at page one.
    await q.fill("P1001"); await q.press("Enter"); await idle(); await pageIs(1);
    assert.equal(await page.locator("tbody tr").count(), 1);
    assert.equal(await firstName(), "Anna Test 1001");
    assert.equal(new URL(page.url()).searchParams.has("participantPage"), false);
    await form.getByRole("button", { name: "Azzera filtri" }).click(); await idle();
    await q.fill("Roma");
    await form.locator('[name="contact"]').fill("@example.test");
    for (const key of ["group", "service", "tag"]) await form.locator(`[name="${key}"]`).selectOption(key);
    await form.getByRole("button", { name: "Cerca", exact: true }).click(); await idle();
    assert.match(await top.innerText(), /1–100 di 602/);
    const applied = new URL(page.url()).searchParams;
    await q.fill("Bozza conservata");
    await top.getByRole("button", { name: "Successiva" }).click(); await pageIs(2);
    assert.equal(await firstName(), "Anna Test 200");
    for (const key of ["q", "contact", "group", "service", "tag", "columns", "sort", "direction", "nav"]) {
      assert.equal(new URL(page.url()).searchParams.get(key), applied.get(key), `${key} survives pagination`);
    }
    assert.equal(await q.inputValue(), "Bozza conservata");
    const exportUrl = new URL(await page.getByRole("link", { name: "Esporta iscritti" }).getAttribute("href"), base);
    assert.equal(exportUrl.searchParams.has("participantPage"), false);
    for (const key of ["q", "contact", "group", "service", "tag"]) assert.equal(exportUrl.searchParams.get(key), applied.get(key));
    await top.getByLabel("Pagina", { exact: true }).selectOption("7"); await pageIs(7);
    assert.equal(await page.locator("tbody tr").count(), 2);
    await page.getByRole("columnheader", { name: "Partecipante" }).getByRole("button").click(); await pageIs(1);
    assert.equal(await firstName(), "Anna Test 1202", "sort is global before pagination");
    assert.equal(new URL(page.url()).searchParams.get("group"), "group");
    await top.getByRole("button", { name: "Successiva" }).click(); await pageIs(2);
    await q.fill("Nessuna corrispondenza"); await q.press("Enter"); await idle(); await pageIs(1);
    assert.equal(await page.locator("tbody tr").count(), 0);
    assert.match(await top.innerText(), /0–0 di 0/);
    await form.getByRole("button", { name: "Azzera filtri" }).click(); await idle();
    assert.match(await top.innerText(), /1–100 di 1203/);

    await page.goto(start + "&stat=fixture&participantPage=3"); await form.waitFor(); await pageIs(3);
    assert.match(await top.innerText(), /201–300 di 303/);
    await top.getByRole("button", { name: "Successiva" }).click(); await pageIs(4);
    assert.equal(await page.locator("tbody tr").count(), 3);
    assert.equal(new URL(page.url()).searchParams.get("stat"), "fixture");
    await page.getByRole("navigation", { name: "Sezioni partecipanti" }).getByRole("link", { name: "Senza gruppo", exact: true }).click();
    await page.waitForURL(url => url.searchParams.get("view") === "without-group"); await pageIs(1);
    assert.match(await top.innerText(), /1–100 di 601/);
    assert.equal(new URL(page.url()).searchParams.has("stat"), false);
    await top.getByLabel("Pagina", { exact: true }).selectOption("7"); await pageIs(7);
    assert.equal(await firstName(), "Anna Test 1201");
    assert.equal(await page.locator("tbody tr").count(), 1);
    await page.goto(start + "&participantPage=9999"); await form.waitFor(); await pageIs(13);
    assert.equal(await page.locator("tbody tr").count(), 3);
    await page.goto(start + "&participantPage=invalid"); await form.waitFor(); await pageIs(1);
    if (dashboard === "admin") {
      await top.getByRole("button", { name: "Successiva" }).click(); await pageIs(2);
      await page.getByRole("link", { name: "Iscrizioni eliminate", exact: true }).click();
      await page.waitForURL(url => url.searchParams.get("view") === "deleted"); await pageIs(1);
      assert.match(await page.locator("tbody tr").first().innerText(), /Iscrizione non operativa/);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "mobile controls fit the viewport");
    await top.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/pace-pagination-${dashboard}-${mobile ? "mobile" : "desktop"}.png` });
    assert.deepEqual(errors, []);
    console.log(`PASS ${dashboard} ${mobile ? "mobile" : "desktop"}: 1203 rows, 100/page, global filters/sort/totals, last/empty pages, drafts, history, reload, dialogs, children, presence, export URL, views, invalid pages`);
    await page.close();
  }
} finally {
  await browser.close();
  for (const [path, content] of saved) writeFileSync(path, content);
}

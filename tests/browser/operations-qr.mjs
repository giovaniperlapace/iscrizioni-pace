import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { renderQrDataUrl } from "../../lib/qrcode/render.ts";
import { renderParticipantQrPng } from "../../lib/qrcode/participant-card.ts";
const base = process.argv[2] ?? "http://localhost:3147";
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
assert.ok(!existsSync(".env.local"), "Run in an isolated copy without real credentials");
const route = "app/operations-qr-check";
assert.ok(!existsSync(route));
mkdirSync(route);
writeFileSync(`${route}/page.tsx`, 'export { default } from "@/tests/browser/participant-operations-fixture";');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {});
const token = "synthetic-manager-selected-qr";
const png = await renderParticipantQrPng(token, { first_name: "Anna", last_name: "Bianchi", public_code: "FIX0" });
const qr = { state: "active", dataUrl: await renderQrDataUrl(token), downloadDataUrl: `data:image/png;base64,${png.toString("base64")}`, expiresAt: null };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => { errors.push(error.message); console.error(error.message); });
  let mode = "active", requests = 0;
  await page.route("**/dashboard/participants/**", async route => {
    if (!route.request().url().includes("/participants/qr?")) return route.fulfill({ status: 403, json: {} });
    requests++;
    if (mode === "error") return route.fulfill({ status: 500, json: {} });
    if (mode === "delayed") await new Promise(resolve => setTimeout(resolve, 600));
    const id = new URL(route.request().url()).searchParams.get("registrationId");
    return route.fulfill({ json: { qr: mode === "revoked" || id !== "reg-0" ? { state: "revoked", dataUrl: null, downloadDataUrl: null, expiresAt: null } : qr } });
  });
  const open = async (name = "Anna Bianchi") => {
    await page.getByRole("link", { name, exact: true }).click();
    await page.locator("dialog[open]").waitFor();
  };
  const close = async () => { await page.keyboard.press("Escape"); await page.locator("dialog[open]").waitFor({ state: "detached" }); };
  for (const dashboard of ["manager", "admin"]) {
    await page.goto(`${base}/operations-qr-check?section=iscritti&nav=mini&dashboard=${dashboard}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Anna Bianchi", exact: true }).waitFor();
    const before = requests;
    await open();
    await page.getByRole("img", { name: "QR code del partecipante: Anna Bianchi", exact: true }).waitFor();
    assert.ok(requests > before && requests <= before + 2, "Selected QR requested; dev StrictMode may remount once");
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Scarica immagine: Anna Bianchi" }).click();
    const downloaded = await download;
    assert.equal(downloaded.suggestedFilename(), "qr-Anna-Bianchi.png");
    assert.deepEqual(readFileSync(await downloaded.path()), png);
    await page.screenshot({ path: `/tmp/operations-qr-${dashboard}-desktop.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `/tmp/operations-qr-${dashboard}-mobile.png` });
    await close();
    assert.ok(new URL(page.url()).searchParams.has("dashboard"));
    mode = "error";
    await open();
    await page.getByText("Impossibile caricare il QR.", { exact: true }).waitFor();
    mode = "active";
    await page.getByRole("button", { name: "Riprova", exact: true }).click();
    await page.getByRole("link", { name: "Scarica immagine: Anna Bianchi" }).waitFor();
    await close();
    mode = "delayed";
    await open();
    await close();
    await open("Persona Prova 1");
    await page.getByText("QR code revocato", { exact: true }).waitFor({ timeout: 5000 }).catch(async error => {
      console.log(await page.locator("dialog").innerText());
      throw error;
    });
    assert.equal(await page.locator("dialog img, dialog a[download]").count(), 0);
    await close();
    mode = "active";
    await page.getByRole("button", { name: "Modalità sola lettura", exact: true }).click();
    const beforeViewer = requests;
    await open();
    assert.equal(await page.locator("dialog [aria-label='QR code del partecipante']").count(), 0);
    assert.equal(requests, beforeViewer);
    await close();
    await page.setViewportSize({ width: 1440, height: 1000 });
    console.log(`PASS ${dashboard}: individual QR, named download, mobile, retry, switch, viewer exclusion`);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  rmSync(route, { recursive: true, force: true });
}

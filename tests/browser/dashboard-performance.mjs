// Run against a local server in an isolated checkout without .env files.
// PLAYWRIGHT_MODULE may point to the bundled runtime's playwright/index.mjs.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const base = process.argv[2] ?? "http://127.0.0.1:3138";
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
assert.ok(!existsSync(".env.local"), "Use an isolated checkout without database credentials");
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const saved = new Map();
for (const dashboard of ["admin", "manager"]) {
  const path = `app/dashboard/${dashboard}/page.tsx`;
  saved.set(path, readFileSync(path, "utf8"));
  writeFileSync(path, `import { PerformanceFixture } from "@/tests/browser/dashboard-performance-fixture";\nexport default function Page(props: { searchParams: Promise<Record<string, string>> }) { return <PerformanceFixture {...props} dashboard="${dashboard}" />; }\n`);
}
const results=[];
try {
 for (const [engine, browserType] of [["chromium",chromium],["webkit",webkit]]) {
  const browser=await browserType.launch({headless:true});
  try {
   for (const dashboard of ["admin","manager"]) {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];page.on("pageerror",error=>errors.push(error.message));
    const goTo = async (url) => { await page.waitForLoadState("networkidle"); await page.goto(url); await page.waitForLoadState("networkidle"); };
    let activity=0;let attendanceReads=0;let attendanceFailure=false;
    await page.route("**/api/auth/activity",async route=>{activity++;await route.fulfill({status:200,body:"{}",contentType:"application/json"});});
    await page.route("**/dashboard/participants/attendance?*",async route=>{
      attendanceReads++;
      await new Promise(resolve=>setTimeout(resolve,250));
      await route.fulfill({status:attendanceFailure?500:200,contentType:"application/json",body:JSON.stringify({attendance:{startsOn:"2026-10-25",endsOn:"2026-10-27",unknown:false,slots:["2026-10-25__morning"]}})}).catch(()=>{});
    });
    const path=`${base}/dashboard/${dashboard}?section=iscritti&nav=mini&q=Anna&columns=name,country,group&sort=name&direction=asc`;
    await goTo(path);await page.locator("tbody tr").first().waitFor();await page.waitForTimeout(300);
    assert.equal(await page.locator("tbody tr").count(),500);
    const requests=[];page.on("request",request=>{if(request.url().includes("_rsc=")) requests.push(request.url());});
    const first=page.locator("tbody a").first();
    const selectedHref=await first.getAttribute("href");
    const open=await page.evaluate(async()=>{const start=performance.now();document.querySelector("tbody a").click();while(!document.querySelector("dialog[open]")) await new Promise(r=>requestAnimationFrame(r));return performance.now()-start;});
    await page.goBack();await page.locator("dialog[open]").waitFor({state:"detached"});
    await page.goForward();await page.locator("dialog[open]").waitFor();
    assert.equal(await page.locator('dialog input[name="firstName"]').inputValue(),"Anna");
    const close=await page.evaluate(async()=>{const start=performance.now();document.querySelector('[aria-label="Chiudi scheda partecipante"]').click();while(document.querySelector("dialog[open]")) await new Promise(r=>requestAnimationFrame(r));return performance.now()-start;});
    assert.equal(requests.length,0,"opening, history and closing do not navigate on server");
    assert.equal(activity,1,"local dialog state does not force redundant session checks");
    assert.equal(new URL(page.url()).searchParams.get("q"),"Anna");
    assert.equal(new URL(page.url()).searchParams.get("columns"),"name,country,group");
    assert.equal(await first.evaluate(e=>document.activeElement===e),true,"focus returns to original name");
    await first.click();await page.locator("dialog[open]").waitFor();await page.keyboard.press("Escape");await page.locator("dialog[open]").waitFor({state:"detached"});
    await goTo(base+selectedHref);await page.locator("dialog[open]").waitFor();
    await page.waitForLoadState("networkidle");await page.reload();await page.waitForLoadState("networkidle");await page.locator("dialog[open]").waitFor();
    await page.getByLabel("Chiudi scheda partecipante").click();await page.locator("dialog[open]").waitFor({state:"detached"});
    // Small viewport, deep links, different participant, and unchanged form fields.
    await page.setViewportSize({width:390,height:844});await first.click();await page.locator("dialog[open]").waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`/tmp/pace-performance-${engine}-${dashboard}-mobile.png`});
    await page.getByLabel("Chiudi scheda partecipante").click();
    await page.locator("tbody a").nth(1).click();await page.locator("dialog[open]").waitFor();
    assert.equal(await page.locator('dialog input[name="lastName"]').inputValue(),"Test 1");
    await goTo(path+"&viewer=1");await first.click();await page.locator("dialog[open]").waitFor();
    assert.equal(await page.locator('dialog input[name="firstName"]').isDisabled(),true);
    assert.equal(await page.getByRole("button",{name:"Salva dati",exact:true}).count(),0);
    assert.equal(attendanceReads,0);
    // Real lazy attendance component: slow response, cancellation, retry on reopen.
    await goTo(path+"&attendance=live");await page.waitForTimeout(500);
    attendanceFailure=true;
    await first.click();await page.getByText("Impossibile caricare le presenze. Riapri la scheda per riprovare.").waitFor();
    await page.getByLabel("Chiudi scheda partecipante").click();attendanceFailure=false;
    await first.click();await page.getByRole("button",{name:"Salva presenze",exact:true}).waitFor();
    assert.equal(await page.locator('dialog input[name="availabilitySlots"]:checked').count(),1);
    await page.getByLabel("Chiudi scheda partecipante").click();
    await first.click();await page.getByLabel("Chiudi scheda partecipante").click();await page.waitForTimeout(350);
    assert.equal(await page.locator("dialog[open]").count(),0,"late response does not reopen a closed sheet");
    assert.deepEqual(errors,[]);
    console.log(`PASS ${engine} ${dashboard}: navigation, history, permissions, mobile, attendance errors and cancellation`);
    results.push({engine,dashboard,openMs:Math.round(open),closeMs:Math.round(close),initialDialogServerNavigations:0,passed:true});
    await page.close();
   }
  } finally {await browser.close();}
 }
 console.log(JSON.stringify(results,null,2));
} finally {for(const [path,content] of saved)writeFileSync(path,content);}

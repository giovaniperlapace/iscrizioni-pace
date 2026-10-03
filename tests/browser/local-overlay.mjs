import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
const base=process.argv[2] ?? "http://127.0.0.1:3139";
assert.match(base,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
assert.ok(!existsSync(".env.local"));
const route="app/local-overlay-check";
assert.ok(!existsSync(route));mkdirSync(route);
writeFileSync(`${route}/page.tsx`, `import { LocalOverlay } from "@/app/dashboard/local-overlay";
import { LocalQueryLink } from "@/components/local-query-link";
export default async function Page({searchParams}: { searchParams: Promise<Record<string,string>> }) {
 const params=await searchParams;
 return <main><p>Elenco partecipanti</p><LocalOverlay parameter="assignmentId" value={params.assignmentId ?? "fixture"}>
 <div role="dialog"><h2>Scheda partecipante</h2><LocalQueryLink href="/local-overlay-check?q=Anna" scroll={false}>Chiudi</LocalQueryLink></div>
 </LocalOverlay></main>;
}`);
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE??"playwright");
try {
 for (const [name,type] of [["chromium",chromium],["webkit",webkit]]) {
  const browser=await type.launch();
  try {
   const page=await browser.newPage();await page.goto(`${base}/local-overlay-check?assignmentId=fixture&q=Anna`);await page.waitForLoadState("networkidle");
   const requests=[];page.on("request",r=>{if(r.url().includes("_rsc="))requests.push(r.url())});
   await page.getByText("Chiudi",{exact:true}).click();await page.getByRole("dialog").waitFor({state:"detached"});
   assert.equal(new URL(page.url()).searchParams.get("q"),"Anna");assert.equal(requests.length,0);
   await page.goBack();await page.getByRole("dialog").waitFor();assert.equal(requests.length,0);
   await page.goForward();await page.getByRole("dialog").waitFor({state:"detached"});assert.equal(requests.length,0);
   console.log(`PASS ${name}: server-rendered overlay closes and follows history without server navigation`);
  } finally {await browser.close();}
 }
}finally{rmSync(route,{recursive:true,force:true});}

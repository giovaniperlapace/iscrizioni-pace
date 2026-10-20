// Copy forum-order-fixture.tsx into app/forum-order-check/page.tsx in an isolated checkout.
// Run Next locally with synthetic Supabase configuration; no real credentials.
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
 const page=await browser.newPage({locale:'it-IT'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3186/forum-order-check');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  const participant=await page.locator('#participant article h4, #participant article h3').allTextContents();
  const leader=await page.locator('#group-panel option').allTextContents();
  const pub=await page.locator('#public h5').allTextContents();
  const numbers=xs=>xs.filter(x=>/Forum \d+/.test(x)).map(x=>Number(x.match(/Forum (\d+)/)[1]));
  assert.deepEqual(numbers(participant),[1,2,9,10]);
  assert.deepEqual(numbers(leader),[1,2,9,10]);
  assert.deepEqual(numbers(pub),[1,2,9,10]);
  await page.screenshot({path:`/tmp/forum-order-${width}.png`});
  console.log('PASS participant, leader and public numeric order at '+width+'px');
 }
 assert.deepEqual(errors,[]);
} finally {await browser.close();}

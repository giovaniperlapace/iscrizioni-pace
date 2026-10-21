import {mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const route='app/forum-attendance-check';assert.ok(!existsSync(route));mkdirSync(route);
writeFileSync(`${route}/page.tsx`,`import {ParticipantPanelBookings} from '@/app/dashboard/partecipante/participant-panel-bookings';
import {EditableRegistrationInfo} from '@/app/dashboard/partecipante/editable-registration-info';
import {fixtureRows,fixtureRegistrationId} from '@/tests/browser/forum-waitlist-fixture';
import {normalizeLocale} from '@/lib/i18n/config';
export default async function Page({searchParams}:{searchParams:Promise<{locale?:string}>}) {const p=await searchParams;return <main className="p-4"><ParticipantPanelBookings locale={normalizeLocale(p.locale)??'it'} registrationId={fixtureRegistrationId} rows={fixtureRows} error="attendance"/><EditableRegistrationInfo id="declared-attendance" open label="Presenze comunicate" value="Da comunicare" editable copy={{edit:'Modifica',editUnavailable:'Non disponibile'}}><button>Salva presenze</button></EditableRegistrationInfo></main>;}`);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');let browser;
try {
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort());
 for(const width of [390,1440]) for(const locale of ['it','en','fr','de','es','nl','uk']){
  await page.setViewportSize({width,height:1000});await page.goto('http://localhost:3137/forum-attendance-check?locale='+locale);
  const alert=page.locator('[role=alert]');await alert.waitFor();assert.ok((await alert.innerText()).length>60);
  assert.equal(await alert.getByRole('link').getAttribute('href'),'/dashboard/partecipante?overlay=iscrizione&editAttendance=1#declared-attendance');
  assert.ok(await page.getByRole('button',{name:'Salva presenze',exact:true}).isVisible());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 assert.deepEqual(errors,[]);console.log('PASS attendance alert, edit link, expanded original attendance editor, seven languages desktop/mobile without writes');
}finally{await browser?.close();rmSync(route,{recursive:true,force:true});}

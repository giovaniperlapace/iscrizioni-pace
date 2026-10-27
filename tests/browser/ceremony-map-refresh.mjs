import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export async function checkClosingMapRefresh({ page, base, query, root, args }) {
  const execute = sql => execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', args, { input: sql, encoding: 'utf8' });
  execute("begin;select set_config('app.closing_event',f(1)::text,true);select set_config('app.closing_actor',f(33)::text,true);"
    + readFileSync('scripts/configure-closing-ceremony-2026-10-26.sql', 'utf8')
    + readFileSync('scripts/replace-closing-sectors-with-badges-2026-10-26.sql', 'utf8') + 'commit;');
  const route = `${root}/app/ceremony-draft-check/closing`;
  mkdirSync(route);
  writeFileSync(`${route}/page.tsx`, `import Fixture from '../fixture';import {query} from '../db';export const dynamic='force-dynamic';export default function Page(){return <Fixture desk={query("set role service_role;select get_ceremony_draft_desk(f(1),f(31),'closing');")}/>;}`);
  const output = '/tmp/pace-ceremony-map-refresh';
  mkdirSync(output, { recursive: true });
  let rejectDirectory = false, rejectMap = false, mapReads = 0;
  const intercept = async route => {
    const mapOnly = new URL(route.request().url()).searchParams.get('view') === 'map';
    if (mapOnly) mapReads++;
    if ((mapOnly && rejectMap) || (!mapOnly && rejectDirectory))
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ status: 'unavailable' }) });
    return route.fallback();
  };
  await page.route('**/dashboard/ceremonies/sectors?**', intercept);
  const counts = () => query("select jsonb_build_object('published',coalesce((select sum(quantity) from ceremony_allocations where plan_id=p.id and revoked_at is null),0),'drafts',(select count(*) from ceremony_assignment_drafts where plan_id=p.id and state='draft'),'emails',(select count(*) from ceremony_publication_emails where plan_id=p.id)) from ceremony_plans p where kind='closing'");
  try {
    for (const [index, width] of [1440, 390].entries()) {
      const result = query("set role service_role;select manage_ceremony_drafts(f(1),f(31),p.id,p.revision,gen_random_uuid(),'save',null,jsonb_build_object('action','group','sectorId',(select id from ceremony_sectors where plan_id=p.id and layout_code='CLOSING_PURPLE'),'groupId',f(7701),'quantity',28,'seatIds','[]'::jsonb,'subjects','[]'::jsonb)) from ceremony_plans p where kind='closing'");
      assert.equal(result.status, 'saved');
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
      await page.goto(base + '/ceremony-draft-check/closing', { waitUntil: 'networkidle' });
      const map = page.locator('svg[data-sector="CLOSING_PURPLE"]');
      assert.equal(await map.locator('rect[fill="#8b4513"]').count(), 28);
      const before = counts();
      rejectDirectory = true;
      const readsBefore = mapReads;
      await page.getByRole('button', { name: 'Conferma posti e invia notifica ai partecipanti', exact: true }).click();
      await page.getByRole('dialog', { name: 'Pubblicare i posti in bozza?', exact: true })
        .getByRole('button', { name: 'Conferma pubblicazione e notifiche', exact: true }).click();
      await page.getByText(/28 posti pubblicati\./).waitFor();
      await map.locator('rect[fill="#facc15"]').nth(28 * (index + 1) - 1).waitFor();
      assert.equal(await map.locator('rect[fill="#8b4513"]').count(), 0);
      await page.getByText(`0 in bozza · 0 nominali assegnati · ${28 * (index + 1)} da abbinare da parte del capogruppo`, { exact: true }).waitFor();
      assert.equal(mapReads, readsBefore + 1, 'publication refresh must read the map once, independently of the directory');
      assert.equal(await page.getByText(/Piantina non aggiornata/).count(), 0);
      const after = counts();
      assert.equal(after.published, before.published + 28);
      assert.equal(after.drafts, 0);
      assert.ok(after.emails > before.emails);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: `${output}/published-${width}.png`, fullPage: true });

      // A genuine map read failure is explicit; refreshing never republishes.
      rejectMap = true;
      await page.getByRole('button', { name: 'Aggiorna disponibilità', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Piantina non aggiornata' }).waitFor();
      rejectMap = false;
      await page.getByRole('button', { name: 'Aggiorna disponibilità', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Piantina non aggiornata' }).waitFor({ state: 'hidden' });
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Aggiorna disponibilità' && !b.disabled));
      assert.deepEqual(counts(), after);
      rejectDirectory = false;
    }
    console.log('PASS closing map desktop/mobile: real publication, 28/56 group places turn yellow despite unavailable directory; explicit map error and read-only recovery, no duplicate publications/emails');
  } finally {
    await page.unroute('**/dashboard/ceremonies/sectors?**', intercept);
    execute('begin;' + [
      'ceremony_publication_emails', 'ceremony_assignment_drafts',
      'ceremony_allocations', 'ceremony_quotas', 'ceremony_sectors',
      'closing_ceremony_badge_settings',
    ].map(table => `delete from ${table} where plan_id=(select id from ceremony_plans where kind='closing');`).join('')
      + "delete from ceremony_plans where kind='closing';commit;");
  }
}

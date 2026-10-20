import assert from 'node:assert/strict';
import test from 'node:test';
import { sortForums } from '../lib/panels/forum-order.ts';
import { getPublicSchoolBookingOptions } from '../lib/panels/public-school-bookings.ts';
import { groupPublicPanelsByDay } from '../lib/panels/public-program.ts';

test('Forum order is numerical, independent of start time, and does not mutate input', () => {
 const rows = [{title:'FORUM 10 - A',startsAt:'2026-10-26'}, {title:'Forum 9 - B',startsAt:'2026-10-27'}, {title:'Forum 2 - C',startsAt:'2026-10-28'}, {title:'Forum 1 - D',startsAt:null}];
 assert.deepEqual(sortForums(rows).map(x=>x.title), ['Forum 1 - D','Forum 2 - C','Forum 9 - B','FORUM 10 - A']);
 assert.equal(rows[0].title,'FORUM 10 - A');
});

test('Localized prefixes, missing numbers, and audience section ties remain predictable', () => {
 const rows = [{title:'Senza numero'}, {title:'Форум 12'}, {title:'Foro 3'}, {title:'Panel n. 2',id:'a'}, {title:'Panel n. 2',id:'b'}, {title:'1 - Pace'}, {title:'Forum 24'}];
 assert.deepEqual(sortForums(rows).map(x=>x.title),['1 - Pace','Panel n. 2','Panel n. 2','Foro 3','Форум 12','Forum 24','Senza numero']);
 assert.deepEqual(sortForums(rows).slice(1,3).map(x=>x.id),['a','b']);
});

test('Public school loader orders the complete RPC result without changing seat counts', async () => {
 const db = {rpc:async()=>({data:[10,2,1].map(n=>({event_id:'e',event_title:'E',panel_id:`p${n}`,section_id:`s${n}`,title:`Forum ${n}`,remaining_seats:n*3})),error:null})};
 const result = await getPublicSchoolBookingOptions(db as never);
 assert.deepEqual(result.panels.map(x=>[x.title,x.remainingSeats]),[['Forum 1',3],['Forum 2',6],['Forum 10',30]]);
});

test('Day grouping stays chronological with one group per day and numeric Forums inside it', () => {
 const rows = [
  {title:'Forum 10',startsAt:'2026-10-26T10:00:00+01:00'},
  {title:'Forum 1',startsAt:'2026-10-27T10:00:00+01:00'},
  {title:'Forum 2',startsAt:'2026-10-26T11:00:00+01:00'},
 ];
 const groups=groupPublicPanelsByDay(rows as never);
 assert.deepEqual(groups.map(x=>[x.key,x.panels.map(p=>p.title)]),[['2026-10-26',['Forum 2','Forum 10']],['2026-10-27',['Forum 1']]]);
});

 test('Youth Forums retain their number with an intervening category label', () => {
 assert.deepEqual(sortForums([{title:'FORUM 9 - Pace'},{title:'FORUM GIOVANI 8 - Un mondo da cambiare'},{title:'FORUM 7 - Preghiera'}]).map(x=>x.title), ['FORUM 7 - Preghiera','FORUM GIOVANI 8 - Un mondo da cambiare','FORUM 9 - Pace']);
 });

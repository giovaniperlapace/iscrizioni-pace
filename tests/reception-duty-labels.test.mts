import assert from 'node:assert/strict';
import test from 'node:test';
import { FORUM_RELAY_ROOMS } from '../lib/events/assisi-2026-relay-rooms.ts';
import { receptionDutyTitle } from '../lib/reception/duty-labels.ts';

test('six internal relay labels retain the Forum number and source title without changing canonical duties',()=>{
 const expected=FORUM_RELAY_ROOMS.map(room=>`Collegata F${room.number} · Nome del Forum ${room.number}`);
 const labels=FORUM_RELAY_ROOMS.map(room=>{
  const duty=Object.freeze({key:room.id,title:`SALA COLLEGATA — SOLO IN ITALIANO — FORUM ${room.number} — titolo pubblico completo`,kind:'panel' as const});
  const original={...duty};const label=receptionDutyTitle(duty,[{key:room.sourceId,kind:"panel",title:`${room.number} - Nome del Forum ${room.number}`}]);
  assert.deepEqual(duty,original);return label;
 });
 assert.deepEqual(labels,expected);assert.equal(new Set(labels).size,6);
});
test('source Forums, ceremonies, verification and unrelated long titles are not renamed',()=>{
 for(const kind of ['panel','ceremony','verification'] as const) {
  const key=kind==='panel'?FORUM_RELAY_ROOMS[0].sourceId:FORUM_RELAY_ROOMS[0].id;
  const title='SALA COLLEGATA — titolo che non identifica un collegamento canonico';
  assert.equal(receptionDutyTitle({key,title,kind}),title);
 }
 assert.equal(receptionDutyTitle({key:'other',title:'Forum con titolo lungo',kind:'panel'}),'Forum con titolo lungo');
});

test('missing source uses the embedded public title without venue; no fabricated name',()=>{
 const room=FORUM_RELAY_ROOMS[0];
 assert.equal(receptionDutyTitle({key:room.id,kind:'panel',title:'1 — SALA COLLEGATA — SOLO IN ITALIANO — Domus Letitiae — Pace — Dialogo'}),'Collegata F1 · Pace — Dialogo');
 assert.equal(receptionDutyTitle({key:room.id,kind:'panel',title:'Sconosciuto'}),'Collegata F1');
});

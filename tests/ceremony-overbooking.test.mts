import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOverbookingCommand, sectorCapacitySummary } from '../lib/ceremonies/overbooking.ts';
import { parseCeremonySectorStatistics } from '../lib/reception/ceremony-sector-statistics.ts';
import { projectReceptionResult } from '../lib/reception/check-in.server.ts';
import type { SeatsDesk } from '../lib/ceremonies/seats-desk.ts';
const id = '11111111-1111-4111-8111-111111111111';
test('overbooking commands accept explicit zero and reject invalid or unbounded quantities/revisions', () => {
  const c = { planId:id, sectorId:id, requestId:id, revision:1, extra:20 };
  assert.deepEqual(parseOverbookingCommand(c), c);
  for (const extra of [-1, .5, NaN, Infinity, '20', 10001]) assert.equal(parseOverbookingCommand({...c, extra}), null);
  assert.ok(parseOverbookingCommand({...c, extra:0}));
  assert.equal(parseOverbookingCommand({...c, revision:2147483647}), null);
  assert.equal(parseOverbookingCommand({...c, sectorId:'foreign'}), null);
});
test('physical capacity and protocol remain separate from ordinary and extra assignment counts', () => {
  const desk = { sectors:[{id, capacity:100, assignableLimit:90, baseAssignable:90, remaining:4, overbooking:10}],
    allocations:[{id:'allocation',sectorId:id,quantity:92}], nominees:[{allocationId:'allocation',needsSeat:true}],
    drafts:[{sectorId:id,quantity:4}] } as unknown as SeatsDesk;
  assert.deepEqual(sectorCapacitySummary(desk,id), { nominal:1, groupPending:91, draft:4, assigned:96, extra:10, base:90, physical:100, total:100, usedExtra:6, ordinaryRemaining:0, extraRemaining:4 });
  desk.drafts=[]; desk.allocations[0].quantity=80;
  assert.equal(sectorCapacitySummary(desk,id).usedExtra,0);
  assert.equal(sectorCapacitySummary(desk,id).extraRemaining,10);
  assert.equal(sectorCapacitySummary(desk,id).ordinaryRemaining,10);
});
test('reception projects fresh sector counts, rejects malformed/duplicate counts and preserves zero', () => {
  const sector = {sectorId:id,sector:'C',capacity:600,entered:601,overbooking:20};
  assert.deepEqual(parseCeremonySectorStatistics([sector]),[sector]);
  for (const input of [[{...sector,entered:-1}], [{...sector,capacity:null}], [sector,sector], {}]) assert.equal(parseCeremonySectorStatistics(input),null);
  const result = {status:'valid',kind:'family',code:'ABCD',revision:2,outcome:'saved',registrationStatus:'confirmed',persons:[{id,kind:'adult',firstName:'Test',lastName:'Person',checkedInAt:null}],sectorStatistics:[sector]};
  const projected = projectReceptionResult(result);
  assert.equal(projected.status,'valid');
  if (projected.status === 'valid') assert.deepEqual(projected.sectorStatistics,[sector]);
  assert.equal(projectReceptionResult({...result,sectorStatistics:[{...sector,entered:'601'}]}).status,'unavailable');
});

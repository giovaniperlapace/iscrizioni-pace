import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHistoryQuery, parseRevokeAssignment } from '../lib/ceremonies/assignment-history.ts';
const id='11111111-1111-4111-8111-111111111111';
test('history validates global filters and bounded pagination before RPC',()=>{
 const q={planId:id,page:2,search:"L'école",state:'revoked'};
 assert.deepEqual(parseHistoryQuery(q),q);
 for(const bad of [null,{}, {...q,planId:'foreign'}, {...q,page:0},{...q,page:1.5},{...q,page:1000001},{...q,search:'x'.repeat(201)},{...q,state:'anything'},{...q,search:null}]) assert.equal(parseHistoryQuery(bad),null);
});
test('revocation requires an explicit canonical target, revision and stable request',()=>{
 const c={planId:id,id,requestId:id,revision:0,kind:'nominee'};
 assert.deepEqual(parseRevokeAssignment(c),c);
 assert.ok(parseRevokeAssignment({...c,kind:'allocation'}));
 for(const bad of [null,{}, {...c,id:null},{...c,planId:'x'},{...c,requestId:null},{...c,revision:-1},{...c,revision:'0'},{...c,kind:'all'}]) assert.equal(parseRevokeAssignment(bad),null);
});

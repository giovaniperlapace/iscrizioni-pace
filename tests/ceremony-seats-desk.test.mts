import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeskCommand } from '../lib/ceremonies/seats-desk.ts';
const id = (n:number) => `11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const command = { planId:id(1),requestId:id(2),revision:1,data:{action:'assign',sectorId:id(3),seatIds:[id(4),id(5)],quantity:2,groupId:null,subjects:[{registrationId:id(6),childId:null},{registrationId:id(6),childId:id(7)}]} };
test('family command validates exact cardinality, distinct subjects, UUIDs and explicit children', () => {
 assert.ok(parseDeskCommand(command));
 for(const d of [{quantity:1},{seatIds:[id(4),id(4)]},{subjects:[command.data.subjects[0],command.data.subjects[0]]},{subjects:[{registrationId:id(6)}]},{action:'configure'},{quantity:10001},{groupId:id(8)}]) assert.equal(parseDeskCommand({...command,data:{...command.data,...d}}),null);
 assert.ok(parseDeskCommand({...command,data:{...command.data,seatIds:[]}}));
 assert.ok(parseDeskCommand({...command,data:{...command.data,action:'group',groupId:id(8),subjects:[]}}));
});

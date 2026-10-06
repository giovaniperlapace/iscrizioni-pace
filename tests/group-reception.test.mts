import test from "node:test";
import assert from "node:assert/strict";
import {parseReceptionCommand,type ReceptionCommand,type ReceptionResult} from "../lib/reception/contracts.ts";
import {projectReceptionResult} from "../lib/reception/check-in.server.ts";
import {ReceptionStationSession} from "../lib/reception/station.ts";
import {parseBadgeCommand} from "../lib/reception/group-badges.ts";
const id="11111111-1111-4111-8111-111111111111", child="22222222-2222-4222-8222-222222222222";
const token=`G:${"a".repeat(43)}`,snapshot="b".repeat(64);
const group:Extract<ReceptionResult,{kind:"group"}>={status:"valid",kind:"group",groupId:id,groupName:"Synthetic",snapshot,revision:0,outcome:"verified",registrationStatus:"confirmed",persons:[{id,registrationId:id,code:"TST1",kind:"adult",firstName:"Adult",lastName:"Test",checkedInAt:null},{id:child,registrationId:id,code:"TST1",kind:"child",firstName:"Child",lastName:"Test",checkedInAt:null}]};
test("group QR is accepted only for event entry and writes require a snapshot",()=>{
 const inspect={duty:"event_entry",lookup:{kind:"qr",value:token},action:"inspect"};
 assert.deepEqual(parseReceptionCommand(inspect),inspect);
 assert.equal(parseReceptionCommand({...inspect,duty:"panel_entry",panelId:id}),null);
 assert.equal(parseReceptionCommand({...inspect,action:"enter",requestId:id,subjectIds:[id]}),null);
 assert.ok(parseReceptionCommand({...inspect,action:"enter",requestId:id,subjectIds:[id],groupSnapshot:snapshot}));
 assert.equal(parseReceptionCommand({...inspect,lookup:{kind:"qr",value:"a".repeat(43)},groupSnapshot:snapshot}),null);
});
test("group projection includes no contact, token, revision or private child fields",()=>{
 assert.deepEqual(projectReceptionResult({...group,email:"secret",persons:group.persons.map(p=>({...p,revision:9,birthDate:"secret",token:"secret"}))}),group);
 assert.deepEqual(projectReceptionResult({...group,persons:[{...group.persons[0],registrationId:null}]}),{status:"unavailable"});
});
test("group inspection never enters automatically, subset carries snapshot and uncertain retry stays identical",async()=>{
 const calls:ReceptionCommand[]=[];let fail=true;
 const session=new ReceptionStationSession(async c=>{calls.push(c);return c.action==="inspect"?group:fail?{status:"unavailable"}: {...group,outcome:"replayed"};},()=>id);
 await session.inspect({kind:"qr",value:token});assert.equal(calls.length,1);assert.equal(session.snapshot().phase,"selection");
 await session.submit({subjectIds:[child]});assert.equal(session.snapshot().phase,"uncertain");const write=calls[1];
 assert.equal(write.groupSnapshot,snapshot);assert.deepEqual(write.subjectIds,[child]);
 fail=false;await session.retry();assert.deepEqual(calls[2],write);assert.equal(session.snapshot().phase,"result");
});
test("group correction requires confirmation; clearing all cancels only current arrivals",async()=>{
 const present={...group,persons:group.persons.map(p=>({...p,checkedInAt:"2026-10-06T10:00:00Z"}))};const calls:ReceptionCommand[]=[];
 const session=new ReceptionStationSession(async c=>{calls.push(c);return present;},()=>id);
 await session.inspect({kind:"qr",value:token});await session.editCurrent();
 await session.submit({subjectIds:[]});assert.equal(calls.length,2);
 await session.submit({subjectIds:[]},true);assert.equal(calls[2].action,"cancel");assert.equal(calls[2].groupSnapshot,snapshot);assert.deepEqual(calls[2].subjectIds,[id,child]);
});
test("batch contract rejects forged identities, duplicates and stale-operation commands without version",()=>{
 const create={token,action:"create",batchId:id,registrationIds:[id],snapshot};assert.deepEqual(parseBadgeCommand(create),create);
 for(const c of [{...create,actor:id},{...create,registrationIds:[id,id]},{token,action:"reprint",batchId:id,registrationId:id},{token,action:"read",snapshot}])assert.equal(parseBadgeCommand(c),null);
 assert.ok(parseBadgeCommand({token,action:"reprint",batchId:id,registrationId:id,expectedAttempts:1}));
});

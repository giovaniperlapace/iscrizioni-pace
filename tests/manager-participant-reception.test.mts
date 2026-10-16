import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { executeReceptionCommand } from '../lib/reception/check-in.server.ts';
import { executeLabelCommand } from '../lib/reception/qr-labels.server.ts';
import { canOperateReception, canOperateParticipantReception } from '../lib/reception/access.ts';
const id='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
type Role={role:string;event_id:string|null};
function setup(roles:Role[],failure='') {
 const calls:{name:string;args:Record<string,unknown>}[]=[];
 const session={auth:{getUser:async()=>({data:{user:failure==='anonymous'?null:{id}},error:null})},from(table:string){
  const result=()=>({data:table==='events'?{id:'event'}:roles,error:failure===table?{}:null});
  return {select(){return this;},eq(){return this;},maybeSingle:async()=>result(),then(resolve:(value:unknown)=>unknown){return Promise.resolve(result()).then(resolve);}};
 }} as unknown as SupabaseClient;
 const service=()=>({rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});return {data:{status:'invalid'},error:null};}} as unknown as SupabaseClient);
 return {session,service,calls};
}
const input={duty:'event_entry',action:'inspect',lookup:{kind:'code',value:'TEST'}};
test('participant operations allow only current-event Manager, Reception or global Admin',async()=>{
 for(const [roles,allowed] of [
  [[{role:'manager',event_id:'event'}],true],[[{role:'accoglienza',event_id:'event'}],true],[[{role:'admin',event_id:null}],true],
  [[{role:'manager_viewer',event_id:'event'}],false],[[{role:'manager',event_id:'old'}],false],[[{role:'manager',event_id:null}],false],
  [[{role:'admin',event_id:'event'}],false],[[{role:'capogruppo',event_id:'event'}],false],[[],false],
 ] as [Role[],boolean][]){
  const {session,service,calls}=setup(roles);
  assert.equal(canOperateParticipantReception(roles,'event'),allowed);
  const presence=await executeReceptionCommand(session,service,input,'event',id);
  const label=await executeLabelCommand(session,service,{registrationId:id,action:'read'},id);
  assert.equal(presence.status==='forbidden',!allowed);assert.equal(label.status==='forbidden',!allowed);
  assert.equal(calls.length,allowed?2:0);
  if(allowed){assert.equal(calls[0].name,'participant_reception_check_in');assert.equal(calls[0].args.p_registration_id,id);assert.equal(calls[0].args.p_code,'TEST');assert.equal(calls[1].name,'participant_qr_label_queue');assert.equal('p_group' in calls[1].args,false);}
 }
});
test('participant scope never opens scanner, school, Forum or group operations to a Manager',async()=>{
 const {session,service,calls}=setup([{role:'manager',event_id:'event'}]);
 assert.equal(canOperateReception([{role:'manager',event_id:'event'}],'event'),false);
 assert.equal((await executeReceptionCommand(session,service,input,'event')).status,'forbidden');
 assert.equal((await executeLabelCommand(session,service,{registrationId:id,action:'read'})).status,'forbidden');
 for(const command of [{...input,lookup:{kind:'qr',value:'a'.repeat(43)}},{...input,lookup:{kind:'qr',value:'G:'+'a'.repeat(43)}},{...input,duty:'panel_entry',panelId:id},{...input,action:'enter',requestId:other,students:1,companions:1}]){
  assert.equal((await executeReceptionCommand(session,service,command,'event',id)).status,'invalid_request');
 }
 assert.equal((await executeReceptionCommand(session,service,input,'old',id)).status,'forbidden');
 assert.equal((await executeLabelCommand(session,service,{groupId:id,action:'read'},id)).status,'invalid');
 assert.equal((await executeLabelCommand(session,service,{registrationId:other,action:'read'},id)).status,'invalid');
 assert.equal(calls.length,0);
});
test('Manager revocation and auth/read failures block participant operations before service access',async()=>{
 const roles:Role[]=[{role:'manager',event_id:'event'}];const {session,service,calls}=setup(roles);
 await executeReceptionCommand(session,service,input,'event',id);roles.length=0;
 assert.equal((await executeReceptionCommand(session,service,input,'event',id)).status,'forbidden');
 assert.equal((await executeLabelCommand(session,service,{registrationId:id,action:'read'},id)).status,'forbidden');assert.equal(calls.length,1);
 for(const failure of ['anonymous','events','event_user_roles']){
  const f=setup([{role:'manager',event_id:'event'}],failure);
  await executeReceptionCommand(f.session,f.service,input,'event',id);await executeLabelCommand(f.session,f.service,{registrationId:id,action:'read'},id);assert.equal(f.calls.length,0);
 }
});

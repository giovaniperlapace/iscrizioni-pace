import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ceremonySeatRanges } from '../lib/ceremonies/group-seat-summary.ts';
import { readGroupCeremonySummary } from '../lib/ceremonies/group-seat-summary.server.ts';
import { executeReceptionCommand } from '../lib/reception/check-in.server.ts';
test('group ranges keep gaps, blocks, rows and B2 numbering separate',()=>{
 assert.deepEqual(ceremonySeatRanges('B2',[
  ...[10,1,2,3,8,9].map(n=>({row:'B-b2-r06',number:String(n)})),
  {row:'B-b2-r07',number:'1'},{row:'B-b3-r06',number:'1'},{row:'B-b2-r06',number:'1'}]),[
   'Settore B2 · Blocco 2 · Fila 6 · Sedie 1–3, 8–10',
   'Settore B2 · Blocco 2 · Fila 7 · Sedia 1',
   'Settore B2 · Blocco 3 · Fila 6 · Sedia 1']);
});
function fixture(fail='',changed=false){
 const count=1205;
 const tables:Record<string,Record<string,unknown>[]>= {
  ceremony_plans:[{id:'p',kind:'opening',revision:4,event_id:'e',state:'validated'},{id:'foreign',kind:'closing',event_id:'elsewhere',state:'validated'}],
  ceremony_allocations:[{id:'a',plan_id:'p',quota_id:'q',quantity:count,group_id:'g',revoked_at:null},{id:'b',plan_id:'p',quota_id:'f',quantity:4,group_id:'g',revoked_at:null},{id:'other',plan_id:'p',quota_id:'q',quantity:1,group_id:'other',revoked_at:null},{id:'revoked',plan_id:'p',quota_id:'q',quantity:1,group_id:'g',revoked_at:'old'}],
  ceremony_quotas:[{id:'q',plan_id:'p',sector_id:'s'},{id:'f',plan_id:'p',sector_id:'f'}],
  ceremony_sectors:[{id:'s',plan_id:'p',name:'B1'},{id:'f',plan_id:'p',name:'F'}],
  ceremony_map_versions:[{plan_id:'p',state:'published',seats:Array.from({length:count},(_,i)=>({id:`s${i}`,sectorId:'s',row:`B-b2-r${1+Math.floor(i/10)}`,number:String(1+i%10)}))}],
  ceremony_seat_claims:[...Array.from({length:count},(_,i)=>({id:String(i).padStart(4,'0'),plan_id:'p',allocation_id:'a',seat_id:`s${i}`,released_at:null})),{id:'released',plan_id:'p',allocation_id:'a',seat_id:'absent',released_at:'old'}],
 };
 const calls:{table:string;filters:[string,unknown][];offset:number}[]=[];
 const db={from(table:string){let single=false,cols=''; const c={table,filters:[] as [string,unknown][],offset:0};calls.push(c);let limit=1000;const predicates:((r:Record<string,unknown>)=>boolean)[]=[];
 const q={select(s:string){cols=s;return q;},eq(k:string,v:unknown){c.filters.push([k,v]);predicates.push(r=>r[k]===v);return q;},is(k:string,v:unknown){return q.eq(k,v);},in(k:string,v:unknown[]){c.filters.push([k,v]);predicates.push(r=>v.includes(r[k]));return q;},order(){return q;},range(a:number,b:number){c.offset=a;limit=b-a+1;return q;},maybeSingle(){single=true;return q;},then(resolve:(r:unknown)=>unknown){let data=tables[table].filter(r=>predicates.every(p=>p(r))).slice(c.offset,c.offset+limit);if(changed&&cols==='revision,state')data=data.map(r=>({...r,revision:5}));return Promise.resolve({data:single?data[0]??null:data,error:table===fail?{}:null}).then(resolve);}};return q;}} as unknown as SupabaseClient;
 return {db,calls};
}
test('group summary includes all 1205 reserved chairs and F quantity, scoped and paginated',async()=>{
 const {db,calls}=fixture();const r=await readGroupCeremonySummary(db,'e','g');assert.equal(r.status,'ready');if(r.status!=='ready')return;
 assert.equal(r.items[0].quantity,1205);assert.equal(r.items[0].ranges.length,121);assert.equal(r.items[0].unnumbered,0);
 assert.deepEqual(r.items[1],{kind:'opening',sector:'F',quantity:4,ranges:[],unnumbered:4});
 assert.deepEqual(calls.filter(c=>c.table==='ceremony_seat_claims').map(c=>c.offset),[0,500,1000]);
 assert.ok(calls.filter(c=>c.table==='ceremony_allocations').every(c=>c.filters.some(([k,v])=>k==='group_id'&&v==='g')));
});
test('failed or concurrently changed summaries never invent empty reservations',async()=>{
 for(const fail of ['ceremony_plans','ceremony_allocations','ceremony_quotas','ceremony_sectors','ceremony_map_versions','ceremony_seat_claims'])assert.deepEqual(await readGroupCeremonySummary(fixture(fail).db,'e','g'),{status:'unavailable'});
 assert.deepEqual(await readGroupCeremonySummary(fixture('',true).db,'e','g'),{status:'unavailable'});
});
test('group summaries load only after QR authorization; failure preserves saved presence',async()=>{
 const session={auth:{getUser:async()=>({data:{user:{id:'operator'}},error:null})},from(){const q={select(){return q;},eq(){return q;},maybeSingle(){return Promise.resolve({data:{id:'e'},error:null});},then(resolve:(x:unknown)=>unknown){return Promise.resolve({data:[{role:'accoglienza',event_id:'e'}],error:null}).then(resolve);}};return q;}} as unknown as SupabaseClient;
 let reads=0,valid=false;
 const service=()=>({rpc:async(name:string)=>{assert.equal(name,'reception_group_check_in');return {error:null,data:valid?{status:'valid',kind:'group',groupId:'g',groupName:'Group',snapshot:'a'.repeat(64),revision:1,outcome:'saved',registrationStatus:'confirmed',persons:[]}: {status:'invalid'}};},from(){reads++;throw Error('unavailable');}}) as unknown as SupabaseClient;
 const command={duty:'event_entry',action:'inspect',lookup:{kind:'qr',value:'G:'+'a'.repeat(43)}};
 assert.deepEqual(await executeReceptionCommand(session,service,command),{status:'invalid'});assert.equal(reads,0);
 valid=true;const result=await executeReceptionCommand(session,service,command);assert.equal(result.status,'valid');if(result.status==='valid'&&result.kind==='group'){assert.equal(result.outcome,'saved');assert.deepEqual(result.groupCeremonies,{status:'unavailable'});}assert.equal(reads,1);
});

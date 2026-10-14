import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseReportFilter, projectReceptionReport, countPeople } from '../lib/reception/report.ts';
import { loadReceptionReport } from '../lib/reception/report.server.ts';
const eventId='11111111-1111-4111-8111-111111111111';
const counts={ adults:1,children:2,students:10,companions:2,schoolBookings:1 };
const report={ eventId,updatedAt:'2026-09-30T10:00:00Z',day:null,part:'all',expected:counts,arrivals:counts,operations:{ duplicateRequests:1,retries:2,corrections:3,cancellations:4 },hours:[{hour:'2026-09-30 12:00',people:15}] };
test('report filters reject invalid dates, scope and parts',()=>{
  assert.deepEqual(parseReportFilter(new URLSearchParams({eventId})),{eventId,day:null,part:'all'});
  for(const fields of [{eventId:'bad'},{eventId,day:'2026-02-30'},{eventId,part:'morning'},{eventId,day:'2026-09-30',part:'night'}]) assert.equal(parseReportFilter(new URLSearchParams(fields as Record<string,string>)),null);
});
test('report projects aggregate fields only and fails on partial or malformed counts',()=>{
  assert.deepEqual(projectReceptionReport({...report,rawAudit:[{actor:'private'}]}),report);
  assert.equal(countPeople(counts),15);
  for(const extra of [{expected:{}},{arrivals:{...counts,students:-1}},{operations:{}},{hours:[{hour:'bad',people:1}]},{updatedAt:'bad'}]) assert.equal(projectReceptionReport({...report,...extra}),null);
});
test('report uses authenticated RPC, maps failures and rejects mismatched responses',async()=>{
  let calls=0;
  const db=(data:unknown=report,error:unknown=null,user:unknown={id:'actor'})=>({ auth:{getUser:async()=>({data:{user},error:null})},rpc:async(name:string,args:unknown)=>{calls++;assert.equal(name,'reception_operational_report');assert.deepEqual(args,{p_event_id:eventId,p_day:null,p_part:'all'});return {data,error};} }) as unknown as SupabaseClient;
  const params=new URLSearchParams({eventId});
  assert.deepEqual(await loadReceptionReport(db(),params),report);
  calls=0;
  await assert.rejects(loadReceptionReport(db(report,null,null),params),{status:401}); assert.equal(calls,0);
  for(const [code,status] of [['42501',403],['22023',400],['PGRST202',503]] as const) await assert.rejects(loadReceptionReport(db(null,{code}),params),{status});
  await assert.rejects(loadReceptionReport(db({...report,eventId:'other'}),params),{status:503});
});

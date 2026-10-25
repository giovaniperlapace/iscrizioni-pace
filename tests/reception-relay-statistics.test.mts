import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseRelayRoomStatistics } from '../lib/reception/relay-room-statistics.ts';
import { loadRelayRoomStatistics } from '../lib/reception/relay-room-statistics.server.ts';
const room={panelId:'relay',title:'Sala collegata',room:'Domus',capacity:156,entered:42,booked:80};
test('relay availability preserves zero, full, over capacity and unknown without invented seats',()=>{
 for(const capacity of [0,156,null]) for(const entered of [0,42,156,160])
  assert.deepEqual(parseRelayRoomStatistics([{...room,capacity,entered}]),[{...room,capacity,entered}]);
 assert.deepEqual(parseRelayRoomStatistics([{...room,booked:0}]),[{...room,booked:0}]);
 assert.deepEqual(parseRelayRoomStatistics([{...room,booked:undefined}]),[{...room,booked:null}]);
 assert.deepEqual(parseRelayRoomStatistics([]),[]);
 assert.deepEqual(parseRelayRoomStatistics([{...room,privateData:'discard'}]),[room]);
});
test('malformed or duplicate relay counters are unavailable, never an empty or zero count',()=>{
 for(const input of [undefined,null,{},[null],[room,room],[{...room,booked:-1}],[{...room,booked:1.5}],[{...room,booked:"80"}],[{...room,capacity:-1}],[{...room,entered:1.5}],[{...room,entered:'42'}],[{...room,capacity:Infinity}],[{...room,entered:NaN}],[{...room,room:undefined}]])
  assert.equal(parseRelayRoomStatistics(input),null);
});
test('relay loader uses authorized event/actor/source and isolates secondary read errors',async()=>{
 const db={rpc:async(name:string,args:object)=>{
  if(name==='reception_relay_room_statistics') {
   assert.deepEqual(args,{p_event:'event',p_actor:'actor',p_panel:'source'});
   return {data:[{...room,booked:undefined}],error:null};
  }
  assert.equal(name,'reception_target_statistics');assert.deepEqual(args,{p_event:'event',p_actor:'actor',p_target:'relay'});
  return {data:{booked:80,entered:42},error:null};
 }} as unknown as SupabaseClient;
 assert.deepEqual(await loadRelayRoomStatistics(db,'event','actor','source'),[room]);
 for(const rpc of [async()=>({data:[room],error:{code:'42501'}}),async()=>({data:'invalid',error:null}),async()=>{throw Error('offline');}])
  assert.equal(await loadRelayRoomStatistics({rpc} as unknown as SupabaseClient,'e','a','p'),null);
});

test('reservation read failure preserves known capacity/entries without inventing zero; valid reads refresh both counters',async()=>{
 for(const stats of [{booked:0,entered:0},{booked:5,entered:7},null,{booked:-1,entered:42},{booked:'80',entered:42},{booked:80,entered:null}]) {
  const db={rpc:async(name:string)=>name==='reception_relay_room_statistics'?{data:[room],error:null}:{data:stats,error:null}} as unknown as SupabaseClient;
  const result=await loadRelayRoomStatistics(db,'e','a','p');
  const valid=stats && typeof stats.booked==='number' && stats.booked>=0 && typeof stats.entered==='number';
  assert.deepEqual(result,[valid?{...room,booked:stats.booked,entered:stats.entered}:{...room,booked:null}]);
 }
 for(const fail of [async()=>({data:null,error:{code:'42501'}}),async()=>{throw Error('offline');}]){
  const db={rpc:async(name:string)=>name==='reception_relay_room_statistics'?{data:[room],error:null}:fail()} as unknown as SupabaseClient;
  assert.deepEqual(await loadRelayRoomStatistics(db,'e','a','p'),[{...room,booked:null}]);
 }
});

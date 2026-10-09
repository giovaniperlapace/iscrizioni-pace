import assert from "node:assert/strict";
import test from "node:test";
import { getPanelDraftCatalog } from "../lib/panels/panel-drafts.ts";

function fixture(failOccupancy = false) {
  const count = 1205;
  const tables: Record<string, Array<Record<string, unknown>>> = {
    event_moments: Array.from({length: count}, (_, i) => ({id:`panel-${i}`,event_id:"event",title:`Panel ${i}`,publication_status:"published",location_id:"room"})),
    panel_seat_sections: Array.from({length: count}, (_, i) => ({id:`section-${i}`,panel_id:`panel-${i}`,audience_type_id:"audience",capacity:10})),
    panel_audience_types: [{id:"audience",name:"Iscritti",code:"individual",booking_channel:"individual",is_active:true}],
    event_locations: [{id:"room",name:"Room",max_capacity:10}],
    moment_attendance_choices: Array.from({length:count}, (_, i) => ({moment_id:`panel-${i}`,registration_id:`person-${i}`})),
    availability: Array.from({length:count}, (_, i) => ({section_id:`section-${i}`,occupied:i===1204?10:3})),
  };
  const calls: Array<{table:string;from:number;size:number}> = [];
  function query(table:string) {
    let from=0,to=999; let filter:{key:string;values:string[]}|null=null;
    const q = {
      select(){return q;}, eq(){return q;}, neq(){return q;}, order(){return q;},
      in(key:string,values:string[]){assert.ok(values.length<=100);filter={key,values};return q;},
      range(a:number,b:number){from=a;to=b;return q;},
      then(resolve:(value:unknown)=>unknown){
        calls.push({table,from,size:to-from+1});
        if(table==='availability'&&failOccupancy&&from>=1000) return Promise.resolve({data:null,error:{message:'availability last page failed'}}).then(resolve);
        const rows=filter?tables[table].filter(row=>filter!.values.includes(String(row[filter!.key]))):tables[table];
        return Promise.resolve({data:rows.slice(from,to+1),error:null}).then(resolve);
      },
    };return q;
  }
  return {calls,db:{from:query,rpc:()=>query('availability')}};
}
test("catalog retains every panel and canonical remaining seats after row 1000",async()=>{
 const {db,calls}=fixture(); const catalog=await getPanelDraftCatalog(db as never,'event');
 assert.equal(catalog.panels.length,1205);
 assert.equal(catalog.panels.at(-1)?.sections[0].occupied,10);
 assert.equal(catalog.panels.at(-1)?.confirmedRegistrationCount,1);
 assert.ok(calls.some(c=>c.table==='availability'&&c.from===1000));
});
test("failed final availability page rejects the entire catalog instead of showing false vacancies",async()=>{
 const {db}=fixture(true);await assert.rejects(getPanelDraftCatalog(db as never,'event'),/availability last page failed/);
});

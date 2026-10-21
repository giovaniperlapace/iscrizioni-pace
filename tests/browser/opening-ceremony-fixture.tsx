"use client";
import { useState } from "react";
import { CeremonyWorkspace } from "@/app/dashboard/manager/cerimonie/workspace";
import { CeremonyMapWorkspace } from "@/app/dashboard/ceremony-map-workspace";
import type { CeremonySnapshot } from "@/lib/ceremonies/contracts";
import type { SeatMapView } from "@/lib/ceremonies/seat-map";
export default function OpeningFixture({snapshot,map}:{snapshot:CeremonySnapshot;map:SeatMapView}) {
 const [role,setRole]=useState("manager"),[tab,setTab]=useState("map"),[result,setResult]=useState("saved"),[payload,setPayload]=useState("");
 const sector=map.sectors.find(s=>s.layoutCode==='A')!,f=map.sectors.find(s=>s.layoutCode==='F')!;
 const p=snapshot.people.find(p=>p.children.length===2)!;
 const group={id:"11111111-1111-4111-8111-111111111111",planId:map.planId,kind:"opening" as const,revision:map.revision,state:"validated" as const,groupId:"11111111-1111-4111-8111-111111111112",groupName:"Gruppo prova",location:"Sala sintetica",startsAt:"2026-10-25T15:30:00Z",sector:sector.name,sectorId:sector.id,category:"Partecipanti",quantity:3,used:0};
 const view={...map,allocations:[group,{...group,id:"11111111-1111-4111-8111-111111111113",sector:f.name,sectorId:f.id}]};
 return <main className="mx-auto grid max-w-6xl min-w-0 gap-4 p-4">
 <h1>Collaudo sintetico inaugurazione</h1>
 <label>Ruolo test<select className="field" value={role} onChange={e=>setRole(e.target.value)}><option value="manager">Manager</option><option value="admin">Admin</option><option value="viewer">Viewer</option></select></label>
 <label>Vista test<select className="field" value={tab} onChange={e=>setTab(e.target.value)}><option value="map">Piantina</option><option value="preparation">Assegnazioni</option></select></label>
 <label>Esito test<select className="field" value={result} onChange={e=>setResult(e.target.value)}><option>saved</option><option>conflict</option><option>capacity</option></select></label>
 <output className="sr-only" data-testid="payload">{payload}</output>
 {tab==='map'?<CeremonyMapWorkspace key={role} embedded initialView={view} locale="it" admin={role==='admin'} manager canManage={role!=='viewer'} save={async c=>{setPayload(JSON.stringify(c));return {status:result};}} refresh={async()=>view}/>:<CeremonyWorkspace key={role} kind="opening" snapshot={{...snapshot,people:[{...p,eligibility:'eligible'}]}} admin={role==='admin'} canManage={role!=='viewer'} save={async f=>{setPayload(JSON.stringify(Object.fromEntries(f)));return {status:result};}}/>}
 </main>;
}

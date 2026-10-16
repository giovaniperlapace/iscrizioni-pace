"use client";
import { useCallback, useRef, useState } from "react";
import { ReceptionConsole } from "@/app/dashboard/accoglienza/reception-console";
import type { ReceptionCommand, ReceptionResult } from "@/lib/reception/contracts";
import type { LabelCommand, LabelQueue, LabelResult } from "@/lib/reception/qr-labels";
const ids=[1,2,3].map(n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`);
const names=["Ada Mori","Bruno Rossi","Carlo Mori"];
type Verified=Extract<ReceptionResult,{status:"valid"}>;
export default function Fixture({documents}:{documents:Record<string,string>}) {
 const [scenario,setScenario]=useState('normal');const scenarioRef=useRef('normal');
 const records=useRef(new Map<string,Verified>());
 const [calls,setCalls]=useState<ReceptionCommand[]>([]),[writes,setWrites]=useState<ReceptionCommand[]>([]),[printed,setPrinted]=useState<LabelCommand[]>([]);
 const lost=useRef(false),seen=useRef(new Set<string>());
 const commandAction=useCallback(async(c:ReceptionCommand):Promise<ReceptionResult>=>{
  setCalls(old=>[...old,c]);
  await new Promise(r=>setTimeout(r,scenarioRef.current==='slow'?700:50));
  if(scenarioRef.current==='forbidden')return {status:'forbidden'};
  if(c.lookup.value==='x'.repeat(43))return {status:'invalid'};
  if(scenarioRef.current==='inspect-uncertain'&&!lost.current){lost.current=true;return {status:'unavailable'};}
  const kind=c.lookup.value.startsWith('G:')?'group':c.lookup.value.startsWith('s')?'school':'family';
  const key=kind==='family'?(c.lookup.value.startsWith('f')?'family':'single'):kind;
  if(!records.current.has(key)){
   const persons=ids.slice(0,key==='single'?1:key==='family'?2:3).map((id,i)=>({id,kind:i===1&&key==='family'?'child' as const:'adult' as const,firstName:names[i].split(' ')[0],lastName:names[i].split(' ')[1],checkedInAt:null,registrationId:id,code:`T00${i+1}`}));
   const base={status:'valid' as const,revision:0,outcome:'verified' as const,registrationStatus:'confirmed' as const};
   records.current.set(key,kind==='group'?{...base,kind,groupId:ids[0],groupName:'Gruppo sintetico',snapshot:'a'.repeat(64),persons}:kind==='school'?{...base,kind,schoolName:'Scuola sintetica',classDescription:'1A',expectedStudents:20,expectedCompanions:2,students:0,companions:0,checkedInAt:null}:{...base,kind,code:'T001',persons});
  }
  const result=records.current.get(key)!;
  if(c.action==='inspect')return structuredClone({...result,outcome:'verified'});
  setWrites(old=>[...old,c]);
  if(scenarioRef.current==='conflict')return {status:'conflict'};
  if(!seen.current.has(c.requestId!)){
   seen.current.add(c.requestId!);const now='2026-10-15T10:00:00Z';
   if(result.kind==='family'||result.kind==='group')result.persons=result.persons.map(p=>({...p,checkedInAt:c.action==='correct'?(c.subjectIds?.includes(p.id)?p.checkedInAt??now:null):c.subjectIds?.includes(p.id)?c.action==='cancel'?null:p.checkedInAt??now:p.checkedInAt}));
   if(result.kind==='school'){result.students=c.students??0;result.companions=c.companions??0;result.checkedInAt=c.action==='cancel'?null:now;}
   result.revision++;result.outcome='saved';
  }else result.outcome='replayed';
  if(scenarioRef.current==='write-uncertain'&&!lost.current){lost.current=true;return {status:'unavailable'};}
  return structuredClone(result);
 },[]);
 const labelAction=useCallback(async(c:LabelCommand):Promise<LabelResult>=>{
  setPrinted(old=>[...old,c]);await new Promise(r=>setTimeout(r,100));
  if(scenarioRef.current==='print-error')return {status:'unavailable'};
  const queue:LabelQueue={status:'queue',snapshot:'b'.repeat(64),items:ids.slice(0,c.groupId?3:1).map((id,i)=>({registrationId:id,name:names[i],code:`T00${i+1}`,reason:null,state:'pending',attempts:0,outcome:null,changed:false}))};
  if(c.action!=='request')return queue;
  return {status:'document',requestId:c.requestId!,html:documents[c.ids!.join(',')]};
 },[documents]);
 return <main className="mx-auto max-w-5xl p-4"><h1>Collaudo USB sintetico</h1>
  <label>Scenario sintetico<select value={scenario} onChange={e=>{setScenario(e.target.value);scenarioRef.current=e.target.value;lost.current=false;}}>{['normal','slow','forbidden','conflict','inspect-uncertain','write-uncertain','print-error'].map(s=><option key={s}>{s}</option>)}</select></label>
  <ReceptionConsole eventReception labelPrinting commandAction={commandAction} labelCommandAction={labelAction}/>
  <output data-calls hidden>{JSON.stringify(calls)}</output><output data-writes hidden>{JSON.stringify(writes)}</output><output data-prints hidden>{JSON.stringify(printed)}</output>
 </main>;
}

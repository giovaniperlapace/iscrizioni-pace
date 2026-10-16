"use client";
import { useCallback, useRef, useState } from "react";
import { ReceptionWorkstation } from "@/app/dashboard/accoglienza/reception-workstation";
import type { CameraSource } from "@/lib/reception/camera";
import { ReceptionConsole } from "@/app/dashboard/accoglienza/reception-console";
import type { ReceptionCommand, ReceptionResult } from "@/lib/reception/contracts";
import type { LabelCommand, LabelQueue, LabelResult } from "@/lib/reception/qr-labels";
const ids=[1,2,3].map(n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`);
const names=["Ada Mori","Bruno Rossi","Carlo Mori"];
type Verified=Extract<ReceptionResult,{status:"valid"}>;
export default function Fixture({documents, workstation = false}:{documents:Record<string,string>; workstation?: boolean}) {
 const [scenario,setScenario]=useState('normal');const scenarioRef=useRef('normal');
 const cameraCode=useRef<string|null>(null);
 const [cameraStats,setCameraStats]=useState({started:0,stopped:0});
 const [source]=useState<CameraSource>(()=>async({signal,onCode,onNoCode}: Parameters<CameraSource>[0])=>{
  if(scenarioRef.current==='camera-denied')throw new DOMException('Synthetic denial','NotAllowedError');
  setCameraStats(s=>({...s,started:s.started+1}));
  const timer=setInterval(()=>{if(cameraCode.current)onCode(cameraCode.current);else onNoCode?.();},100);
  let stopped=false;
  const stop=()=>{if(stopped)return;stopped=true;clearInterval(timer);setCameraStats(s=>({...s,stopped:s.stopped+1}));};
  signal.addEventListener('abort',stop,{once:true});return stop;
 });
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
   if(kind==='group'&&scenarioRef.current==='group-minor'){persons[2].kind='child';persons[2].registrationId=ids[1];persons[2].code='T002';}
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
  setPrinted(old=>[...old,c]);await new Promise(r=>setTimeout(r,scenarioRef.current==='slow'?700:100));
  if(scenarioRef.current==='print-error'||scenarioRef.current==='print-request-error'&&c.action==='request')return {status:'unavailable'};
  const queue:LabelQueue={status:'queue',snapshot:'b'.repeat(64),items:ids.slice(0,c.groupId?3:1).map((id,i)=>({registrationId:id,name:names[i],code:`T00${i+1}`,reason:null,state:'pending',attempts:0,outcome:null,changed:false}))};
  if(c.action!=='request')return queue;
  return {status:'document',requestId:c.requestId!,html:documents[c.ids!.join(',')]};
 },[documents]);
 return <main className="mx-auto max-w-5xl p-4"><h1>Collaudo USB sintetico</h1>
  <label>Scenario sintetico<select value={scenario} onChange={e=>{setScenario(e.target.value);scenarioRef.current=e.target.value;lost.current=false;}}>{['normal','slow','forbidden','conflict','inspect-uncertain','write-uncertain','print-error','print-request-error','group-minor','camera-denied'].map(s=><option key={s}>{s}</option>)}</select></label>
  {workstation ? <>
   <div aria-label="Fotogramma sintetico" className="flex gap-3">
    <button onClick={()=>{cameraCode.current='a'.repeat(43);}}>QR singolo</button>
    <button onClick={()=>{cameraCode.current='G:'+'g'.repeat(43);}}>QR gruppo</button>
    <button onClick={()=>{cameraCode.current=null;}}>Nessun QR</button>
   </div>
   <ReceptionWorkstation duties={[{key:'event_entry',duty:'event_entry',title:'Accoglienza evento',room:null}]} commandAction={commandAction} labelCommandAction={labelAction} cameraSource={source}/>
  </> : <ReceptionConsole eventReception labelPrinting commandAction={commandAction} labelCommandAction={labelAction}/>}
  <output data-camera hidden>{JSON.stringify(cameraStats)}</output>
  <output data-calls hidden>{JSON.stringify(calls)}</output><output data-writes hidden>{JSON.stringify(writes)}</output><output data-prints hidden>{JSON.stringify(printed)}</output>
 </main>;
}

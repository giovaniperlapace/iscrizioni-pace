"use client";
// Local synthetic fixture: never import from an application route in a release.
import { useRef, useState } from "react";
import { ReceptionConsole } from "@/app/dashboard/accoglienza/reception-console";
import type { CameraSource } from "@/lib/reception/camera";
import type { ReceptionCommand, ReceptionResult } from "@/lib/reception/contracts";
const adult="11111111-1111-4111-8111-111111111111";
const child="22222222-2222-4222-8222-222222222222";
type Valid = Extract<ReceptionResult,{status:"valid"}>;
export default function ReceptionFixture() {
  const records=useRef(new Map<string,Valid>());
  const [mode,setMode]=useState("normal");
  const modeRef=useRef("normal");
  const [operations,setOperations]=useState<unknown[]>([]);
  const [requests,setRequests]=useState<string[]>([]);
  const seen=useRef(new Set<string>());
  const uncertain=useRef(false);
  const cameraCode=useRef<string|null>(null);
  const [cameraStats,setCameraStats]=useState({started:0,stopped:0,facing:""});
  const [source] = useState<CameraSource>(() => async ({facing,signal,onCode}: Parameters<CameraSource>[0]) => {
    if(modeRef.current==="camera-denied") throw new DOMException("Synthetic denial","NotAllowedError");
    setCameraStats(s=>({...s,started:s.started+1,facing}));
    const timer=setInterval(()=>{if(cameraCode.current)onCode(cameraCode.current);},250);
    let stopped=false;
    const stop=()=>{if(stopped)return;stopped=true;clearInterval(timer);setCameraStats(s=>({...s,stopped:s.stopped+1}));};
    signal.addEventListener("abort",stop,{once:true});return stop;
  });
  async function commandAction(command:ReceptionCommand):Promise<ReceptionResult> {
    await new Promise(resolve=>setTimeout(resolve,modeRef.current==="slow"?1800:350));
    if(modeRef.current==="forbidden") return {status:"forbidden"};
    if(command.lookup.value==="NOPE") return {status:"invalid"};
    const key=command.lookup.kind==="code"?command.lookup.value:command.lookup.value.startsWith("s")?"SCHO":command.lookup.value.startsWith("f")?"FAML":"SOLO";
    if(!records.current.has(key)) records.current.set(key,key==="SCHO"?{
      status:"valid",kind:"school",revision:0,outcome:"verified",registrationStatus:"submitted",
      schoolName:"Scuola di prova",classDescription:"Classe 1A",expectedStudents:20,expectedCompanions:2,students:0,companions:0,checkedInAt:null,
    }:{status:"valid",kind:"family",revision:0,outcome:"verified",registrationStatus:"confirmed",code:key,persons:[
      {id:adult,kind:"adult",firstName:"Anna",lastName:"Bianchi",checkedInAt:null},
      ...(key==="FAML"?[{id:child,kind:"child" as const,firstName:"Luca",lastName:"Bianchi",checkedInAt:null}]:[]),
    ]});
    const state=records.current.get(key)!;
    if(command.action==="inspect") return structuredClone({...state,outcome:"verified"});
    setOperations(old=>[...old,{action:command.action,subjects:command.subjectIds,duty:command.duty}]);
    setRequests(old=>[...old,command.requestId!]);
    if(modeRef.current==="conflict") return {status:"conflict"};
    if(!seen.current.has(command.requestId!)) {
      seen.current.add(command.requestId!);
      const before=JSON.stringify(state);const now="2026-09-22T12:30:00Z";
      if(state.kind==="family") state.persons=state.persons.map(p=>({...p,checkedInAt:
        command.action==="correct" ? (command.subjectIds?.includes(p.id)?p.checkedInAt??now:null) :
        command.subjectIds?.includes(p.id) ? (command.action==="cancel"?null:p.checkedInAt??now) : p.checkedInAt}));
      else if(command.action==="cancel"){state.students=0;state.companions=0;state.checkedInAt=null;}
      else if(command.action==="correct" || !state.checkedInAt){state.students=command.students!;state.companions=command.companions!;state.checkedInAt=now;}
      if(before!==JSON.stringify(state)){state.revision++;state.outcome="saved";}else state.outcome="unchanged";
    } else state.outcome="replayed";
    if(modeRef.current==="uncertain" && !uncertain.current) {uncertain.current=true;return {status:"unavailable"};}
    return structuredClone(state);
  }
  return <main className="app-page mx-auto max-w-4xl p-4 sm:p-8">
    <h1 className="text-lg font-semibold">Collaudo sintetico P12</h1>
    <label>Scenario di prova<select value={mode} onChange={event=>{setMode(event.target.value);modeRef.current=event.target.value;}}>
      <option value="normal">Normale</option><option value="uncertain">Risposta incerta</option><option value="conflict">Conflitto</option>
      <option value="forbidden">Sessione scaduta</option><option value="camera-denied">Fotocamera negata</option><option value="slow">Rete lenta</option>
    </select></label>
    <div className="flex flex-wrap gap-2 py-3" aria-label="Fotogramma sintetico">
      <button onClick={()=>{cameraCode.current="a".repeat(43);}}>QR singolo</button>
      <button onClick={()=>{cameraCode.current="f".repeat(43);}}>QR famiglia</button>
      <button onClick={()=>{cameraCode.current="s".repeat(43);}}>QR scuola</button>
      <button onClick={()=>{cameraCode.current=null;}}>Nessun QR</button>
      <button onClick={()=>{cameraCode.current="https://example.invalid";}}>QR estraneo</button>
    </div>
    <ReceptionConsole commandAction={commandAction} cameraSource={source} />
    <output data-operations className="block break-all">{JSON.stringify(operations)}</output>
    <output data-requests className="block break-all">{JSON.stringify(requests)}</output>
    <output data-camera className="block break-all">{JSON.stringify(cameraStats)}</output>
  </main>;
}

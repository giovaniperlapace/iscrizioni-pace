"use client";
import { useRef, useState } from "react";
import { ReceptionConsole } from "@/app/dashboard/accoglienza/reception-console";
import type { ReceptionCommand, ReceptionResult } from "@/lib/reception/contracts";
const adult="11111111-1111-4111-8111-111111111111";
const child="22222222-2222-4222-8222-222222222222";
type Valid = Extract<ReceptionResult,{status:"valid"}>;
export default function ReceptionFixture() {
  const state=useRef<Valid>({status:"valid",kind:"family",revision:0,outcome:"verified",registrationStatus:"confirmed",code:"TEST",persons:[
    {id:adult,kind:"adult",firstName:"Anna",lastName:"Bianchi",checkedInAt:null},
    {id:child,kind:"child",firstName:"Luca",lastName:"Bianchi",checkedInAt:null},
  ]});
  const [mode,setMode]=useState("normal");
  const calls=useRef<string[]>([]);
  const [operations,setOperations]=useState<unknown[]>([]);
  const [requests,setRequests]=useState<string[]>([]);
  const seen=useRef(new Set<string>());
  const uncertain=useRef(false);
  async function commandAction(command:ReceptionCommand):Promise<ReceptionResult> {
    await new Promise(resolve=>setTimeout(resolve,350));
    if(command.lookup.value==="NOPE") return {status:"invalid"};
    if(command.action==="inspect") {
      if(command.lookup.kind==="qr" && state.current.kind!=="school") state.current={status:"valid",kind:"school",revision:0,outcome:"verified",registrationStatus:"submitted",
        schoolName:"Scuola di prova",classDescription:"Classe 1A",expectedStudents:20,expectedCompanions:2,students:0,companions:0,checkedInAt:null};
      return structuredClone(state.current);
    }
    setOperations(old=>[...old,{action:command.action,subjects:command.subjectIds}]);
    calls.current.push(command.requestId!);setRequests([...calls.current]);
    if(mode==="conflict") return {status:"conflict"};
    if(!seen.current.has(command.requestId!)) {
      seen.current.add(command.requestId!);
      const now="2026-09-12T12:30:00Z";
      const s=state.current;
      if(s.kind==="family") s.persons=s.persons.map(p=>({...p,checkedInAt:
        command.action==="correct" ? (command.subjectIds?.includes(p.id)?now:null) :
        command.subjectIds?.includes(p.id) ? (command.action==="cancel"?null:now) : p.checkedInAt}));
      else {s.students=command.action==="cancel"?0:command.students!;s.companions=command.action==="cancel"?0:command.companions!;s.checkedInAt=command.action==="cancel"?null:now;}
      s.revision++;s.outcome="saved";
    } else state.current.outcome="replayed";
    if(mode==="uncertain" && !uncertain.current) {uncertain.current=true;return {status:"unavailable"};}
    return structuredClone(state.current);
  }
  return <main className="app-page mx-auto max-w-4xl p-4 sm:p-8">
    <label>Scenario di prova<select value={mode} onChange={event=>setMode(event.target.value)}><option value="normal">Normale</option><option value="uncertain">Risposta incerta</option><option value="conflict">Conflitto</option></select></label>
    <ReceptionConsole commandAction={commandAction} />
    <output data-operations>{JSON.stringify(operations)}</output>
    <output data-requests>{JSON.stringify(requests)}</output>
  </main>;
}

"use client";
// Shared controls with synthetic queue state; exact atomic SQL claims are tested separately.
import { useCallback, useRef, useState } from "react";
import { QrLabelPanel } from "@/app/dashboard/qr-label-panel";
import type { LabelCommand, LabelQueue, LabelResult } from "@/lib/reception/qr-labels";
const ids = [1,2,3,4,5].map(n => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`);
export default function Fixture({ documents }: { documents: Record<string,string> }) {
  const [viewVersion, setViewVersion] = useState(0);
  const revision = useRef(1), failRead = useRef(false), invalidate = useRef(false);
  const requests = useRef(new Map<string,string[]>());
  const items = useRef<LabelQueue["items"]>([
    {registrationId:ids[0],name:"Ada Mori",code:"TEST-101",reason:null,state:"pending",attempts:0,outcome:null,changed:false},
    {registrationId:ids[1],name:"Alessandra Francesca Monteverdi",code:"TEST-102",reason:null,state:"pending",attempts:0,outcome:null,changed:false},
    {registrationId:ids[2],name:"José María García López",code:"TEST-103",reason:null,state:"prepared",attempts:1,outcome:"requested",changed:false},
    {registrationId:ids[3],name:"Олександр Шевченко",code:"TEST-104",reason:null,state:"verified",attempts:1,outcome:"browser_returned",changed:false},
    {registrationId:ids[4],name:"Non stampabile",code:"TEST-105",reason:"revoked",state:"pending",attempts:0,outcome:null,changed:false},
  ]);
  const commandAction = useCallback(async (command: LabelCommand):Promise<LabelResult> => {
    const log = ((window as unknown as { __labelCommands?: LabelCommand[] }).__labelCommands ??= []); log.push(command);
    const queue = ():LabelQueue => ({status:"queue",snapshot:String(revision.current).padStart(64,"0"),items:command.groupId ? items.current : items.current.filter(item=>item.registrationId===command.registrationId)});
    if (command.action === "read") {
      await new Promise(resolve=>setTimeout(resolve,100));
      if(failRead.current){failRead.current=false;return {status:"unavailable"};}
      if(invalidate.current){invalidate.current=false;items.current=items.current.map(item=>item.registrationId===ids[1]?{...item,reason:"revoked"}:item);revision.current++;}
      return queue();
    }
    if (command.action === "outcome") {
      const selected=requests.current.get(command.requestId!)??[];
      items.current=items.current.map(item=>selected.includes(item.registrationId)?{...item,outcome:command.outcome!}:item);revision.current++;return queue();
    }
    if (command.action!=="request" || command.snapshot!==queue().snapshot) return {status:"conflict"};
    const html=documents[command.ids!.slice().sort().join(",")];
    if(!html || command.ids!.some(id=>!queue().items.some(item=>item.registrationId===id&&!item.reason)))return {status:"unavailable"};
    requests.current.set(command.requestId!,command.ids!);
    items.current=items.current.map(item=>command.ids!.includes(item.registrationId)?{...item,state:"prepared",attempts:item.attempts+1,outcome:"requested"}:item);revision.current++;
    return {status:"document",html,requestId:command.requestId!};
  },[documents]);
  return <main className="app-page"><div className="mx-auto grid max-w-3xl gap-6 p-4">
    <section aria-label="Singolo sintetico"><h1 className="mb-2 text-xl">Singolo</h1><QrLabelPanel key={viewVersion} scope={{registrationId:ids[0]}} commandAction={commandAction}/></section>
    <section aria-label="Gruppo sintetico"><h2 className="mb-2 text-xl">Gruppo</h2><QrLabelPanel key={viewVersion} scope={{groupId:ids[0]}} commandAction={commandAction}/></section>
    <aside className="grid gap-2" aria-label="Controlli sintetici"><button onClick={()=>{failRead.current=true;}}>Simula errore di lettura</button><button onClick={()=>{invalidate.current=true;}}>Simula QR revocato</button><button onClick={()=>setViewVersion(v=>v+1)}>Riapri i pannelli</button></aside>
  </div></main>;
}

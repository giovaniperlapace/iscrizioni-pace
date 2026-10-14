"use client";
// Synthetic UI contract fixture; persistence/concurrency are checked separately in PostgreSQL.
import { useRef } from "react";
import { QrLabelPanel } from "@/app/dashboard/qr-label-panel";
import type { LabelQueue } from "@/lib/reception/qr-labels";
const ids = [1,2,3,4,5].map(n => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`);
export default function Fixture({ documents }: { documents: Record<string,string> }) {
  const revision = useRef(1);
  const items = useRef<LabelQueue["items"]>([
    {registrationId:ids[0],name:"Ada Mori",code:"TEST-101",reason:null,state:"pending",attempts:0,outcome:null,changed:false},
    {registrationId:ids[1],name:"Alessandra Francesca Monteverdi",code:"TEST-102",reason:null,state:"pending",attempts:0,outcome:null,changed:false},
    {registrationId:ids[2],name:"José María García López",code:"TEST-103",reason:null,state:"prepared",attempts:1,outcome:"requested",changed:false},
    {registrationId:ids[3],name:"Олександр Шевченко",code:"TEST-104",reason:null,state:"verified",attempts:1,outcome:"browser_returned",changed:false},
    {registrationId:ids[4],name:"Non stampabile",code:"TEST-105",reason:"revoked",state:"pending",attempts:0,outcome:null,changed:false},
  ]);
  function queue():LabelQueue {return {status:"queue",snapshot:String(revision.current).padStart(64,"0"),items:items.current};}
  return <main className="app-page"><div className="mx-auto max-w-3xl p-4"><QrLabelPanel scope={{groupId:ids[0]}} commandAction={async command => {
    const log = ((window as unknown as { __labelCommands?: string[] }).__labelCommands ??= []); log.push(command.action);
    if (command.action === "read") return queue();
    if (command.action === "outcome") { items.current = items.current.map(i => i.state === "prepared" ? {...i,outcome:command.outcome!} : i); revision.current++; return queue(); }
    if (command.snapshot !== queue().snapshot) return {status:"conflict"};
    if (command.action === "verify") { items.current = items.current.map(i => command.ids!.includes(i.registrationId) ? {...i,state:"verified"} : i); revision.current++; return queue(); }
    const html=documents[command.ids!.slice().sort().join(",")];
    if(!html)return {status:"unavailable"};
    items.current=items.current.map(i=>command.ids!.includes(i.registrationId)?{...i,state:"prepared",attempts:i.attempts+1,outcome:"requested"}:i);revision.current++;
    return {status:"document",html,requestId:command.requestId!};
  }} /></div></main>;
}

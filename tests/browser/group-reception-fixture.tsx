"use client";
import { useRef } from "react";
import { ReceptionConsole } from "@/app/dashboard/accoglienza/reception-console";
import type { ReceptionResult } from "@/lib/reception/contracts";
import type { BadgeCommand, BadgeQueue, BadgeResult } from "@/lib/reception/group-badges";
const id="11111111-1111-4111-8111-111111111111", child="22222222-2222-4222-8222-222222222222";
const initial:Extract<ReceptionResult,{kind:"group"}>={status:"valid",kind:"group",groupId:id,groupName:"Gruppo sintetico Roma",snapshot:"b".repeat(64),revision:0,outcome:"verified",registrationStatus:"confirmed",persons:[{id,registrationId:id,code:"TST1",kind:"adult",firstName:"Anna",lastName:"Test",checkedInAt:null},{id:child,registrationId:id,code:"TST1",kind:"child",firstName:"Luca",lastName:"Test",checkedInAt:null}]};
export default function Fixture(){
 const group=useRef(initial);const queue=useRef<BadgeQueue|null>(null);
 return <main className="mx-auto max-w-3xl p-4"><ReceptionConsole commandAction={async c=>{
  if(c.action!=="inspect")group.current={...group.current,outcome:"saved",persons:group.current.persons.map(p=>({...p,checkedInAt:c.subjectIds?.includes(p.id)?"2026-10-06T10:00:00Z":p.checkedInAt})),snapshot:"c".repeat(64)};
  return group.current;
 }} badgeCommandAction={async (c:BadgeCommand):Promise<BadgeResult>=>{
  if(c.action==="create")queue.current={status:"queue",batchId:c.batchId!,items:[{registrationId:id,position:1,state:"pending",attempts:0,name:"Anna Test",code:"TST1",available:true}]};
  if(!queue.current)return {status:"empty"};
  if(c.action==="prepare"){queue.current={...queue.current,items:queue.current.items.map(i=>({...i,state:"prepared",attempts:i.attempts+1}))};return {status:"ready",name:"Anna Test",code:"TST1",image:"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNjAiIGhlaWdodD0iMTYwIj48cmVjdCB3aWR0aD0iMTYwIiBoZWlnaHQ9IjE2MCIgZmlsbD0iYmxhY2siLz48L3N2Zz4="};}
  if(c.action==="verify"||c.action==="reprint")queue.current={...queue.current,items:queue.current.items.map(i=>({...i,state:c.action==="verify"?"verified":"pending"}))};
  return queue.current;
 }}/></main>;
}

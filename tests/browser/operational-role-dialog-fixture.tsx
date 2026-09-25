"use client";
import { useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OperationalRoleDialog, type RoleAssignment } from "@/components/operational-role-dialog";
const assignments: RoleAssignment[] = [
  { role: "capogruppo", eventId: "event", eventTitle: "Evento di prova", groupId: "group", groupName: "Anziani – Serpentara Prima Porta e San Basilio", isPrimaryGroupLeader: true },
  { role: "accoglienza", eventId: "event", eventTitle: "Evento di prova", groupId: null, groupName: null, isPrimaryGroupLeader: null },
];
export default function Fixture() {
  const router=useRouter(),params=useSearchParams(),failed=useRef(false);
  const roleRows=useRef(assignments);
  const assign=async(data:FormData)=>{
    await new Promise(resolve=>setTimeout(resolve,150));
    const role=String(data.get("role"));
    if((role==="manager"||role==="manager_viewer")&&roleRows.current.some(a=>a.role===(role==="manager"?"manager_viewer":"manager")))return {status:"error",issues:[{field:null,code:"roleExclusive"}]};
    roleRows.current=[...roleRows.current,{...assignments[1],role}];
    return {status:"success"};
  };
  const remove=async(data:FormData)=>{
    await new Promise(resolve=>setTimeout(resolve,200));
    if(params.has("fail")&&!failed.current){failed.current=true;return {status:"error",issues:[{field:null,code:"roleRemovalFailed"}]};}
    roleRows.current=roleRows.current.filter(a=>a.role!==data.get("role"));
    return {status:"success"};
  };
  return <main className="p-6"><h1>Utenti e ruoli · prova sintetica</h1><div className="h-[700px]" /><button onClick={()=>router.replace("?roleUserId=target",{scroll:false})}>Gestisci Giulia</button>
    {params.has("roleUserId")?<OperationalRoleDialog person={{userId:"target",fullName:"Giulia Rossi",email:"giulia@example.test",assignments:params.has("empty")?[]:assignments}}
      eventOptions={[{id:"event",title:"Evento di prova"}]} groupOptions={[{id:"group",eventId:"event",name:"Anziani – Serpentara Prima Porta e San Basilio",eventTitle:"Evento di prova"},{id:"group2",eventId:"event",name:"Varsavia",eventTitle:"Evento di prova"}]}
      sourceDashboard={params.has("admin")?"admin":"manager"} navMode="mini" actorUserId={params.has("self")?"target":"actor"} assignAction={assign} removeAction={remove}/>:null}
  </main>;
}

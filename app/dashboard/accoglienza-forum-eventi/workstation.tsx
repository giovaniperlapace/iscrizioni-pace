"use client";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DutyOption } from "@/lib/reception/event-duties";
import type { ReceptionCommand, ReceptionLookup, ReceptionResult } from "@/lib/reception/contracts";
import { DESK_MESSAGES, type DeskRequest, type DeskResult } from "@/lib/reception/forum-desk";
import { EventReceptionConsole } from "../accoglienza/event-reception-console";
import PendingLink from "@/components/pending-link";
async function send(eventId: string, body: object) {
  try {
    const response=await fetch("/api/forum-reception",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventId,...body}),cache:"no-store",signal:AbortSignal.timeout(25000)});
    return await response.json();
  } catch { return {status:"unavailable"}; }
}
export type ForumReceptionTransport = typeof send;
export function ForumReceptionWorkstation({eventId,choices,canManage,requestAction=send}:{eventId:string;choices:DutyOption[];canManage:boolean;requestAction?:ForumReceptionTransport}) {
  const [mode,setMode]=useState<"computer"|"phone"|null>(null);
  const [selected,setSelected]=useState<string|null>(choices.length===1 ? choices[0].key : null);
  const [query,setQuery]=useState("");
  const duty=choices.find(item => item.key===selected);
  if(!choices.length) return <div className="surface-card grid gap-3 p-5"><p>Nessun incarico assegnato per l’evento corrente.</p>{canManage && <PendingLink className="underline" href="/dashboard/manager?section=ruoli">Assegna gli incarichi in Utenti e ruoli</PendingLink>}</div>;
  if(!mode) return <section className="surface-card grid gap-4 p-5"><h2 className="text-xl font-semibold">Scegli la postazione</h2><div className="grid gap-3 sm:grid-cols-2">
    <button className="btn-secondary min-h-24 p-4 text-left" onClick={()=>setMode("phone")}><strong className="block">Telefono · scansione e ingressi</strong>Verifica prenotazioni e biglietti all’ingresso.</button>
    <button className="btn-secondary min-h-24 p-4 text-left" onClick={()=>setMode("computer")}><strong className="block">Computer · iscrizioni e ingressi</strong>Inserisci il codice, prenota un posto disponibile e registra l’ingresso.</button>
  </div></section>;
  if(!duty) return <section className="surface-card grid gap-4 p-5"><h2 className="text-xl font-semibold">Per quale Forum o cerimonia lavori?</h2><p>La fotocamera si aprirà dopo la scelta.</p>
    <label className="grid gap-1">Cerca incarico<input className="field min-h-12" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Numero o nome del Forum"/></label>
    <div className="grid gap-2">{choices.filter(item=>(item.title+" "+(item.room??"")).toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(item=><button key={item.key} className="btn-secondary min-h-16 p-3 text-left" onClick={()=>{setSelected(item.key);setQuery("");}}><strong className="block">{item.title}</strong>{item.room}</button>)}</div>
    <button className="min-h-11 justify-self-start underline" onClick={()=>setMode(null)}>Cambia postazione</button>
  </section>;
  return <ActiveStation key={`${mode}-${duty.key}`} {...{eventId,duty,mode,canManage,requestAction}} onChangeDuty={choices.length>1 ? ()=>setSelected(null):undefined} onChangeMode={()=>setMode(null)}/>;
}
function ActiveStation({eventId,duty,mode,canManage,requestAction,onChangeDuty,onChangeMode}:{eventId:string;duty:DutyOption;mode:"phone"|"computer";canManage:boolean;requestAction:ForumReceptionTransport;onChangeDuty?:()=>void;onChangeMode:()=>void}) {
  const [lookup,setLookup]=useState<ReceptionLookup|null>(null);
  const [deskBusy,setDeskBusy]=useState(false);
  const [scanBusy,setScanBusy]=useState(false);
  const [stats,setStats]=useState<{booked:number;entered:number}|null>(null);
  const [statsError,setStatsError]=useState(false);
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{let active=true;void requestAction(eventId,{operation:"statistics",target:duty.key}).then(result=>{
    if(!active)return;if(result.status!=="ready" || !Number.isSafeInteger(result.booked)||!Number.isSafeInteger(result.entered)){setStatsError(true);setStats(null);}else {setStatsError(false);setStats(result);}
  });return()=>{active=false;};},[eventId,duty.key,refresh,requestAction]);
  const commandAction=useCallback(async(command:ReceptionCommand):Promise<ReceptionResult>=>{
    if(deskBusy)return {status:"invalid_request"};
    const result=await requestAction(eventId,{operation:"scan",command});
    if(result.status==="valid" && command.action!=="inspect")setRefresh(value=>value+1);
    return result;
  },[eventId,deskBusy,requestAction]);
  const statistics = <section className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm" aria-label="Statistiche dell’incarico" aria-live="polite">
      {stats ? <><p><strong>{stats.booked}</strong> {duty.kind==="panel"?"Iscritti":"Assegnatari"}</p><p><strong>{stats.entered}</strong> Entrati</p></>:<p role={statsError?"alert":"status"}>{statsError?"Statistiche non disponibili.":"Caricamento statistiche…"}</p>}
      <div className="flex w-full justify-center"><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-current/30 px-3 text-xs hover:bg-current/10 focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="Aggiorna conteggi" title="Aggiorna conteggi" onClick={()=>setRefresh(value=>value+1)}><RefreshCw size={16} aria-hidden="true" />Aggiorna conteggi</button></div>
    </section>;
  return <div className="grid gap-4">
    <div inert={deskBusy || undefined}><EventReceptionConsole statistics={statistics} navigationAboveTitle duty={{key:duty.key,duty:duty.kind==="panel"?"panel_entry":"ceremony_entry",panelId:duty.key,title:duty.title,room:duty.room}} deviceMode={mode} commandAction={commandAction} onLookup={setLookup} onBusy={setScanBusy} onChangeDuty={deskBusy?undefined:onChangeDuty} onChangeMode={deskBusy?undefined:onChangeMode}/></div>
    {mode==="computer" && <section className="surface-card grid gap-3 p-5"><h2 className="text-lg font-semibold">Prenota un posto</h2><p className="text-sm">Leggi il codice della persona, poi assegna una prenotazione. L’ingresso si conferma separatamente.</p>
      {lookup ? <Desk key={`${lookup.kind}:${lookup.value}`} {...{eventId,duty,lookup,requestAction}} disabled={scanBusy} onBusy={setDeskBusy} onSaved={()=>setRefresh(value=>value+1)}/> : <p className="text-sm text-slate-600">Inserisci o scansiona prima il codice.</p>}
      {canManage && <div className="flex flex-wrap gap-4 text-sm"><PendingLink href="/dashboard/manager?section=iscritti" className="underline">Gestione partecipanti</PendingLink><PendingLink href="/dashboard/manager/nuovo" className="underline">Inserisci un nuovo partecipante</PendingLink></div>}
    </section>}
  </div>;
}
function Desk({eventId,duty,lookup,disabled,onBusy,onSaved,requestAction}:{eventId:string;duty:DutyOption;lookup:ReceptionLookup;requestAction:ForumReceptionTransport;disabled:boolean;onBusy:(value:boolean)=>void;onSaved:()=>void}) {
  const [preview,setPreview]=useState<DeskResult|null>(null);
  const [option,setOption]=useState("");
  const [children,setChildren]=useState<string[]>([]);
  const [pending,setPending]=useState(false);
  const [status,setStatus]=useState("");
  const running=useRef(false);
  const retry=useRef<DeskRequest|null>(null);
  const uncertain=status==="unavailable";
  async function run(command:DeskRequest) {
    if(running.current || disabled)return;
    running.current=true;setPending(true);onBusy(true);retry.current=command;
    const result:DeskResult=await requestAction(eventId,{operation:"desk",command});
    setStatus(result.status);
    if(result.status==="ready"){setPreview(result);setOption("");setChildren([]);}
    if(result.status==="saved"){setPreview(null);onSaved();}
    running.current=false;setPending(false);
    if(result.status!=="unavailable"){retry.current=null;onBusy(false);}
  }
  useEffect(()=>{if(!pending&&!uncertain)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[pending,uncertain]);
  return <div className="grid gap-3">
    {status && status!=="ready" && <p role={status==="saved"?"status":"alert"}>{DESK_MESSAGES[status]??"Operazione non riuscita. Rileggi il codice."}</p>}
    {uncertain ? <button className="btn-primary min-h-12" disabled={pending} onClick={()=>retry.current&&void run(retry.current)}>Riprova la stessa richiesta</button> : <>
      <button className="btn-secondary min-h-11 px-4" disabled={pending||disabled} onClick={()=>void run({target:duty.key,lookup,operation:"preview"})}>{pending?"Verifica in corso…":"Verifica disponibilità"}</button>
      {preview?.status==="ready" && <form className="grid gap-3" onSubmit={event=>{event.preventDefault();void run({target:duty.key,lookup,operation:"book",option,children,request:crypto.randomUUID()});}}><fieldset className="grid gap-3" disabled={pending||disabled}>
        <p className="font-semibold">{preview.name} · {duty.title}</p>
        <label className="grid gap-1">Posto da prenotare<select required className="field min-h-12" value={option} onChange={event=>setOption(event.target.value)}><option value="">Scegli settore o quota</option>{preview.options?.map(item=><option key={item.id} value={item.id} disabled={item.available<1}>{item.label} · {item.available} disponibili</option>)}</select></label>
        {!!preview.children?.length && <fieldset className="grid gap-2"><legend>Minori da includere nella prenotazione</legend>{preview.children.map(child=><label className="flex min-h-11 items-center gap-3" key={child.id}><input type="checkbox" checked={children.includes(child.id)} onChange={event=>setChildren(ids=>event.target.checked?[...ids,child.id]:ids.filter(id=>id!==child.id))}/>{child.name}</label>)}</fieldset>}
        {duty.kind==="ceremony"&&<p className="text-sm">Assegna un biglietto alla persona titolare del codice. Le assegnazioni dei minori si gestiscono nella distribuzione della cerimonia.</p>}
        <button className="btn-primary min-h-12 px-4" disabled={!option}>Conferma prenotazione</button>
      </fieldset></form>}
    </>}
  </div>;
}

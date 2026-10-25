"use client";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isDutyAvailable, nextDutyWindow, nextDutyBoundary, formatDutyWindowTime } from "@/lib/reception/duty-windows";
import { REGISTRATION_CHECK_DUTY, type DutyOption } from "@/lib/reception/event-duties";
import type { ReceptionCommand, ReceptionLookup, ReceptionResult } from "@/lib/reception/contracts";
import { DESK_MESSAGES, type DeskRequest, type DeskResult } from "@/lib/reception/forum-desk";
import { EventReceptionConsole } from "../accoglienza/event-reception-console";
import { usePhoneDutyHistory } from "./use-phone-duty-history";
import PendingLink from "@/components/pending-link";
import { RelayRoomStatistics } from "../accoglienza/relay-room-statistics";
import { parseRelayRoomStatistics, type RelayRoomStatistics as RelayRoom } from "@/lib/reception/relay-room-statistics";
async function send(eventId: string, body: object) {
  try {
    const response=await fetch("/api/forum-reception",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventId,...body}),cache:"no-store",signal:AbortSignal.timeout(25000)});
    return await response.json();
  } catch { return {status:"unavailable"}; }
}
export type ForumReceptionTransport = typeof send;
// The demo omits serverNow so its synthetic duties remain available at any time.
function useDutyClock(serverNow: number | undefined, choices: DutyOption[]) {
  const [now, setNow] = useState(serverNow);
  const clock = useRef<{ server: number; local: number } | null>(null);
  const readNow = useCallback(() => clock.current
    ? clock.current.server + Date.now() - clock.current.local
    : serverNow, [serverNow]);
  useEffect(() => {
    if (serverNow === undefined) return;
    clock.current = { server: serverNow, local: Date.now() };
    let timer: ReturnType<typeof setTimeout>;
    function update() {
      clearTimeout(timer);
      const current = readNow()!;
      setNow(current);
      const boundary = nextDutyBoundary(choices, current);
      timer = setTimeout(update, Math.min(60_000, boundary === null ? 60_000 : Math.max(1, boundary - current)));
    }
    // Resuming a suspended/background tab refreshes the list immediately.
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    timer = setTimeout(update, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [serverNow, choices, readNow]);
  return { now, readNow };
}

export function ForumReceptionWorkstation({eventId,choices:assignedChoices,canManage,requestAction=send,serverNow,phoneOnly=false}:{eventId:string;choices:DutyOption[];canManage:boolean;requestAction?:ForumReceptionTransport;serverNow?:number;phoneOnly?:boolean}) {
  const choices=useMemo(()=>[REGISTRATION_CHECK_DUTY,...assignedChoices.filter(item=>item.key!==REGISTRATION_CHECK_DUTY.key)],[assignedChoices]);
  const [selectedMode,setMode]=useState<"computer"|"phone"|null>(null);
  const mode=phoneOnly ? "phone" : selectedMode;
  const [localSelected,setSelected]=useState<string|null>(serverNow === undefined && choices.length===1 ? choices[0].key : null);
  const {now,readNow}=useDutyClock(serverNow,choices);
  const navigationBlocked=useRef(false);
  const onNavigationBusy=useCallback((value:boolean)=>{navigationBlocked.current=value;},[]);
  const isNavigationBlocked=useCallback(()=>navigationBlocked.current,[]);
  const canSelect=useCallback((key:string)=>{
    const item=choices.find(choice=>choice.key===key);
    const current=readNow();
    return !!item && (current===undefined || isDutyAvailable(item,current));
  },[choices,readNow]);
  const phoneHistory=usePhoneDutyHistory({enabled:phoneOnly,eventId,canSelect,isBlocked:isNavigationBlocked});
  const selected=phoneOnly ? phoneHistory.selected : localSelected;
  const available=now === undefined ? choices : choices.filter(item=>isDutyAvailable(item,now));
  const duty=choices.find(item => item.key===selected);
  const next=now === undefined ? null : nextDutyWindow(choices,now);
  const changeDuty=()=>{if(phoneOnly)phoneHistory.back();else setSelected(null);};
  const chooseMode=(nextMode:"phone"|"computer")=>{
    const current=readNow();
    if(duty && current !== undefined && !isDutyAvailable(duty,current)) changeDuty();
    setMode(nextMode);
  };
  if(!mode) return <section className="surface-card grid gap-4 p-5"><h2 className="text-xl font-semibold">Scegli la postazione</h2><div className="grid gap-3 sm:grid-cols-2">
    <button className="btn-secondary min-h-24 p-4 text-left" onClick={()=>chooseMode("phone")}><strong className="block">Telefono · scansione e ingressi</strong>Verifica iscrizioni, prenotazioni e biglietti all’ingresso.</button>
    <button className="btn-secondary min-h-24 p-4 text-left" onClick={()=>chooseMode("computer")}><strong className="block">Computer · iscrizioni e ingressi</strong>Inserisci il codice, prenota un posto disponibile e registra l’ingresso.</button>
  </div></section>;
  if(!duty) return <section className="surface-card grid gap-4 p-5"><h2 className="text-xl font-semibold">Scegli l’incarico</h2><p>La fotocamera si aprirà dopo la scelta.</p>
    {serverNow !== undefined && <p className="text-sm text-[var(--peace-muted)]">Incarichi disponibili ora · ora di Roma. L’elenco si aggiorna automaticamente.</p>}
    {available.length ? <>
      <div className="grid gap-2">{available.map(item=><button key={item.key} className="btn-secondary min-h-16 p-3 text-left" onClick={()=>{
        const current=readNow();
        if(current !== undefined && !isDutyAvailable(item,current)) return;
        if(phoneOnly)phoneHistory.select(item.key);else setSelected(item.key);
      }}><strong className="block">{item.title}</strong>{item.room}</button>)}</div>
    </> : <div role="status" className="grid gap-2"><p>Nessun incarico disponibile in questo momento.</p>{next && <p>Prossimo incarico: {next.duty.title}, dal {formatDutyWindowTime(next.from)}.</p>}</div>}
    {!phoneOnly && <button className="min-h-11 justify-self-start underline" onClick={()=>{changeDuty();setMode(null);}}>Cambia postazione</button>}
  </section>;
  return <>
    {now !== undefined && !isDutyAvailable(duty,now) && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3">La fascia di questo incarico è terminata. Concludi l’operazione in corso, poi scegli «Cambia incarico».</p>}
    <ActiveStation key={`${mode}-${duty.key}`} {...{eventId,duty,mode,canManage,requestAction,onNavigationBusy}} onChangeDuty={serverNow !== undefined || choices.length>1 ? changeDuty:undefined} onChangeMode={phoneOnly?undefined:()=>setMode(null)}/>
  </>;
}

function ActiveStation({eventId,duty,mode,canManage,requestAction,onChangeDuty,onChangeMode,onNavigationBusy}:{eventId:string;duty:DutyOption;mode:"phone"|"computer";canManage:boolean;requestAction:ForumReceptionTransport;onChangeDuty?:()=>void;onChangeMode?:()=>void;onNavigationBusy:(busy:boolean)=>void}) {
  const [lookup,setLookup]=useState<ReceptionLookup|null>(null);
  const [deskBusy,setDeskBusy]=useState(false);
  const [scanBusy,setScanBusy]=useState(false);
  const [stats,setStats]=useState<{booked:number;entered:number}|null>(null);
  const [statsError,setStatsError]=useState(false);
  const [relayRooms,setRelayRooms]=useState<RelayRoom[]|null>([]);
  const [statsLoading,setStatsLoading]=useState(true);
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{if(duty.kind==="verification")return;let active=true;void requestAction(eventId,{operation:"statistics",target:duty.key}).then(result=>{
    if(!active)return;
    setStatsLoading(false);
    if(result.status!=="ready" || !Number.isSafeInteger(result.booked)||!Number.isSafeInteger(result.entered)){setStatsError(true);setStats(null);setRelayRooms(null);}
    else {setStatsError(false);setStats(result);setRelayRooms(parseRelayRoomStatistics(result.relayRooms));}
  }).catch(()=>{if(active){setStatsLoading(false);setStatsError(true);setStats(null);setRelayRooms(null);}});return()=>{active=false;};},[eventId,duty.key,duty.kind,refresh,requestAction]);
  const refreshStatistics=useCallback(()=>{setStatsLoading(true);setRefresh(value=>value+1);},[]);
  const commandAction=useCallback(async(command:ReceptionCommand):Promise<ReceptionResult>=>{
    if(deskBusy)return {status:"invalid_request"};
    const result=await requestAction(eventId,{operation:"scan",command});
    if(result.status==="valid" && command.action!=="inspect")refreshStatistics();
    return result;
  },[eventId,deskBusy,requestAction,refreshStatistics]);
  const statistics = <section className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs" aria-label="Statistiche dell’incarico" aria-live="polite">
      {stats ? <><p><strong>{stats.booked}</strong> {duty.kind==="panel"?"Iscritti":"Assegnatari"}</p><p><strong>{stats.entered}</strong> Entrati</p></>:<p role={statsError?"alert":"status"}>{statsError?"Statistiche non disponibili.":"Caricamento statistiche…"}</p>}
      <button className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-current/30 px-2 text-xs hover:bg-current/10 focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="Aggiorna conteggi" title="Aggiorna conteggi" onClick={refreshStatistics}><RefreshCw size={16} aria-hidden="true" />Aggiorna conteggi</button>
    </section>;
  return <div className="grid gap-4">
    <div inert={deskBusy || undefined}><EventReceptionConsole statistics={duty.kind==="verification" ? <p className="text-xs">Iscrizione alla Preghiera per la pace · sola lettura</p> : statistics} belowResult={duty.kind==="panel" ? <RelayRoomStatistics rooms={relayRooms} loading={statsLoading}/> : undefined} navigationAboveTitle duty={duty.kind==="verification" ? {key:"registration_check",duty:"registration_check",title:duty.title,room:null} : {key:duty.key,duty:duty.kind==="panel"?"panel_entry":"ceremony_entry",panelId:duty.key,title:duty.title,room:duty.room}} deviceMode={mode} commandAction={commandAction} onLookup={setLookup} onBusy={setScanBusy} onNavigationBusy={onNavigationBusy} onChangeDuty={deskBusy?undefined:onChangeDuty} onChangeMode={deskBusy?undefined:onChangeMode}/></div>
    {mode==="computer" && duty.kind!=="verification" && <section className="surface-card grid gap-3 p-5"><h2 className="text-lg font-semibold">Prenota un posto</h2><p className="text-sm">Leggi il codice della persona, poi assegna una prenotazione. L’ingresso si conferma separatamente.</p>
      {lookup ? <Desk key={`${lookup.kind}:${lookup.value}`} {...{eventId,duty,lookup,requestAction}} disabled={scanBusy} onBusy={setDeskBusy} onSaved={refreshStatistics}/> : <p className="text-sm text-slate-600">Inserisci o scansiona prima il codice.</p>}
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

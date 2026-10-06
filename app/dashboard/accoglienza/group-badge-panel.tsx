"use client";
import { ProgressButton } from "@/components/button-progress";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ReceptionResult } from "@/lib/reception/contracts";
import type { BadgeCommand, BadgeQueue, BadgeResult } from "@/lib/reception/group-badges";
import { groupBadgeCommand } from "./actions";
type Group = Extract<ReceptionResult,{kind:"group"}>;
type Preview = {id:string; image:string; name:string; code:string};
const messages: Record<string,string> = {empty:"Nessun lotto salvato per questo gruppo.",invalid:"QR non valido.",conflict:"Il gruppo o la coda sono cambiati: riprendi la coda salvata e rileggi il QR prima di proseguire.",forbidden:"Incarico non più autorizzato. Accedi nuovamente.",unavailable:"Esito da verificare: ricarica la coda prima di riprendere. Non inviare di nuovo alla stampa.",qr_unavailable:"QR personale non disponibile. Contatta il responsabile; il codice non viene rigenerato.",already_prepared:"Badge già preparato: verifica l’esito oppure richiedi esplicitamente una ristampa."};
export function GroupBadgePanel({token,group,commandAction=groupBadgeCommand,onBusyChange}:{token:string;group:Group;commandAction?:(c:BadgeCommand)=>Promise<BadgeResult>;onBusyChange?:(busy:boolean)=>void}) {
 const [queue,setQueue]=useState<BadgeQueue|null>(null); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false); const lock=useRef(false);
 const [previews,setPreviews]=useState<Preview[]>([]); const [retry,setRetry]=useState<BadgeCommand|null>(null);
 const [selection,setSelection]=useState(()=>group.persons.filter(p=>p.kind==="adult" && group.persons.some(member=>member.registrationId===p.registrationId && member.checkedInAt)).map(p=>p.registrationId));
 useEffect(()=>{
  if(!busy && !retry)return;
  const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};
  window.addEventListener("beforeunload",warn);return ()=>window.removeEventListener("beforeunload",warn);
 },[busy,retry]);
 function setWorking(value:boolean){setBusy(value);onBusyChange?.(value);}
 async function call(c:BadgeCommand) {try {return await commandAction(c);} catch {return {status:"unavailable"} as const;}}
 async function run(c:BadgeCommand) {
  if(lock.current)return;lock.current=true;setWorking(true);setMessage("");
  try {const r=await call(c);if(r.status==="queue"){setQueue(r);if(c.action==="create")setRetry(null);}else {setMessage(messages[r.status]??"");if(r.status==="unavailable" && c.action==="create")setRetry(c);}}
  finally {lock.current=false;setWorking(false);}
 }
 async function prepare() {
  if(lock.current||!queue)return;lock.current=true;setWorking(true);setMessage("");
  try {
   for(const item of queue.items.filter(i=>i.state==="pending" && i.available)) {
    const r=await call({token,action:"prepare",batchId:queue.batchId,registrationId:item.registrationId});
    if(r.status!=="ready"){setMessage(`${item.name??item.code}: ${messages[r.status]??"Preparazione non disponibile."}`);break;}
    setPreviews(p=>[...p.filter(x=>x.id!==item.registrationId),{id:item.registrationId,image:r.image,name:r.name,code:r.code}]);
   }
   const refreshed=await call({token,action:"read",batchId:queue.batchId});
   if(refreshed.status==="queue")setQueue(refreshed);else setMessage(messages[refreshed.status]??"");
  } finally {lock.current=false;setWorking(false);}
 }
 function print() {
  if(!previews.length)return;
  // A separate document keeps operator controls and other participants out of print.
  const popup=window.open("","_blank","popup,width=700,height=800");
  if(!popup){setMessage("Consenti l’apertura della finestra di stampa per questa postazione.");return;}
  popup.opener=null;
  const style=popup.document.createElement("style");style.textContent="@page{margin:10mm}body{font-family:Arial,sans-serif}article{break-after:page;text-align:center;padding:8mm}img{width:40mm;height:40mm}button{padding:12px}@media print{button,p{display:none}}";popup.document.head.append(style);
  popup.document.title="Badge gruppo";
  const notice=popup.document.createElement("p");notice.textContent="Anteprima: formato etichetta da adattare alla stampante. Dopo la stampa verifica i badge nella coda.";popup.document.body.append(notice);
  const button=popup.document.createElement("button");button.textContent="Stampa badge in sequenza";button.onclick=()=>popup.print();popup.document.body.append(button);
  for(const p of previews){const article=popup.document.createElement("article");const name=popup.document.createElement("h2");name.textContent=p.name;const img=popup.document.createElement("img");img.src=p.image;img.alt="QR personale";const code=popup.document.createElement("h3");code.textContent=p.code;article.append(name,img,code);popup.document.body.append(article);}
 }
 return <section className="grid gap-3 rounded-xl border p-3" aria-label="Badge del gruppo">
  <h4 className="font-semibold">Badge del gruppo</h4><p className="text-sm">Un badge per ogni QR personale esistente. I minori restano collegati al QR del genitore. Preparare o stampare non registra presenze. Il formato per le etichette deve ancora essere adattato alla stampante.</p>
  <fieldset disabled={busy||!!retry} className="grid gap-2">
   <legend className="font-medium">Scegli i badge da preparare</legend>
   <button type="button" className="btn-secondary min-h-12 px-3" onClick={()=>setSelection(group.persons.filter(p=>p.kind==="adult").map(p=>p.registrationId))}>Seleziona tutti i badge del gruppo</button>
   {group.persons.filter(p=>p.kind==="adult").map(p=><label key={p.id} className="flex min-h-12 items-center gap-2"><input type="checkbox" checked={selection.includes(p.id)} onChange={e=>setSelection(ids=>e.target.checked?[...ids,p.id]:ids.filter(id=>id!==p.id))}/>{p.firstName} {p.lastName} · {p.code}</label>)}
   <button className="btn-secondary min-h-12 px-3" disabled={!selection.length || !!queue?.items.some(i=>i.available && i.state!=="verified")} onClick={()=>{setPreviews([]);void run({token,action:"create",batchId:crypto.randomUUID(),registrationIds:selection,snapshot:group.snapshot});}}>Crea lotto · {selection.length} badge</button>
  </fieldset>
  <button className="btn-secondary min-h-12 px-3" disabled={busy} onClick={()=>void run({token,action:"read",...(queue?{batchId:queue.batchId}:{})})}>Riprendi la coda salvata</button>
  {retry && <button className="btn-primary min-h-12 px-3" disabled={busy} onClick={()=>void run(retry)}>Verifica la creazione dello stesso lotto</button>}
  {message && <p role="alert">{message}</p>}{busy && <p role="status">Preparazione in corso…</p>}
  {queue && <><p className="text-sm">{queue.items.length} badge nel lotto. «Preparato» non conferma la stampa fisica.</p>
   <ProgressButton aria-busy={busy} progressError={!!message} className="btn-primary min-h-12 px-3" disabled={busy||!queue.items.some(i=>i.available&&i.state==="pending")} onClick={()=>void prepare()}>Prepara i badge in attesa</ProgressButton>
   <ul className="grid gap-3">{queue.items.map(i=><li key={i.registrationId} className="grid gap-2 border-t pt-2"><span>{i.position}. {i.name??"Persona non più nel gruppo"} · {i.state==="pending"?"Da preparare":i.state==="prepared"?"Preparato · da verificare":"Verificato dall’operatore"}</span>
    {i.available && <div className="flex flex-wrap gap-2">{i.state==="prepared" && <button className="btn-secondary min-h-12 px-3" disabled={busy} onClick={()=>void run({token,action:"verify",batchId:queue.batchId,registrationId:i.registrationId,expectedAttempts:i.attempts})}>Confermo il badge stampato</button>}
    {i.state!=="pending" && <button className="btn-secondary min-h-12 px-3" disabled={busy} onClick={()=>{setPreviews(p=>p.filter(x=>x.id!==i.registrationId));void run({token,action:"reprint",batchId:queue.batchId,registrationId:i.registrationId,expectedAttempts:i.attempts});}}>Richiedi ristampa di questo badge</button>}</div>}
   </li>)}</ul></>}
  {previews.length>0 && <><button className="btn-primary min-h-12 px-3" disabled={busy} onClick={print}>Apri anteprima di stampa · {previews.length} badge</button><div className="grid grid-cols-2 gap-3">{previews.map(p=><figure key={p.id}><Image unoptimized src={p.image} alt={`QR ${p.code}`} width={160} height={160}/><figcaption className="text-sm">{p.name} · {p.code}</figcaption></figure>)}</div></>}
 </section>;
}

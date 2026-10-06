"use client";
import { ProgressButton } from "@/components/button-progress";
import Image from "next/image";
import { useRef, useState } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";
import { groupReceptionQr } from "./actions";
const copies = {
 it:["QR accoglienza del gruppo","Comprende solo questo gruppo, senza sottogruppi. L’operatore confermerà chi è arrivato, minori inclusi.","Mostra QR","Scarica QR","Revoca QR","Crea un nuovo QR","QR revocato","QR non disponibile. Riprova.","Confermo la revoca del QR precedente","Attendi…"],
 en:["Group reception QR","Includes this group only, without subgroups. Staff will confirm who has arrived, including children.","Show QR","Download QR","Revoke QR","Create a new QR","QR revoked","QR unavailable. Try again.","I confirm revoking the previous QR","Please wait…"],
 fr:["QR d’accueil du groupe","Comprend uniquement ce groupe, sans sous-groupes. L’accueil confirmera les arrivées, enfants compris.","Afficher le QR","Télécharger le QR","Révoquer le QR","Créer un nouveau QR","QR révoqué","QR indisponible. Réessayez.","Je confirme la révocation du QR précédent","Patientez…"],
 de:["Gruppen-QR für den Empfang","Gilt nur für diese Gruppe, ohne Untergruppen. Der Empfang bestätigt die Anwesenden, einschließlich Kinder.","QR anzeigen","QR herunterladen","QR widerrufen","Neuen QR erstellen","QR widerrufen","QR nicht verfügbar. Erneut versuchen.","Ich bestätige den Widerruf des bisherigen QR","Bitte warten…"],
 es:["QR de recepción del grupo","Incluye solo este grupo, sin subgrupos. El personal confirmará quién ha llegado, incluidos los menores.","Mostrar QR","Descargar QR","Revocar QR","Crear un QR nuevo","QR revocado","QR no disponible. Inténtalo de nuevo.","Confirmo la revocación del QR anterior","Espera…"],
 nl:["Groeps-QR voor ontvangst","Alleen deze groep, zonder subgroepen. De ontvangst bevestigt wie is aangekomen, inclusief kinderen.","QR tonen","QR downloaden","QR intrekken","Nieuwe QR maken","QR ingetrokken","QR niet beschikbaar. Probeer opnieuw.","Ik bevestig het intrekken van de vorige QR","Even geduld…"],
 uk:["QR групи для реєстрації прибуття","Лише ця група, без підгруп. Працівник підтвердить, хто прибув, включно з дітьми.","Показати QR","Завантажити QR","Відкликати QR","Створити новий QR","QR відкликано","QR недоступний. Спробуйте ще раз.","Підтверджую відкликання попереднього QR","Зачекайте…"],
} satisfies Record<SupportedLocale,string[]>;
export function GroupReceptionQr({groupId,locale}:{groupId:string;locale:SupportedLocale}) {
 const c=copies[locale]; const lock=useRef(false); const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<Awaited<ReturnType<typeof groupReceptionQr>>|null>(null); const [confirmed,setConfirmed]=useState(false);
 async function run(action:"get"|"revoke"|"renew") {
  if(lock.current || (action!=="get" && !confirmed)) return;
  lock.current=true;setBusy(true);
  try {setResult(await groupReceptionQr(groupId,action));setConfirmed(false);} catch {setResult({status:"unavailable"});}
  finally {lock.current=false;setBusy(false);}
 }
 const failed=result?.status==="unavailable";
 return <section className="mt-4 grid gap-3 border-t pt-4">
  <h4 className="font-semibold">{c[0]}</h4><p className="text-sm">{c[1]}</p>
  <ProgressButton aria-busy={busy} progressError={failed} className="btn-secondary min-h-12 px-4" disabled={busy} onClick={()=>void run("get")}>{busy?c[9]:c[2]}</ProgressButton>
  {result?.status==="active" && <><Image unoptimized src={result.image} alt={c[0]} width={256} height={256}/><a className="underline" download="group-reception-qr.png" href={result.image}>{c[3]}</a></>}
  {result?.status==="revoked" && <p role="status">{c[6]}</p>}
  {result?.status==="unavailable" && <p role="alert">{c[7]}</p>}
  {(result?.status==="active" || result?.status==="revoked") && <><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>{c[8]}</label>
  <div className="flex flex-wrap gap-2">{result.status==="active" && <ProgressButton aria-busy={busy} progressError={failed} className="btn-secondary min-h-12 px-4" disabled={busy||!confirmed} onClick={()=>void run("revoke")}>{c[4]}</ProgressButton>}
  <ProgressButton aria-busy={busy} progressError={failed} className="btn-secondary min-h-12 px-4" disabled={busy||!confirmed} onClick={()=>void run("renew")}>{c[5]}</ProgressButton></div></>}
 </section>;
}

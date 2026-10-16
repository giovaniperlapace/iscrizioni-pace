"use client";
import { ProgressButton } from "@/components/button-progress";
import Image from "next/image";
import { QrCode } from "lucide-react";
import { groupQrFilename } from "@/lib/qrcode/filename";
import { useEffect, useId, useRef, useState } from "react";
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
const buttons = {
 it: ["QR del gruppo", "Chiudi"], en: ["Group QR", "Close"], fr: ["QR du groupe", "Fermer"],
 de: ["Gruppen-QR", "Schließen"], es: ["QR del grupo", "Cerrar"], nl: ["Groeps-QR", "Sluiten"], uk: ["QR групи", "Закрити"],
} satisfies Record<SupportedLocale, string[]>;

export function GroupReceptionQr({ groupId, groupName, locale, canManage = false, commandAction = groupReceptionQr }: {
 groupId: string; groupName: string; locale: SupportedLocale; canManage?: boolean;
 commandAction?: typeof groupReceptionQr;
}) {
 const c = copies[locale];
 const labels = buttons[locale];
 const titleId = useId();
 const lock = useRef(false);
 const dialog = useRef<HTMLDialogElement>(null);
 const [open, setOpen] = useState(false);
 const [busy, setBusy] = useState(false);
 const [result, setResult] = useState<Awaited<ReturnType<typeof groupReceptionQr>> | null>(null);
 const [confirmed, setConfirmed] = useState(false);
 useEffect(() => {
  if (!open || !dialog.current) return;
  const element = dialog.current;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const previousOverflow = document.body.style.overflow;
  element.showModal();
  element.querySelector<HTMLElement>("h2")?.focus();
  document.body.style.overflow = "hidden";
  return () => { element.close(); document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
 }, [open]);
 async function run(action: "get" | "revoke" | "renew") {
  if (lock.current || (action !== "get" && (!canManage || !confirmed))) return;
  lock.current = true; setBusy(true); setResult(null); setConfirmed(false);
  try { setResult(await commandAction(groupId, action)); } catch { setResult({ status: "unavailable" }); }
  finally { lock.current = false; setBusy(false); }
 }
 function close() { if (!lock.current) setOpen(false); }
 const failed = result?.status === "unavailable";
 return <>
  <button type="button" aria-haspopup="dialog" aria-label={`${labels[0]} · ${groupName}`}
   className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[var(--peace-border-strong)] px-3 py-2 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)] focus-visible:outline-2 focus-visible:outline-offset-2"
   onClick={() => { if (lock.current) return; setOpen(true); void run("get"); }}>
   <QrCode className="size-4" aria-hidden="true" />{labels[0]}
  </button>
  {open && <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }}
   className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-[var(--peace-border)] bg-white p-5 text-[var(--peace-ink)] shadow-2xl backdrop:bg-slate-950/65">
   <div className="mb-4 flex items-start justify-between gap-3">
    <h2 id={titleId} tabIndex={-1} className="min-w-0 break-words text-xl font-semibold outline-none">{groupName}</h2>
    <button type="button" className="btn-secondary min-h-11 shrink-0 px-3" disabled={busy} onClick={close}>{labels[1]}</button>
   </div>
   <section className="grid gap-3">
    <h3 className="font-semibold">{c[0]}</h3><p className="text-sm">{c[1]}</p>
    {busy && <p role="status">{c[9]}</p>}
    {result?.status === "active" && <>
     <Image unoptimized src={result.image} alt={`${c[0]} · ${groupName}`} width={256} height={256} className="mx-auto h-auto max-w-full" />
     <a className="btn-primary inline-flex min-h-11 items-center justify-center px-4" download={groupQrFilename(groupName)} href={result.image}>{c[3]}</a>
    </>}
    {result?.status === "revoked" && <p role="status">{c[6]}</p>}
    {failed && <><p role="alert">{c[7]}</p><ProgressButton progressError className="btn-secondary min-h-12 px-4" onClick={() => void run("get")}>{c[2]}</ProgressButton></>}
    {canManage && (result?.status === "active" || result?.status === "revoked") && <>
     <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />{c[8]}</label>
     <div className="flex flex-wrap gap-2">
      {result.status === "active" && <ProgressButton className="btn-secondary min-h-12 px-4" disabled={busy || !confirmed} onClick={() => void run("revoke")}>{c[4]}</ProgressButton>}
      <ProgressButton className="btn-secondary min-h-12 px-4" disabled={busy || !confirmed} onClick={() => void run("renew")}>{c[5]}</ProgressButton>
     </div>
    </>}
   </section>
  </dialog>}
 </>;
}

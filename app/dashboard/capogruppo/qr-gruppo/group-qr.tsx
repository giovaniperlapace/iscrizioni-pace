"use client";
import { ProgressButton } from "@/components/button-progress";
import Image from "next/image";
import { QrCode } from "lucide-react";
import { groupQrFilename } from "@/lib/qrcode/filename";
import { useEffect, useId, useRef, useState } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";
import { groupReceptionQr } from "./actions";
const copies = {
 it:["QR accoglienza del gruppo", "Comprende solo questo gruppo, senza sottogruppi. L’operatore confermerà chi è arrivato, minori inclusi.", "Mostra QR", "QR non disponibile. Riprova.", "Attendi…"],
 en:["Group reception QR", "Includes this group only, without subgroups. Staff will confirm who has arrived, including children.", "Show QR", "QR unavailable. Try again.", "Please wait…"],
 fr:["QR d’accueil du groupe", "Comprend uniquement ce groupe, sans sous-groupes. L’accueil confirmera les arrivées, enfants compris.", "Afficher le QR", "QR indisponible. Réessayez.", "Patientez…"],
 de:["Gruppen-QR für den Empfang", "Gilt nur für diese Gruppe, ohne Untergruppen. Der Empfang bestätigt die Anwesenden, einschließlich Kinder.", "QR anzeigen", "QR nicht verfügbar. Erneut versuchen.", "Bitte warten…"],
 es:["QR de recepción del grupo", "Incluye solo este grupo, sin subgrupos. El personal confirmará quién ha llegado, incluidos los menores.", "Mostrar QR", "QR no disponible. Inténtalo de nuevo.", "Espera…"],
 nl:["Groeps-QR voor ontvangst", "Alleen deze groep, zonder subgroepen. De ontvangst bevestigt wie is aangekomen, inclusief kinderen.", "QR tonen", "QR niet beschikbaar. Probeer opnieuw.", "Even geduld…"],
 uk:["QR групи для реєстрації прибуття", "Лише ця група, без підгруп. Працівник підтвердить, хто прибув, включно з дітьми.", "Показати QR", "QR недоступний. Спробуйте ще раз.", "Зачекайте…"],
} satisfies Record<SupportedLocale,string[]>;
const buttons = {
 it: ["QR del gruppo", "Chiudi", "Scarica QR"], en: ["Group QR", "Close", "Download QR"], fr: ["QR du groupe", "Fermer", "Télécharger le QR"],
 de: ["Gruppen-QR", "Schließen", "QR herunterladen"], es: ["QR del grupo", "Cerrar", "Descargar QR"], nl: ["Groeps-QR", "Sluiten", "QR downloaden"], uk: ["QR групи", "Закрити", "Завантажити QR"],
} satisfies Record<SupportedLocale, string[]>;

export function GroupReceptionQr({ groupId, groupName, locale, commandAction = groupReceptionQr }: {
 groupId: string; groupName: string; locale: SupportedLocale;
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
 async function run() {
  if (lock.current) return;
  lock.current = true; setBusy(true); setResult(null);
  try { setResult(await commandAction(groupId, "get")); } catch { setResult({ status: "unavailable" }); }
  finally { lock.current = false; setBusy(false); }
 }
 function close() { if (!lock.current) setOpen(false); }
 const failed = result !== null && result.status !== "active";
 return <>
  <ProgressButton type="button" disabled={busy} aria-busy={busy} progressError={failed} aria-haspopup="dialog" aria-label={`${labels[0]} · ${groupName}`}
   className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[var(--peace-border-strong)] px-3 py-2 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)] focus-visible:outline-2 focus-visible:outline-offset-2"
   onClick={() => { if (lock.current) return; setOpen(true); void run(); }}>
   <QrCode className="size-4" aria-hidden="true" />{labels[0]}
  </ProgressButton>
  {open && <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }}
   className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-[var(--peace-border)] bg-white p-5 text-[var(--peace-ink)] shadow-2xl backdrop:bg-slate-950/65">
   <div className="mb-4 flex items-start justify-between gap-3">
    <h2 id={titleId} tabIndex={-1} className="min-w-0 break-words text-xl font-semibold outline-none">{groupName}</h2>
    <button type="button" className="btn-secondary min-h-11 shrink-0 px-3" disabled={busy} onClick={close}>{labels[1]}</button>
   </div>
   <section className="grid gap-3">
    <h3 className="font-semibold">{c[0]}</h3><p className="text-sm">{c[1]}</p>
    {busy && <p role="status">{c[4]}</p>}
    {result?.status === "active" && <>
     <Image unoptimized src={result.image} alt={`${c[0]} · ${groupName}`} width={256} height={256} className="mx-auto h-auto max-w-full" />
     <a className="btn-primary inline-flex min-h-11 items-center justify-center px-4" download={groupQrFilename(groupName)} href={result.image}>{labels[2]}</a>
    </>}
    {failed && <><p role="alert">{c[3]}</p><ProgressButton type="button" progressError aria-busy={busy} disabled={busy} className="btn-secondary min-h-12 px-4" onClick={() => void run()}>{c[2]}</ProgressButton></>}
   </section>
  </dialog>}
 </>;
}

"use client";
import { ProgressButton } from "@/components/button-progress";
import Image from "next/image";
import { LoaderCircle, QrCode } from "lucide-react";
import { groupQrFilename } from "@/lib/qrcode/filename";
import { useEffect, useId, useRef, useState } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";
import type { groupReceptionQr } from "./actions";
import { QrLabelPanel } from "../../qr-label-panel";
import { qrLabelCommand } from "../../participants/qr/labels/actions";
import type { LabelCommand, LabelResult } from "@/lib/reception/qr-labels";

async function groupLabelCommand(input: LabelCommand, signal?: AbortSignal): Promise<LabelResult> {
 if (input.action !== "read") return qrLabelCommand(input);
 const response = await fetch("/dashboard/groups/qr", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ groupId: input.groupId, kind: "labels" }), cache: "no-store", signal: signal ?? AbortSignal.timeout(25_000),
 });
 if (!response.ok) throw new Error("Labels unavailable");
 return response.json();
}
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

async function loadGroupQr(groupId: string, signal: AbortSignal): Promise<Awaited<ReturnType<typeof groupReceptionQr>>> {
 const response = await fetch("/dashboard/groups/qr", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ groupId }), cache: "no-store", signal,
 });
 if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Group QR unavailable");
 return response.json();
}

export function GroupReceptionQr({ groupId, groupName, locale, commandAction, allowPrinting = false }: {
 groupId: string; groupName: string; locale: SupportedLocale;
 allowPrinting?: boolean;
 commandAction?: typeof groupReceptionQr;
}) {
 const c = copies[locale];
 const labels = buttons[locale];
 const titleId = useId();
 const lock = useRef(false);
 const request = useRef<AbortController | null>(null);
 useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
 const dialog = useRef<HTMLDialogElement>(null);
 const [open, setOpen] = useState(false);
 const [busy, setBusy] = useState(false);
 const [printBusy, setPrintBusy] = useState(false);
 const [labelResult, setLabelResult] = useState<LabelResult>();
 const [result, setResult] = useState<Awaited<ReturnType<typeof groupReceptionQr>> | null>(null);
 useEffect(() => {
  if (!open || !dialog.current) return;
  const element = dialog.current;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const previousOverflow = document.body.style.overflow;
  element.showModal();
  element.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  document.body.style.overflow = "hidden";
  return () => { element.close(); document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
 }, [open]);
 async function run() {
  if (lock.current) return;
  lock.current = true; setBusy(true); setResult(null); setLabelResult(undefined);
  const controller = new AbortController();
  request.current = controller;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
   const prepared = await Promise.race([
    (async () => {
     const qrPromise = (commandAction ? commandAction(groupId, "get") : loadGroupQr(groupId, controller.signal));
     const [qr, queue] = await Promise.all([qrPromise, allowPrinting ? groupLabelCommand({ groupId, action: "read" }, controller.signal).catch(() => ({ status: "unavailable" } as const)) : undefined]);
     if (qr.status === "active") {
      const image = new window.Image();
      image.src = qr.image;
      await image.decode();
     }
     return { qr, queue };
    })(),
    new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Group QR timeout")); }, 25_000); }),
   ]);
   if (request.current === controller) { setResult(prepared.qr); setLabelResult(prepared.queue); }
  } catch { if (request.current === controller) { setResult({ status: "unavailable" }); setLabelResult({ status: "unavailable" }); } }
  finally {
   clearTimeout(timer);
   if (request.current === controller) { request.current = null; lock.current = false; setBusy(false); }
  }
 }
 function close() { if (!lock.current && !printBusy) setOpen(false); }
 const failed = result !== null && result.status !== "active";
 return <>
  <ProgressButton type="button" disabled={busy} aria-busy={busy} progressError={failed} aria-haspopup="dialog" aria-label={`${labels[0]} · ${groupName}`}
   className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[var(--peace-border-strong)] px-3 py-2 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)] focus-visible:outline-2 focus-visible:outline-offset-2"
   onClick={() => { if (lock.current) return; setOpen(true); void run(); }}>
   <QrCode className="size-4" aria-hidden="true" />{labels[0]}
  </ProgressButton>
  {open && <dialog ref={dialog} aria-labelledby={titleId} aria-busy={busy || printBusy} onChange={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); close(); }}
   className="fixed inset-0 m-auto h-[min(40rem,90dvh)] w-[calc(100%-2rem)] max-w-lg overflow-hidden open:flex open:flex-col rounded-xl border border-[var(--peace-border)] bg-white p-0 text-[var(--peace-ink)] shadow-2xl backdrop:bg-slate-950/65">
   <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-4 pt-5">
    <h2 id={titleId} tabIndex={-1} className="min-w-0 break-words text-xl font-semibold outline-none">{groupName}</h2>
    <button type="button" className="btn-secondary min-h-11 shrink-0 px-3" disabled={busy || printBusy} onClick={close}>{labels[1]}</button>
   </div>
   {busy ? <div className="grid min-h-0 flex-1 place-content-center p-5"><p role="status" className="flex items-center gap-2"><LoaderCircle className="size-5 animate-spin" aria-hidden="true" />{c[4]}</p></div> :
   <section className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto overscroll-contain px-5 pb-5 [scrollbar-gutter:stable]">
    <h3 className="font-semibold">{c[0]}</h3><p className="text-sm">{c[1]}</p>
    {result?.status === "active" && <>
     <Image unoptimized src={result.image} alt={`${c[0]} · ${groupName}`} width={256} height={256} className="mx-auto h-auto max-w-full" />
     <a className="btn-primary inline-flex min-h-11 items-center justify-center px-4" download={groupQrFilename(groupName)} href={result.image}>{labels[2]}</a>
    </>}
    {failed && <><p role="alert">{c[3]}</p><ProgressButton type="button" progressError aria-busy={busy} disabled={busy || printBusy} className="btn-secondary min-h-12 px-4" onClick={() => void run()}>{c[2]}</ProgressButton></>}
    {allowPrinting && labelResult && <section className="mt-4 grid gap-3 border-t border-[var(--peace-border)] pt-5" aria-label="QR dei partecipanti">
     <h3 className="font-semibold">QR dei partecipanti</h3>
     <p className="text-sm">Seleziona le persone di cui stampare il QR personale. La stampa non conferma la presenza.</p>
     <QrLabelPanel scope={{ groupId }} initialResult={labelResult} selectInitially={false} commandAction={groupLabelCommand} onBusyChange={setPrintBusy} />
    </section>}
   </section>}
  </dialog>}
 </>;
}

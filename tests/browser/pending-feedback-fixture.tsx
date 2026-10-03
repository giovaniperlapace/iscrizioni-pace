"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ProgressButton } from "@/components/button-progress";
import { EventServiceActiveSwitch } from "@/app/dashboard/event-service-active-switch";
import { GroupPublicCatalogSwitch } from "@/app/dashboard/group-public-catalog-switch";
import Link from "@/components/pending-link";
import { PendingDownload } from "@/components/pending-download";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ReliableForm } from "@/components/reliable-form";
import { WorkStatusProvider } from "@/components/work-status";
import { AutoFilterForm } from "@/app/dashboard/auto-filter-form";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n/config";

const delay = () => new Promise<void>(resolve => setTimeout(resolve, 4000));
export default function Fixture({ section, extended = false }: { section: string; extended?: boolean }) {
  const [locale, setLocale] = useState<SupportedLocale>("it");
  const [saved, setSaved] = useState(0);
  const [held, setHeld] = useState(false);
  const [heldError, setHeldError] = useState(false);
  const [portal, setPortal] = useState(false);
  const prefix = `/pending-feedback-check?${extended ? "extended=1&" : ""}`;
  return <WorkStatusProvider locale={locale}>
    <main className="mx-auto grid max-w-2xl gap-6 p-5">
      <h1 className="text-2xl font-bold">Attesa operazioni</h1>
      <select aria-label="Lingua indicatore" value={locale} onChange={event => setLocale(event.target.value as SupportedLocale)}>
        {SUPPORTED_LOCALES.map(value => <option key={value}>{value}</option>)}
      </select>
      <nav className="flex flex-wrap gap-3">
        <Link data-statistics href={`${prefix}section=statistics`} prefetch={false} className="btn-primary">Statistiche</Link>
        <Link data-groups href={`${prefix}section=groups`} prefetch={false} className="btn-secondary">Gruppi</Link>
        <Link data-hash href="#details" className="underline">Vai ai dettagli</Link>
        <Link data-cancel href="/pending-feedback-check?section=cancel" onClick={event => event.preventDefault()}>Annulla navigazione</Link>
      </nav>
      <p data-section>{section}</p>
      <ReliableForm action={async () => { await delay(); setSaved(value => value + 1); }}>
        <input aria-label="Nome" name="name" required className="border" />
        <PendingSubmitButton data-save className="btn-primary">Salva</PendingSubmitButton>
      </ReliableForm>
      <ReliableForm action={async () => { await delay(); throw new Error("Synthetic failure"); }}>
        <PendingSubmitButton data-fail className="btn-secondary">Prova errore</PendingSubmitButton>
      </ReliableForm>
      <form action={async () => { await delay(); setSaved(value => value + 1); }}>
        <PendingSubmitButton data-native className="btn-secondary">Invia modulo</PendingSubmitButton>
      </form>
      <p data-saved>{saved}</p>
      <AutoFilterForm action="/pending-feedback-check" blockWhilePending={false} debounceMs={200}>
        <input aria-label="Ricerca" name="q" className="border" />
      </AutoFilterForm>
      <PendingDownload data-download href="/pending-download-check" filename="prova.xlsx" className="btn-secondary">Esporta iscritti</PendingDownload>
      <PendingDownload data-download-error href="/pending-download-check?error=1" filename="prova.xlsx" className="btn-secondary">Prova errore download</PendingDownload>
      <ReliableForm id="switch-service" action={async () => { await delay(); throw new Error("Synthetic failure"); }} />
      <EventServiceActiveSwitch formId="switch-service" isActive serviceLabel="Servizio prova" />
      <ReliableForm id="switch-group" action={async () => { await delay(); }} />
      <GroupPublicCatalogSwitch formId="switch-group" isPublicCatalog groupName="Gruppo prova" />
      {extended ? <>
        <ProgressButton data-held aria-busy={held} disabled={held} progressError={heldError} className="btn-primary px-4" onClick={() => { setHeldError(false); setHeld(true); }}>Attesa controllata</ProgressButton>
        <button data-resolve onClick={() => setHeld(false)}>Concludi operazione</button>
        <button data-reject onClick={() => { setHeldError(true); setHeld(false); }}>Interrompi con errore</button>
        <button data-open-portal onClick={() => setPortal(true)}>Apri modale</button>
        {portal ? createPortal(<div role="dialog" aria-label="Prova modale" className="fixed inset-12 z-50 bg-white p-6">
          <ReliableForm action={async () => { await delay(); }}><PendingSubmitButton data-portal-save className="btn-primary px-4">Salva nella modale</PendingSubmitButton></ReliableForm>
          <button data-close-portal onClick={() => setPortal(false)}>Chiudi modale</button>
        </div>, document.body) : null}
        <Link data-leave href="/pending-feedback-check" prefetch={false}>Vai a un’altra pagina</Link>
      </> : null}
      <p id="details">Dettagli</p>
    </main>
  </WorkStatusProvider>;
}

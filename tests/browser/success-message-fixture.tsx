"use client";
import { useState } from "react";
import { SuccessMessage } from "@/components/success-message";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n/config";
export default function Fixture() {
  const [version, setVersion] = useState(1);
  const [locale, setLocale] = useState<SupportedLocale>("it");
  return <main className="mx-auto grid max-w-xl gap-4 p-5">
    <h1>Conferma aggiornamento</h1>
    <select aria-label="Lingua del messaggio" value={locale} onChange={event => setLocale(event.target.value as SupportedLocale)}>
      {SUPPORTED_LOCALES.map(value => <option key={value}>{value}</option>)}
    </select>
    <button data-update type="button" onClick={() => setVersion(value => value + 1)}>Nuovo aggiornamento</button>
    <SuccessMessage key={version} locale={locale} clearQuery className="status-success rounded-md border p-4">Modifiche salvate.</SuccessMessage>
    <p role="alert">Errore da correggere.</p>
    <p data-instructions>Controlla la prova prima di confermare l’invio.</p>
  </main>;
}

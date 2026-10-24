"use client";
import { useEffect, useState } from "react";
import { compareForums } from "@/lib/panels/forum-order";
import { dutySummary, type DutyOption } from "@/lib/reception/event-duties";
export function ReceptionDutyFields({ initial, editing = false }: { initial?: string[]; editing?: boolean }) {
  const [choices, setChoices] = useState<DutyOption[]>([]);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    let current = true;
    fetch("/api/reception-duties", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!Array.isArray(data.choices)) throw new Error();
      if (current) setChoices(data.choices.sort(compareForums));
    }).catch(() => { if (current) setError(true); }).finally(() => clearTimeout(timer));
    return () => { current = false; controller.abort(); clearTimeout(timer); };
  }, [attempt]);
  return <fieldset className="grid gap-3 lg:col-span-3">
    <legend className="font-semibold">Incarichi · Forum e cerimonie</legend>
    <input type="hidden" name="dutySummary" value={dutySummary(choices.map(item => item.key), choices)} />
    {editing && <input type="hidden" name="expectedDuties" value={JSON.stringify(initial ?? [])} />}
    {error ? <p role="alert">Impossibile caricare gli incarichi. <button type="button" className="underline" onClick={() => { setError(false); setAttempt(attempt + 1); }}>Riprova</button></p> : !choices.length ? <p role="status">Caricamento incarichi…</p> : <>
      <p className="text-sm">Tutti gli incarichi sono inclusi: Forum, inaugurazione e cerimonia finale. L’operatore sceglie l’incarico nella propria dashboard.</p>
      {choices.map(item => <input key={item.key} type="hidden" name="dutyKeys" value={item.key} />)}
    </>}
    <input className="sr-only" aria-label="Caricamento incarichi" tabIndex={-1} required value={choices.length ? "selected" : ""} onChange={() => {}} />
  </fieldset>;
}

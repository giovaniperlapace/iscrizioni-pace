"use client";
import { useEffect, useState } from "react";
import { compareForums } from "@/lib/panels/forum-order";
import { dutySummary, type DutyOption } from "@/lib/reception/event-duties";
export function ReceptionDutyFields({ initial, editing = false }: { initial?: string[]; editing?: boolean }) {
  const [choices, setChoices] = useState<DutyOption[]>([]);
  const [selected, setSelected] = useState(() => new Set(initial ?? []));
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
    <input type="hidden" name="dutySummary" value={dutySummary([...selected], choices)} />
    {editing && <input type="hidden" name="expectedDuties" value={JSON.stringify(initial ?? [])} />}
    {error ? <p role="alert">Impossibile caricare gli incarichi. <button type="button" className="underline" onClick={() => { setError(false); setAttempt(attempt + 1); }}>Riprova</button></p> : !choices.length ? <p role="status">Caricamento incarichi…</p> : <>
      <label className="flex min-h-11 items-center gap-3 font-semibold"><input type="checkbox" checked={choices.every(item => selected.has(item.key))} onChange={event => setSelected(new Set(event.target.checked ? choices.map(item => item.key) : []))} />Seleziona tutto</label>
      <div className="grid max-h-72 gap-1 overflow-y-auto rounded-lg border p-3">{choices.map(item => <label key={item.key} className="flex min-h-11 items-start gap-3 py-2"><input className="mt-1" type="checkbox" name="dutyKeys" value={item.key} checked={selected.has(item.key)} onChange={event => setSelected(old => { const next = new Set(old); if (event.target.checked) next.add(item.key); else next.delete(item.key); return next; })} /><span>{item.title}{item.room && <small className="block text-slate-600">{item.room}</small>}</span></label>)}</div>
      <p className="text-sm">{selected.size} incarichi selezionati. Selezionane almeno uno. I nuovi Forum aggiunti in seguito richiederanno una nuova assegnazione.</p>
    </>}
    <input className="sr-only" aria-label="Seleziona almeno un incarico" tabIndex={-1} required value={choices.length && selected.size ? "selected" : ""} onChange={() => {}} />
  </fieldset>;
}

"use client";

import { useRef, useState } from "react";
import { SuccessMessage } from "@/components/success-message";
import type { ReceptionCommand, ReceptionLookup, ReceptionResult } from "@/lib/reception/contracts";

type Verified = Extract<ReceptionResult, { status: "valid" }>;
const errors = {
  invalid: "Codice non valido o iscrizione non disponibile per questo evento.",
  forbidden: "Accesso non autorizzato. Verifica la sessione e il tuo incarico nell’evento.",
  invalid_request: "Controlla il codice, le persone selezionate e le quantità inserite.",
  conflict: "Un altro operatore ha aggiornato le presenze. Verifica di nuovo prima di correggerle.",
  unavailable: "Non è stato possibile verificare l’esito. Riprova la stessa operazione.",
};
const labels = { enter: "Registra ingresso", correct: "Correggi presenze", cancel: "Annulla ingresso" };
const date = (value: string) => new Intl.DateTimeFormat("it-IT", { dateStyle:"short", timeStyle:"short", timeZone:"Europe/Rome" }).format(new Date(value));

export function ReceptionConsole({ commandAction }: {
  commandAction: (command: ReceptionCommand) => Promise<ReceptionResult>;
}) {
  const [kind,setKind] = useState<ReceptionLookup["kind"]>("code");
  const [value,setValue] = useState("");
  const [verified,setVerified] = useState<Verified | null>(null);
  const [selected,setSelected] = useState<string[]>([]);
  const [students,setStudents] = useState("");
  const [companions,setCompanions] = useState("");
  const [action,setAction] = useState<"enter" | "correct" | "cancel">("enter");
  const [confirmed,setConfirmed] = useState(false);
  const [pending,setPending] = useState(false);
  const [error,setError] = useState("");
  const [stale,setStale] = useState(false);
  const [retry,setRetry] = useState<ReceptionCommand | null>(null);
  const [success,setSuccess] = useState<{key:number;text:string} | null>(null);
  const busy = useRef(false);

  function resetResult() {
    setVerified(null);setError("");setSuccess(null);setStale(false);setConfirmed(false);
  }
  async function run(command: ReceptionCommand) {
    if (busy.current) return;
    busy.current=true;setPending(true);setError("");setSuccess(null);
    let response: ReceptionResult;
    try { response=await commandAction(command); } catch { response={status:"unavailable"}; }
    busy.current=false;setPending(false);
    if (response.status !== "valid") {
      setError(errors[response.status]);
      setRetry(response.status === "unavailable" && command.action !== "inspect" ? command : null);
      if (command.action === "inspect") setVerified(null);
      else setStale(response.status !== "invalid_request");
      return;
    }
    setVerified(response);setRetry(null);setStale(false);setConfirmed(false);setAction("enter");
    if (response.kind === "family") setSelected(response.persons.filter(p=>!!p.checkedInAt).map(p=>p.id));
    else {
      setStudents(response.checkedInAt ? String(response.students) : "");
      setCompanions(response.checkedInAt ? String(response.companions) : "");
    }
    if (command.action !== "inspect") setSuccess({key:Date.now(),text:
      response.outcome === "unchanged" ? "Presenze già registrate: nessuna modifica." :
      response.outcome === "replayed" ? "Operazione già elaborata. Sono mostrate le presenze correnti." : "Presenze aggiornate."});
  }

  return <section className="surface-card grid gap-5 p-5 sm:p-7" aria-labelledby="reception-title">
    <div className="grid gap-2">
      <h2 id="reception-title" className="text-xl font-semibold">Verifica e registra l’ingresso</h2>
      <p className="text-sm text-[var(--peace-muted)]">Cerca il codice del partecipante oppure incolla il contenuto del QR. Dopo la verifica, indica chi è realmente presente.</p>
    </div>
    <form className="grid gap-3" onSubmit={event=>{event.preventDefault();void run({lookup:{kind,value},action:"inspect"});}}>
      <fieldset disabled={pending || !!retry} className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
        <label className="grid gap-1 text-sm">Tipo di codice
          <select name="lookupKind" className="field" value={kind} onChange={event=>{setKind(event.target.value as ReceptionLookup["kind"]);setValue("");resetResult();}}>
            <option value="code">Codice partecipante</option><option value="qr">Contenuto del QR</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm">{kind === "code" ? "Codice partecipante" : "Contenuto del QR"}
          <input className="field min-w-0" type={kind === "qr" ? "password" : "text"} autoComplete="off" spellCheck={false}
            autoCapitalize={kind === "code" ? "characters" : "none"} required maxLength={kind === "code" ? 4 : 43}
            value={value} onChange={event=>{setValue(event.target.value);resetResult();}} />
        </label>
        <button className="btn-primary px-4" type="submit" aria-busy={pending}>Verifica codice</button>
      </fieldset>
    </form>
    {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    {retry && <button className="btn-primary px-4 justify-self-start" disabled={pending} aria-busy={pending}
      onClick={()=>void run(retry)}>Riprova la stessa operazione</button>}
    {success && <SuccessMessage key={success.key} className="rounded-xl bg-green-50 p-3 text-green-900">{success.text}</SuccessMessage>}
    {verified && <form className="grid gap-4 border-t border-[var(--peace-border)] pt-4" onSubmit={event=>{
      event.preventDefault();
      if (pending || stale || retry || (action !== "enter" && !confirmed)) return;
      const command: ReceptionCommand = {
        lookup:{kind,value},action,requestId:crypto.randomUUID(),
        ...(verified.kind === "family" ? {subjectIds:selected} : action === "cancel" ? {} : {students:Number(students),companions:Number(companions)}),
        ...(action === "enter" ? {} : {expectedRevision:verified.revision,reason:action === "cancel" ? "entry_cancelled" : verified.kind === "family" ? "selection_error" : "count_error"}),
      };
      void run(command);
    }}>
      <div className="text-sm" role="status">
        <strong>{verified.kind === "family" ? `Codice ${verified.code}` : `${verified.schoolName} · ${verified.classDescription}`}</strong>
        <span className="ml-2">Iscrizione valida</span>
      </div>
      <fieldset disabled={pending || stale || !!retry} className="grid gap-4">
        <label className="grid gap-1 text-sm sm:max-w-xs">Operazione
          <select name="operation" className="field" value={action} onChange={event=>{setAction(event.target.value as typeof action);setConfirmed(false);}}>
            <option value="enter">Registra ingresso</option><option value="correct">Correggi presenze</option><option value="cancel">Annulla ingresso</option>
          </select>
        </label>
        {verified.kind === "family" ? <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">{action === "cancel" ? "Seleziona gli ingressi da annullare" : "Seleziona le persone presenti"}</legend>
          {verified.persons.map(person=><label key={person.id} className="flex min-h-14 items-center gap-3 rounded-xl border border-[var(--peace-border)] p-3">
            <input type="checkbox" name="presentSubjects" value={person.id} className="h-5 w-5 shrink-0" checked={selected.includes(person.id)}
              onChange={event=>{setSelected(ids=>event.target.checked ? [...ids,person.id] : ids.filter(id=>id!==person.id));setConfirmed(false);}} />
            <span className="min-w-0 break-words"><span className="font-medium">{person.firstName} {person.lastName}</span>
              {person.kind === "child" && <span className="ml-2 text-sm">Minore</span>}
              <span className="block text-sm text-[var(--peace-muted)]">{person.checkedInAt ? `Presente dal ${date(person.checkedInAt)}` : "Ingresso non registrato"}</span>
            </span>
          </label>)}
          {action === "correct" && <p className="text-sm">Le persone deselezionate risulteranno assenti.</p>}
        </fieldset> : <div className="grid gap-3">
          <p className="text-sm">Previsti: {verified.expectedStudents} studenti e {verified.expectedCompanions} accompagnatori.</p>
          <p className="text-sm">{verified.checkedInAt ? `Ingresso registrato il ${date(verified.checkedInAt)}: ${verified.students} studenti e ${verified.companions} accompagnatori.` : "Ingresso non registrato."}</p>
          {action !== "cancel" && <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">Studenti presenti<input className="field" type="number" name="students" min={0} max={verified.expectedStudents} step={1} required value={students} onChange={event=>{setStudents(event.target.value);setConfirmed(false);}} /></label>
            <label className="grid gap-1 text-sm">Accompagnatori presenti<input className="field" type="number" name="companions" min={0} max={verified.expectedCompanions} step={1} required value={companions} onChange={event=>{setCompanions(event.target.value);setConfirmed(false);}} /></label>
          </div>}
        </div>}
        {action !== "enter" && <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="confirmCorrection" className="h-5 w-5" required checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} />Confermo {action === "cancel" ? "l’annullamento degli ingressi indicati" : "la correzione delle presenze indicate"}.</label>}
        <button className="btn-primary px-4 justify-self-start" type="submit" aria-busy={pending}
          disabled={(verified.kind === "family" && selected.length===0) || (action !== "enter" && !confirmed)}>{labels[action]}</button>
      </fieldset>
    </form>}
  </section>;
}

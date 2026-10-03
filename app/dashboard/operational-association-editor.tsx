"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOperationalAssociation, updateOperationalAssociation } from "./operational-registration-actions";
import { ReliableForm } from "@/components/reliable-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { SuccessMessage } from "@/components/success-message";

type Snapshot = { association: string | null; questionnaireId: string | null };
export function OperationalAssociationEditor({ registrationId }: { registrationId: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState(0);
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    getOperationalAssociation(registrationId).then(result => {
      if (cancelled) return;
      if (result.status === "success") setSnapshot(result.snapshot);
      else setFailed(true);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [registrationId, attempt]);
  return <section className="grid gap-3 text-sm">
    <h4 className="font-semibold">Associazione / organizzazione</h4>
    <p className="text-[var(--peace-muted)]">Nome dichiarato nell’iscrizione. La modifica non cambia il gruppo assegnato né la partecipazione con Sant’Egidio.</p>
    {!snapshot ? failed ? <div role="alert">Impossibile caricare l’associazione. <button type="button" className="min-h-11 underline" onClick={() => { setFailed(false); setAttempt(n => n + 1); }}>Riprova</button></div> : <p role="status">Caricamento…</p> :
      <ReliableForm key={JSON.stringify(snapshot)} className="grid gap-3" data-preserve-dashboard-scroll action={async form => {
        const result = await updateOperationalAssociation(form);
        if (result.status === "success") { setSnapshot(result.snapshot); setSaved(n => n + 1); router.refresh(); }
        return result;
      }}>
        <input type="hidden" name="registrationId" value={registrationId} />
        <input type="hidden" name="expected" value={JSON.stringify(snapshot)} />
        <label className="grid gap-1 font-semibold">Nome dell’associazione o organizzazione
          <input name="association" defaultValue={snapshot.association ?? ""} maxLength={200} className="field bg-white font-normal" />
          <span className="text-xs font-normal text-[var(--peace-muted)]">Lascia vuoto per rimuovere il dato.</span>
        </label>
        <PendingSubmitButton className="min-h-11 w-fit rounded-md bg-[var(--peace-blue-800)] px-4 font-semibold text-white">Salva associazione</PendingSubmitButton>
      </ReliableForm>}
    {saved > 0 ? <SuccessMessage key={saved}>Associazione aggiornata.</SuccessMessage> : null}
  </section>;
}

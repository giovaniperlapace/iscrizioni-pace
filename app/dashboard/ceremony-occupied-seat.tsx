"use client";
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { RevokeSeat } from '@/lib/ceremonies/assignment-history';
export function CeremonyOccupiedSeat({ label, person, group, canAssign, command, revoke, select, close, changed }: {
  label: string; person?: string; group?: string | null; canAssign: boolean; command: RevokeSeat;
  revoke: (command: RevokeSeat) => Promise<{status:string}>; select: () => void; close: () => void; changed: () => void;
}) {
  const ref=useRef<HTMLDialogElement>(null), router=useRouter();
  const [confirm,setConfirm]=useState(false), [message,setMessage]=useState(''), [pending,transition]=useTransition();
  const [conflict,setConflict]=useState(false);
  useEffect(() => {
    const dialog=ref.current!, previous=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow=document.body.style.overflow;
    dialog.showModal();document.body.style.overflow='hidden';
    return () => {dialog.close();document.body.style.overflow=overflow;previous?.focus({preventScroll:true});};
  }, []);
  function submit() {
    transition(async () => {
      try {
        const result=await revoke(command);
        if(result.status==='saved'){changed();close();router.refresh();}
        else if(result.status==='conflict'){setConflict(true);setMessage('Il posto è cambiato. Chiudi e riaprilo dalla piantina aggiornata.');router.refresh();}
        else if(result.status==='nominees_active'){setConflict(true);setMessage('Altre nomine della delegazione dipendono da questa riserva. Gestisci la revoca dalla cronologia per verificare tutte le persone coinvolte.');}
        else if(result.status==='forbidden'){setConflict(true);setMessage('Non sei più autorizzato a gestire i posti.');}
        else setMessage('Esito non verificabile. Riprova: la stessa richiesta non sarà duplicata.');
      } catch {setMessage('Esito non verificabile. Riprova: la stessa richiesta non sarà duplicata.');}
    });
  }
  return <dialog ref={ref} aria-labelledby="occupied-seat-title" onCancel={e=>{e.preventDefault();if(!pending)close();}} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-[var(--peace-border)] bg-white p-5 text-[var(--peace-text)] shadow-xl backdrop:bg-black/40">
    <div className="space-y-4"><h2 id="occupied-seat-title" className="text-lg font-semibold">Posto occupato</h2><p className="font-semibold">{label}</p>
      {person && <p>Assegnato a: <strong>{person}</strong></p>}{group && <p>Delegazione: <strong>{group}</strong></p>}
      {message && <p role="status">{message}</p>}
      {confirm && !conflict && <p>Confermi di liberare questo posto?{person ? ` L’assegnazione di ${person} sarà revocata.` : ''}{group ? ' La riserva della delegazione diminuirà di un posto. Gli altri posti resteranno assegnati.' : ' Il posto tornerà disponibile.'} La revoca resterà nella cronologia.</p>}
      <div className="flex flex-wrap gap-3">{!conflict && (confirm ? <button type="button" className="btn-primary px-4 py-2" disabled={pending} onClick={submit}>{pending?'Revoca in corso…':'Conferma revoca del posto'}</button> : <><button type="button" className="btn-secondary px-4 py-2" disabled={pending} onClick={()=>setConfirm(true)}>Libera questo posto</button>{canAssign && <button type="button" className="btn-primary px-4 py-2" disabled={pending} onClick={()=>{select();close();}}>Seleziona per assegnare a un membro</button>}</>)}<button type="button" className="btn-secondary px-4 py-2" disabled={pending} onClick={close}>{confirm?'Annulla':'Chiudi'}</button></div>
    </div>
  </dialog>;
}

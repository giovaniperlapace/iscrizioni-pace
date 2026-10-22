"use client";
import { useEffect, useEffectEvent, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ceremonySeatLabel } from '@/lib/ceremonies/seat-label';
import type { AssignmentEntry, AssignmentHistory, HistoryQuery, HistoryResult, RevokeAssignment } from '@/lib/ceremonies/assignment-history';
const date = (value: string) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Rome' }).format(new Date(value));
function Places({ entry }: { entry: AssignmentEntry }) {
  return <><p>Settore {entry.sector} · {entry.quantity === 0 ? 'Senza sedia' : `${entry.quantity} ${entry.quantity === 1 ? 'posto' : 'posti'}`}{!entry.numbered && entry.quantity > 0 ? ' senza sedia numerata' : ''}</p>{entry.seats.length > 0 && <details><summary className="cursor-pointer underline">Mostra i posti ({entry.seats.length})</summary><ul className="max-h-64 overflow-y-auto space-y-1 py-2 text-sm">{entry.seats.map(s => <li key={s.id}>{ceremonySeatLabel(entry.sector,s)}</li>)}</ul></details>}</>;
}
export function CeremonyAssignmentHistory({ planId, refreshKey, load, revoke }: {
  planId: string; refreshKey: number; load: (query: HistoryQuery) => Promise<HistoryResult>; revoke: (command: RevokeAssignment) => Promise<{ status: string }>;
}) {
  const router = useRouter();
  const [open,setOpen] = useState(false), [search,setSearch] = useState(''), [state,setState] = useState<HistoryQuery['state']>('all');
  const [query,setQuery] = useState<HistoryQuery>({planId,page:1,search:'',state:'all'});
  const [history,setHistory] = useState<AssignmentHistory | null>(null), [loading,setLoading] = useState(false), [error,setError] = useState('');
  const [refresh,setRefresh] = useState(0), [message,setMessage] = useState(''), [pending,startTransition] = useTransition();
  const [confirmation,setConfirmation] = useState<{ entry: AssignmentEntry; command: RevokeAssignment } | null>(null);
  const readHistory = useEffectEvent((q: HistoryQuery) => load(q));
  useEffect(() => {
    if (!open) return;
    let active = true;
    // Start from a promise so changing filters never displays an old result as new.
    Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true); setError(''); setConfirmation(null);
      try {
        const result = await readHistory(query);
        if (!active) return;
        setHistory(result.status === 'loaded' && result.history ? result.history : null);
        if (result.status !== 'loaded' || !result.history) setError(result.status === 'forbidden' ? 'Non sei più autorizzato a consultare le assegnazioni.' : 'Impossibile caricare la cronologia. Riprova.');
      } catch { if (active) {setHistory(null);setError('Impossibile caricare la cronologia. Riprova.');} }
      finally { if (active) setLoading(false); }
    });
    return () => { active = false; };
  }, [open,query,refreshKey,refresh]);
  function submit() {
    if (!confirmation || pending) return;
    startTransition(async () => {
      try {
        const result = await revoke(confirmation.command);
        if (result.status === 'saved') {setConfirmation(null);setMessage('Assegnazione revocata.');setRefresh(v => v+1);router.refresh();}
        else if (result.status === 'conflict') {setConfirmation(null);setMessage('Le assegnazioni sono cambiate. Premi «Aggiorna cronologia» e conferma nuovamente.');router.refresh();}
        else if (result.status === 'forbidden') {setConfirmation(null);setHistory(null);setMessage('Non sei più autorizzato a revocare assegnazioni.');}
        else setMessage('Esito non verificabile. Riprova la stessa revoca: non sarà duplicata.');
      } catch {setMessage('Esito non verificabile. Riprova la stessa revoca: non sarà duplicata.');}
    });
  }
  return <section id="cronologia-assegnazioni" className="surface-card min-w-0 scroll-mt-24 space-y-4 p-4 sm:p-5" aria-label="Cronologia assegnazioni">
    <h2 className="text-lg font-semibold">Cronologia assegnazioni</h2>
    <p className="text-sm">Assegnazioni attive e revocate, dalla più recente. Le riserve di una delegazione riuniscono le aggiunte nello stesso settore; le nomine delle persone sono elencate separatamente.</p>
    <button type="button" className="btn-secondary px-4 py-2" disabled={pending} aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? 'Nascondi cronologia' : 'Mostra cronologia'}</button>
    {open && <div className="space-y-4" aria-busy={loading || pending}>
      <form className="grid gap-3 sm:flex sm:flex-wrap sm:items-end" onSubmit={e => {e.preventDefault();setConfirmation(null);setQuery({planId,page:1,search,state});}}>
        <label className="grid min-w-0 gap-1 sm:flex-1">Cerca nella cronologia<input type="search" className="field" maxLength={200} value={search} disabled={pending} onChange={e => setSearch(e.target.value)}/></label>
        <label className="grid gap-1">Stato assegnazione<select aria-label="Stato assegnazione" className="field" value={state} disabled={pending} onChange={e => setState(e.target.value as HistoryQuery['state'])}><option value="all">Tutte</option><option value="active">Attive</option><option value="revoked">Revocate</option></select></label>
        <button className="btn-primary px-4 py-2" disabled={pending}>Applica</button>
        <button type="button" className="btn-secondary px-4 py-2" disabled={pending || loading} onClick={() => setRefresh(v => v+1)}>Aggiorna cronologia</button>
      </form>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">Caricamento cronologia…</p> : history && <>
        <nav aria-label="Pagine cronologia" className="flex flex-wrap items-center gap-3 text-sm"><span>{history.total} {history.total === 1 ? 'assegnazione' : 'assegnazioni'} · Pagina {history.page} di {history.pageCount}</span><button type="button" className="btn-secondary px-3 py-2" disabled={pending || history.page <= 1} onClick={() => setQuery({...query,page:history.page-1})}>Precedente</button><button type="button" className="btn-secondary px-3 py-2" disabled={pending || history.page >= history.pageCount} onClick={() => setQuery({...query,page:history.page+1})}>Successiva</button></nav>
        {history.entries.length === 0 && <p>Nessuna assegnazione corrisponde ai filtri.</p>}
        <ol className="space-y-3">{history.entries.map(entry => <li key={`${entry.kind}-${entry.id}`} className="space-y-2 rounded-xl border border-[var(--peace-border)] p-4" aria-label={`${entry.name} · Settore ${entry.sector}`}>
          <h3 className="font-semibold">{entry.name}{entry.kind === 'allocation' ? ' · Riserva delegazione' : entry.kind === 'seat' ? ' · Posto liberato dalla riserva' : ''}</h3>
          {entry.groupName && <p className="text-sm">Nella riserva di {entry.groupName}</p>}
          <p className="text-sm">Assegnata il {date(entry.createdAt)} · <strong>{entry.revokedAt ? `Revocata il ${date(entry.revokedAt)}` : 'Attiva'}</strong></p>
          <Places entry={entry}/>
          {!entry.revokedAt && entry.kind !== 'seat' && <button type="button" className="btn-secondary px-4 py-2" disabled={pending} onClick={() => {setMessage('');setConfirmation({entry,command:{planId,revision:history.revision,requestId:crypto.randomUUID(),kind:entry.kind === 'allocation' ? 'allocation' : 'nominee',id:entry.id}});}}>Revoca {entry.kind === 'allocation' ? 'delegazione' : 'assegnazione'}</button>}
          {confirmation?.entry.id === entry.id && <div className="space-y-3 rounded-lg border border-red-300 bg-red-50 p-4" role="region" aria-label="Conferma revoca">
            <p className="font-semibold">Revocare {entry.name} · Settore {entry.sector}?</p>
            <p>{entry.kind === 'allocation' ? `Saranno liberati tutti i ${entry.quantity} posti della delegazione e revocate le sue nomine attive.` : entry.groupName ? 'La persona perderà questa assegnazione. Il posto resterà riservato alla delegazione, disponibile per un altro membro.' : 'Il posto tornerà disponibile per una nuova assegnazione.'}</p>
            {entry.people.length > 0 && <><p>Persone coinvolte ({entry.people.length}):</p><ul className="max-h-64 overflow-y-auto list-disc pl-5">{entry.people.map((name,i) => <li key={i}>{name}</li>)}</ul></>}
            <p>La revoca resterà nella cronologia.</p>
            <div className="flex flex-wrap gap-3"><button type="button" className="btn-primary px-4 py-2" disabled={pending} onClick={submit}>{pending ? 'Revoca in corso…' : 'Conferma revoca'}</button><button type="button" className="btn-secondary px-4 py-2" disabled={pending} onClick={() => setConfirmation(null)}>Annulla</button></div>
          </div>}
        </li>)}</ol>
      </>}
    </div>}
  </section>;
}

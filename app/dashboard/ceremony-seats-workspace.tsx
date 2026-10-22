"use client";
import { useRef, useState, useTransition, type ComponentProps } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DeskCommand, SeatsDesk, SeatPerson, SeatSubject } from '@/lib/ceremonies/seats-desk';
import { OpeningHallOverview } from './opening-hall-overview';
import { CeremonySeatMap } from './ceremony-seat-map';
import { OperationsParticipantFilters } from './operations-participant-filters';
const messages: Record<string,string> = {
  saved: 'Assegnazione salvata.', conflict: 'La disponibilità è cambiata. Controlla la piantina aggiornata e conferma nuovamente.', occupied: 'Uno dei posti è già occupato. Nessuna assegnazione è stata salvata.', capacity: 'Il settore non ha abbastanza posti disponibili. Nessuna assegnazione è stata salvata.', duplicate: 'Una persona selezionata ha già un posto o una diversa assegnazione da verificare. Nessuna assegnazione è stata salvata.', ineligible: 'Iscrizione, famiglia o appartenenza alla delegazione cambiate. Controlla i destinatari.', forbidden: 'Non sei più autorizzato a gestire i posti.', invalid: 'Controlla posti e persone selezionati.', unconfigured: 'Il settore non è ancora pronto per le assegnazioni.', unavailable: 'Esito non verificabile. Riprova senza cambiare la selezione: la stessa richiesta non sarà duplicata.',
};
export function CeremonySeatsWorkspace({ desk, people, page, filterProps, save }: {
  desk: SeatsDesk; people: SeatPerson[]; page: { page: number; pageCount: number; first: number; last: number; total: number };
  filterProps: Omit<ComponentProps<typeof OperationsParticipantFilters>, 'withoutGroup' | 'section'>;
  save: (command: DeskCommand) => Promise<{ status: string }>;
}) {
  const router = useRouter(), params = useSearchParams();
  const [pending, transition] = useTransition();
  const [order, setOrder] = useState<'seats'|'people'>('seats');
  const [target, setTarget] = useState<'assign'|'group'>('assign');
  const [sectorId, setSectorId] = useState(desk.sectors[0]?.id ?? '');
  const [block, setBlock] = useState('');
  const [seatIds, setSeatIds] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<SeatSubject[]>([]);
  const [groupId, setGroupId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState('');
  const [confirm, setConfirm] = useState(false);
  const retry = useRef<{ fingerprint: string; command: DeskCommand } | null>(null);
  const sector = desk.sectors.find(s => s.id === sectorId);
  const numbered = sector?.numbered !== false;
  const seats = desk.active?.seats ?? [];
  const selectedSeats = seatIds.map(id => seats.find(s => s.id === id)).filter(s => !!s);
  const required = target === 'assign' ? subjects.length : numbered ? seatIds.length : quantity;
  const claims = new Map(desk.claims.map(c => [c.seatId,c]));
  const available = seats.filter(s => s.sectorId === sectorId && !s.blocked && (!claims.has(s.id) || (target === 'assign' && !claims.get(s.id)?.nomineeId && desk.allocations.some(a => a.id === claims.get(s.id)?.allocationId && a.groupId)))).map(s => s.id);
  const canSave = !!sector && required > 0 && (target === 'assign' || !!groupId) && (!numbered || (seatIds.length === required && seatIds.every(id => available.includes(id))));
  function toggleSubject(subject: SeatSubject) {
    setConfirm(false); setStatus('');
    setSubjects(prev => prev.some(s => (s.childId ?? s.registrationId) === (subject.childId ?? subject.registrationId)) ? prev.filter(s => (s.childId ?? s.registrationId) !== (subject.childId ?? subject.registrationId)) : [...prev, subject]);
  }
  function changePage(value: number) {
    const next = new URLSearchParams(params.toString()); next.set('participantPage',String(value));
    transition(() => router.replace(`/dashboard/${filterProps.dashboard}?${next}`, { scroll: false }));
  }
  function submit() {
    if (!canSave || pending) return;
    const data: DeskCommand['data'] = { action: target, sectorId, seatIds: numbered ? seatIds : [], quantity: required, groupId: target === 'group' ? groupId : null, subjects: target === 'assign' ? subjects.map(({registrationId,childId}) => ({registrationId,childId})) : [] };
    const fingerprint = JSON.stringify([desk.planId, desk.revision, data]);
    const command = retry.current?.fingerprint === fingerprint ? retry.current.command : { planId: desk.planId, revision: desk.revision, requestId: crypto.randomUUID(), data };
    retry.current = { fingerprint, command };
    transition(async () => {
      try {
        const result = await save(command); setStatus(result.status);
        if (result.status === 'saved') { setSeatIds([]); setSubjects([]); setConfirm(false); retry.current = null; router.refresh(); }
        else if (result.status !== 'unavailable') { retry.current = null; setConfirm(false); router.refresh(); }
      } catch { setStatus('unavailable'); }
    });
  }
  const pagination = <nav aria-label="Pagine iscritti" className="flex flex-wrap items-center gap-3 text-sm"><span>{page.first}–{page.last} di {page.total} iscritti</span><button type="button" className="btn-secondary px-3 py-2" disabled={pending || page.page <= 1} onClick={() => changePage(page.page-1)}>Precedente</button><label>Pagina <select className="field w-auto" value={page.page} disabled={pending} onChange={e => changePage(Number(e.target.value))}>{Array.from({length:page.pageCount},(_,i) => <option key={i+1}>{i+1}</option>)}</select> di {page.pageCount}</label><button type="button" className="btn-secondary px-3 py-2" disabled={pending || page.page >= page.pageCount} onClick={() => changePage(page.page+1)}>Successiva</button></nav>;
  const directory = <section className="surface-card min-w-0 space-y-4 p-4 sm:p-5" aria-label="Scegli persone e familiari"><h2 className="text-lg font-semibold">Scegli persone e familiari</h2><p className="text-sm">Tutti gli iscritti attivi sono selezionabili. Prima chi ha comunicato la presenza nella fascia della cerimonia, poi gli altri in ordine alfabetico. La selezione resta conservata cambiando pagina e filtri.</p><OperationsParticipantFilters {...filterProps} section="cerimonie" withoutGroup={false}/>{pagination}<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Scegli</th><th className="p-2">Partecipante e famiglia</th><th className="p-2">Provenienza / gruppo</th><th className="p-2">Presenza e posto</th></tr></thead><tbody>{people.flatMap(p => [{registrationId:p.registrationId,childId:null as string|null,name:p.name},...p.children.map(c => ({registrationId:p.registrationId,childId:c.id,name:c.name}))].map(subject => {
    const nominee = desk.nominees.find(n => n.registrationId === p.registrationId && n.childId === subject.childId);
    const claim = nominee && desk.claims.find(c => c.nomineeId === nominee.id);
    const allocated = nominee && desk.allocations.find(a => a.id === nominee.allocationId);
    const assignedSeat = claim && seats.find(s => s.id === claim.seatId);
    const locked = !!nominee && (!!claim || !nominee.needsSeat || allocated?.sectorId !== sectorId || !numbered || nominee.review);
    const selected = subjects.some(s => s.registrationId === subject.registrationId && s.childId === subject.childId);
    return <tr key={subject.childId ?? subject.registrationId} className="border-t border-[var(--peace-border)]"><td className="p-2"><input type="checkbox" aria-label={`Seleziona ${subject.name}`} checked={selected} disabled={pending || (locked && !selected)} onChange={() => toggleSubject(subject)} className="size-5"/></td><td className={`p-2 ${subject.childId ? 'pl-6' : ''}`}><span className="font-semibold">{subject.name}</span><span className="block text-xs text-[var(--peace-muted)]">{subject.childId ? `Figlio/a di ${p.name}` : p.code}</span></td><td className="p-2">{p.place}<span className="block">{p.group}</span></td><td className="p-2"><span className={p.priority ? 'font-semibold text-emerald-800' : ''}>{p.attendance}</span>{nominee && <span className="block">{desk.sectors.find(s => s.id === allocated?.sectorId)?.name}{assignedSeat ? ` · ${assignedSeat.row} · ${assignedSeat.number}` : nominee.needsSeat ? ' · Settore assegnato' : ' · Senza sedia'}{nominee.review ? ' · Da verificare' : ''}</span>}</td></tr>;
  }))}</tbody></table>{!people.length && <p className="p-4">Nessun iscritto corrisponde ai filtri.</p>}</div>{pagination}</section>;
  const map = <section className="surface-card min-w-0 space-y-4 p-4 sm:p-5" aria-label="Scegli posti"><h2 className="text-lg font-semibold">Scegli i posti</h2><label className="grid gap-1">Settore<select className="field" aria-label="Settore" value={sectorId} disabled={pending} onChange={e => {setSectorId(e.target.value);setBlock('');setSeatIds([]);setConfirm(false);setStatus('');}}>{desk.sectors.map(s => <option key={s.id} value={s.id}>{s.name} · {s.remaining} posti ancora disponibili</option>)}</select></label>{desk.layoutKey === 'assisi-opening-2026' && <OpeningHallOverview seats={seats} sectors={desk.sectors} claims={desk.claims} onBlock={(id, blockKey) => {const blockSeats = seats.filter(s => s.row.startsWith(`${blockKey}-r`));const next = id || blockSeats.find(s => s.sectorId === sectorId)?.sectorId || blockSeats[0]?.sectorId;if (next) {if (next !== sectorId) setSeatIds([]);setSectorId(next);setBlock(blockKey);setConfirm(false);}}}/>}{numbered ? <CeremonySeatMap key={`${sectorId}-${block}`} showOverview={false} initialBlock={block} seats={seats.filter(s => s.sectorId === sectorId)} layoutKey={desk.layoutKey} sectors={desk.sectors.filter(s => s.id === sectorId)} claims={desk.claims} allocationId="" selectableSeatIds={available} selected={seatIds} onSelect={id => {setSeatIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev,id]);setConfirm(false);setStatus('');}} disabled={pending} locale="it"/> : <p>In questo settore assegni il biglietto senza scegliere una sedia numerata.</p>}{target === 'group' && !numbered && <label className="grid gap-1">Quantità di posti<input className="field" type="number" min="1" max={Math.max(1,sector?.remaining ?? 1)} value={quantity} disabled={pending} onChange={e => {setQuantity(Number(e.target.value));setConfirm(false);}}/></label>}<p className="text-sm">I posti grigi sono riservati al protocollo. I posti viola sono già assegnati a una persona; quelli gialli sono riservati a una delegazione e possono essere assegnati ai suoi membri.</p></section>;
  return <fieldset disabled={pending} className="grid min-w-0 gap-4" aria-label="Assegnazione posti" aria-busy={pending}>
    <section className="surface-card space-y-3 p-5"><p>{desk.location} · {desk.day.split('-').reverse().join('/')}</p><div className="flex flex-wrap gap-2"><button type="button" className={order==='seats'?'btn-primary px-4 py-2':'btn-secondary px-4 py-2'} onClick={() => setOrder('seats')}>Parti dai posti</button><button type="button" className={order==='people'?'btn-primary px-4 py-2':'btn-secondary px-4 py-2'} onClick={() => {setOrder('people');setTarget('assign');setConfirm(false);}}>Parti dalle persone</button></div><label className="grid gap-1">Destinatari<select className="field" aria-label="Destinatari" value={target} disabled={pending} onChange={e => {setTarget(e.target.value as 'assign'|'group');setSeatIds([]);setConfirm(false);}}><option value="assign">Persone e famiglie</option><option value="group">Delegazione di un gruppo</option></select></label>{target === 'group' && <label className="grid gap-1">Gruppo<select className="field" aria-label="Gruppo" value={groupId} disabled={pending} onChange={e => {setGroupId(e.target.value);setConfirm(false);}}><option value="">Scegli un gruppo</option>{filterProps.groupOptions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select><span className="text-sm">Riserva i posti alla delegazione. Potrai poi scegliere le persone del gruppo cliccando sui posti riservati.</span></label>}</section>
    {order === 'people' && target === 'assign' ? <>{directory}{map}</> : <>{map}{target === 'assign' && directory}</>}
    <section className="surface-card space-y-3 p-5" aria-label="Riepilogo assegnazione"><h2 className="text-lg font-semibold">Riepilogo assegnazione</h2><p>{sector?.name} · {numbered ? seatIds.length : required} posti · {target === 'assign' ? `${subjects.length} persone selezionate` : filterProps.groupOptions.find(g => g.id === groupId)?.name ?? 'Gruppo da scegliere'}</p>{target === 'assign' && <ol className="list-decimal space-y-2 pl-6">{subjects.map((s,i) => <li key={s.childId ?? s.registrationId}>{s.name}{numbered ? selectedSeats[i] ? ` → ${selectedSeats[i].row} · posto ${selectedSeats[i].number}` : ' → scegli un posto' : ` → ${sector?.name}`} <button type="button" className="text-sm underline" disabled={pending} onClick={() => toggleSubject(s)}>Rimuovi {s.name}</button></li>)}</ol>}{target === 'group' && numbered && <ul className="list-disc pl-6">{selectedSeats.map(s => <li key={s.id}>{s.row} · posto {s.number}</li>)}</ul>}{selectedSeats.some(s => claims.has(s.id)) && <p>Posti riservati a: {[...new Set(selectedSeats.map(s => desk.allocations.find(a => a.id === claims.get(s.id)?.allocationId)?.groupName).filter(Boolean))].join(', ')}. Si possono assegnare soltanto ai membri delle rispettive delegazioni.</p>}{numbered && target === 'assign' && seatIds.length !== subjects.length && <p>Scegli lo stesso numero di posti e persone. L’ordine della selezione determina l’abbinamento mostrato sopra.</p>}{status && <p role="status" className="rounded-lg bg-slate-100 p-3">{messages[status] ?? messages.unavailable}</p>}{confirm ? <div className="flex flex-wrap gap-3"><button type="button" className="btn-primary px-4 py-2" disabled={pending || !canSave} onClick={submit}>{pending ? 'Salvataggio…' : 'Conferma assegnazione'}</button><button type="button" className="btn-secondary px-4 py-2" disabled={pending} onClick={() => setConfirm(false)}>Annulla</button></div> : <button type="button" className="btn-primary px-4 py-2" disabled={pending || !canSave} onClick={() => setConfirm(true)}>Verifica e assegna</button>}<p className="text-xs text-[var(--peace-muted)]">I riferimenti di fila e posto sono quelli della piantina attuale. Le etichette da applicare alle sedie saranno concordate con l’allestimento.</p></section>
  </fieldset>;
}

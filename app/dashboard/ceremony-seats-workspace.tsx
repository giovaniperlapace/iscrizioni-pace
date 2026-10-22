"use client";
import { useEffect, useRef, useState, useTransition, type ComponentProps } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DeskCommand, SeatsDesk, SeatPerson, SeatSubject } from '@/lib/ceremonies/seats-desk';
import { ceremonySeatLabel } from "@/lib/ceremonies/seat-label";
import { OpeningHallOverview } from './opening-hall-overview';
import { CeremonySeatMap } from './ceremony-seat-map';
import { CeremonyOccupiedSeat } from './ceremony-occupied-seat';
import type { RevokeSeat } from '@/lib/ceremonies/assignment-history';
import { OperationsParticipantFilters } from './operations-participant-filters';
const messages: Record<string,string> = {
  seat_revoked: 'Posto liberato.', saved: 'Assegnazione salvata.', conflict: 'La disponibilità è cambiata. Controlla la piantina aggiornata e conferma nuovamente.', occupied: 'Uno dei posti è già occupato. Nessuna assegnazione è stata salvata.', capacity: 'Il settore non ha abbastanza posti disponibili. Nessuna assegnazione è stata salvata.', duplicate: 'Una persona selezionata ha già un posto o una diversa assegnazione da verificare. Nessuna assegnazione è stata salvata.', ineligible: 'Iscrizione, famiglia o appartenenza alla delegazione cambiate. Controlla i destinatari.', forbidden: 'Non sei più autorizzato a gestire i posti.', invalid: 'Controlla posti e persone selezionati.', unconfigured: 'Il settore non è ancora pronto per le assegnazioni.', unavailable: 'Esito non verificabile. Riprova senza cambiare la selezione: la stessa richiesta non sarà duplicata.',
};
export function CeremonySeatsWorkspace({ desk, people, page, filterProps, save, revokeSeat }: {
  desk: SeatsDesk; people: SeatPerson[]; page: { page: number; pageCount: number; first: number; last: number; total: number };
  filterProps: Omit<ComponentProps<typeof OperationsParticipantFilters>, 'withoutGroup' | 'section'>;
  revokeSeat: (command: RevokeSeat) => Promise<{ status: string }>;
  save: (command: DeskCommand) => Promise<{ status: string }>;
}) {
  const router = useRouter(), params = useSearchParams();
  const [pending, transition] = useTransition();
  const [target, setTarget] = useState<'assign'|'group'>('assign');
  const [sectorId, setSectorId] = useState(desk.sectors[0]?.id ?? '');
  const [block, setBlock] = useState('');
  const [mapNavigation, setMapNavigation] = useState(0);
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mapNavigation) return;
    detailRef.current?.focus({ preventScroll: true });
    detailRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [mapNavigation]);
  const [seatIds, setSeatIds] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<SeatSubject[]>([]);
  const [groupId, setGroupId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState('');
  const [occupied, setOccupied] = useState<{label:string;person?:string;group?:string|null;canAssign:boolean;command:RevokeSeat} | null>(null);
  const [confirm, setConfirm] = useState(false);
  const retry = useRef<{ fingerprint: string; command: DeskCommand } | null>(null);
  const sector = desk.sectors.find(s => s.id === sectorId);
  const numbered = sector?.numbered !== false;
  const seats = desk.active?.seats ?? [];
  const selectedSeats = seatIds.map(id => seats.find(s => s.id === id)).filter(s => !!s);
  const required = numbered ? seatIds.length : quantity;
  const hasPlaces = Number.isInteger(required) && required > 0;
  const reservedSelection = selectedSeats.some(s => desk.claims.some(c => c.seatId === s.id));
  const claims = new Map(desk.claims.map(c => [c.seatId,c]));
  const available = seats.filter(s => s.sectorId === sectorId && !s.blocked && (!claims.has(s.id) || (!claims.get(s.id)?.nomineeId && desk.allocations.some(a => a.id === claims.get(s.id)?.allocationId && a.groupId)))).map(s => s.id);
  const canSave = !!sector && hasPlaces && (target === 'assign' ? subjects.length === required : !!groupId && !reservedSelection) && (numbered ? seatIds.every(id => available.includes(id)) : required <= sector.remaining);
  function selectSeat(id: string) {
    if (claims.has(id)) setTarget('assign');
    setSeatIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev,id]);setConfirm(false);setStatus('');
  }
  function inspectSeat(id: string) {
    const seat=seats.find(s=>s.id===id), claim=claims.get(id), allocation=desk.allocations.find(a=>a.id===claim?.allocationId);
    if (!seat || !claim || !allocation) return;
    setOccupied({label:ceremonySeatLabel(desk.sectors.find(s=>s.id===seat.sectorId)?.name??'',seat),person:desk.nominees.find(n=>n.id===claim.nomineeId)?.name,group:allocation.groupName,canAssign:!claim.nomineeId && !!allocation.groupId,command:{planId:desk.planId,revision:desk.revision,requestId:crypto.randomUUID(),seatId:id}});
  }
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
        if (result.status === 'saved') { setSeatIds([]); setSubjects([]); setQuantity(1); setConfirm(false); retry.current = null; router.refresh(); }
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
    return <tr key={subject.childId ?? subject.registrationId} className="border-t border-[var(--peace-border)]"><td className="p-2"><input type="checkbox" aria-label={`Seleziona ${subject.name}`} checked={selected} disabled={pending || (locked && !selected)} onChange={() => toggleSubject(subject)} className="size-5"/></td><td className={`p-2 ${subject.childId ? 'pl-6' : ''}`}><span className="font-semibold">{subject.name}</span><span className="block text-xs text-[var(--peace-muted)]">{subject.childId ? `Figlio/a di ${p.name}` : p.code}</span></td><td className="p-2">{p.place}<span className="block">{p.group}</span></td><td className="p-2"><span className={p.priority ? 'font-semibold text-emerald-800' : ''}>{p.attendance}</span>{nominee && <span className="block">{assignedSeat ? ceremonySeatLabel(desk.sectors.find(s => s.id === allocated?.sectorId)?.name ?? '', assignedSeat) : `Settore ${desk.sectors.find(s => s.id === allocated?.sectorId)?.name ?? ''} · ${nominee.needsSeat ? 'Assegnato' : 'Senza sedia'}`}{nominee.review ? ' · Da verificare' : ''}</span>}</td></tr>;
  }))}</tbody></table>{!people.length && <p className="p-4">Nessun iscritto corrisponde ai filtri.</p>}</div>{pagination}</section>;
  const map = <section className="surface-card min-w-0 space-y-4 p-4 sm:p-5" aria-label="Scegli posti"><h2 className="text-lg font-semibold">Scegli i posti</h2><label className="grid gap-1">Settore<select className="field" aria-label="Settore" value={sectorId} disabled={pending} onChange={e => {setSectorId(e.target.value);setBlock('');setSeatIds([]);setConfirm(false);setStatus('');}}>{desk.sectors.map(s => <option key={s.id} value={s.id}>{s.name} · {s.remaining} posti ancora disponibili</option>)}</select></label>{desk.layoutKey === 'assisi-opening-2026' && <OpeningHallOverview seats={seats} sectors={desk.sectors} claims={desk.claims} onBlock={(id, blockKey) => {const blockSeats = seats.filter(s => s.row.startsWith(`${blockKey}-r`));const next = id || blockSeats.find(s => s.sectorId === sectorId)?.sectorId || blockSeats[0]?.sectorId;if (next) {if (next !== sectorId) setSeatIds([]);setSectorId(next);setBlock(blockKey);setConfirm(false);setMapNavigation(value => value+1);}}}/>}<div ref={detailRef} tabIndex={-1} className="scroll-mt-24 space-y-4 focus:outline-none" aria-label="Dettaglio posti del settore">{numbered ? <CeremonySeatMap key={`${sectorId}-${block}-${mapNavigation}`} showOverview={false} initialBlock={block} onBlockChange={value => {setBlock(value);detailRef.current?.focus({preventScroll:true});}} seats={seats.filter(s => s.sectorId === sectorId)} layoutKey={desk.layoutKey} sectors={desk.sectors.filter(s => s.id === sectorId)} claims={desk.claims} allocationId="" selectableSeatIds={available} selected={seatIds} onSelect={selectSeat} onOccupied={inspectSeat} disabled={pending} locale="it"/> : <p>In questo settore assegni il biglietto senza scegliere una sedia numerata.</p>}{!numbered && <label className="grid gap-1">Quantità di posti<span className="flex items-center gap-2"><button type="button" className="btn-secondary px-4 py-2" aria-label="Riduci quantità" disabled={pending || quantity <= 1} onClick={() => {setQuantity(q => q-1);setConfirm(false);}}>−</button><input aria-label="Quantità di posti" className="field" type="number" min="1" max={Math.max(1,sector?.remaining ?? 1)} value={quantity} disabled={pending} onChange={e => {setQuantity(Number(e.target.value));setConfirm(false);}}/><button type="button" className="btn-secondary px-4 py-2" aria-label="Aumenta quantità" disabled={pending || quantity >= (sector?.remaining ?? 0)} onClick={() => {setQuantity(q => q+1);setConfirm(false);}}>+</button></span></label>}<p className="text-sm">I posti grigi sono riservati al protocollo. I posti viola sono già assegnati a una persona; quelli gialli sono riservati a una delegazione e possono essere assegnati ai suoi membri.</p></div></section>;
  return <><fieldset disabled={pending} className="grid min-w-0 gap-4" aria-label="Assegnazione posti" aria-busy={pending}>
    <section className="surface-card space-y-3 p-5"><p>{desk.location} · {desk.day.split('-').reverse().join('/')}</p><p>Seleziona uno o più posti, poi scegli a chi assegnarli. Nel settore F indica la quantità.</p><a href="#cronologia-assegnazioni" className="inline-block underline">Cronologia e revoche</a></section>
    {map}
    {hasPlaces && <section className="surface-card space-y-3 p-5" aria-label="Scegli destinatari"><h2 className="text-lg font-semibold">A chi assegnare {required === 1 ? 'il posto selezionato' : `i ${required} posti selezionati`}</h2><label className="grid gap-1">Destinatari<select className="field" aria-label="Destinatari" value={target} disabled={pending} onChange={e => {setTarget(e.target.value as 'assign'|'group');setConfirm(false);setStatus('');}}><option value="assign">Persona e familiari</option><option value="group" disabled={reservedSelection}>Delegazione di un gruppo</option></select></label>{reservedSelection && <p>I posti già riservati a una delegazione possono essere assegnati ai suoi membri.</p>}{target === 'group' && <label className="grid gap-1">Gruppo<select className="field" aria-label="Gruppo" value={groupId} disabled={pending} onChange={e => {setGroupId(e.target.value);setConfirm(false);}}><option value="">Scegli un gruppo</option>{filterProps.groupOptions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select><span className="text-sm">Riserva i posti alla delegazione. Potrai poi scegliere le persone del gruppo cliccando sui posti riservati.</span></label>}</section>}
    {hasPlaces && target === 'assign' && directory}
    <section className="surface-card space-y-3 p-5" aria-label="Riepilogo assegnazione"><h2 className="text-lg font-semibold">Riepilogo assegnazione</h2><p>{sector?.name} · {numbered ? seatIds.length : required} posti · {target === 'assign' ? `${subjects.length} persone selezionate` : filterProps.groupOptions.find(g => g.id === groupId)?.name ?? 'Gruppo da scegliere'}</p>{target === 'assign' && <ol className="list-decimal space-y-2 pl-6">{subjects.map((s,i) => <li key={s.childId ?? s.registrationId}>{s.name}{numbered ? selectedSeats[i] ? ` → ${ceremonySeatLabel(sector?.name ?? '', selectedSeats[i])}` : ' → scegli un posto' : ` → ${sector?.name}`} <button type="button" className="text-sm underline" disabled={pending} onClick={() => toggleSubject(s)}>Rimuovi {s.name}</button></li>)}</ol>}{target === 'group' && numbered && <ul className="list-disc pl-6">{selectedSeats.map(s => <li key={s.id}>{ceremonySeatLabel(sector?.name ?? '', s)}</li>)}</ul>}{selectedSeats.some(s => claims.has(s.id)) && <p>Posti riservati a: {[...new Set(selectedSeats.map(s => desk.allocations.find(a => a.id === claims.get(s.id)?.allocationId)?.groupName).filter(Boolean))].join(', ')}. Si possono assegnare soltanto ai membri delle rispettive delegazioni.</p>}{target === 'assign' && required !== subjects.length && <p>Scegli lo stesso numero di posti e persone. L’ordine della selezione determina l’abbinamento mostrato sopra.</p>}{status && <p role="status" className="rounded-lg bg-slate-100 p-3">{messages[status] ?? messages.unavailable}</p>}{confirm ? <div className="flex flex-wrap gap-3"><button type="button" className="btn-primary px-4 py-2" disabled={pending || !canSave} onClick={submit}>{pending ? 'Salvataggio…' : 'Conferma assegnazione'}</button><button type="button" className="btn-secondary px-4 py-2" disabled={pending} onClick={() => setConfirm(false)}>Annulla</button></div> : <button type="button" className="btn-primary px-4 py-2" disabled={pending || !canSave} onClick={() => setConfirm(true)}>Verifica e assegna</button>}<p className="text-xs text-[var(--peace-muted)]">I riferimenti di fila e posto sono quelli della piantina attuale. Le etichette da applicare alle sedie saranno concordate con l’allestimento.</p></section>
  </fieldset>{occupied && <CeremonyOccupiedSeat {...occupied} revoke={revokeSeat} select={()=>selectSeat(occupied.command.seatId)} close={()=>setOccupied(null)} changed={()=>{setSeatIds(ids=>ids.filter(id=>id!==occupied.command.seatId));setSubjects([]);setConfirm(false);setStatus('seat_revoked');}}/>}</>;
}

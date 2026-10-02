"use client";
import { useEffect, useState } from 'react';
import { countPeople, projectReceptionReport, type ReceptionReport } from '@/lib/reception/report';

export function ReceptionOperationalReport({ eventId }: { eventId: string | null }) {
  const [day, setDay] = useState('');
  const [part, setPart] = useState('all');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; data: ReceptionReport | null; error: boolean } | null>(null);
  const key = `${eventId}:${day}:${part}:${attempt}`;
  useEffect(() => {
    if (!eventId) return;
    let disposed = false, busy = false, blocked = false;
    let controller: AbortController | null = null;
    async function refresh() {
      if (busy || blocked || document.hidden) return;
      busy = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 15000);
      try {
        const params = new URLSearchParams({ eventId:eventId!, day, part });
        const response = await fetch(`/dashboard/attendance/report?${params}`, { cache:'no-store', signal:controller.signal });
        if (response.redirected || response.status === 401 || response.status === 403) blocked = true;
        if (response.redirected || !response.ok) throw Error('unavailable');
        const data = projectReceptionReport(await response.json());
        if (!data || data.eventId !== eventId || data.day !== (day || null) || data.part !== part) throw Error('invalid');
        if (!disposed) setState({ key, data, error:false });
      } catch { if (!disposed) setState({ key, data:null, error:true }); }
      finally { clearTimeout(timeout); busy = false; }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    const visible = () => void refresh();
    document.addEventListener('visibilitychange',visible);
    window.addEventListener('online',visible);
    return () => { disposed=true; controller?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange',visible); window.removeEventListener('online',visible); };
  }, [eventId, day, part, attempt, key]);
  const current = state?.key === key ? state : null;
  const data = current?.data;
  return <section className="mt-6 grid min-w-0 gap-4 border-t border-[var(--peace-border)] pt-5" aria-label="Report operativo accoglienza">
    <h3 className="text-lg font-semibold">Report operativo accoglienza</h3>
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-sm">Giorno (Europe/Rome)<input className="min-h-11 max-w-full rounded border border-[var(--peace-border)] p-2" type="date" value={day} onChange={e => { setDay(e.target.value); if (!e.target.value) setPart('all'); }} /></label>
      <label className="grid gap-1 text-sm">Fascia oraria<select className="min-h-11 rounded border border-[var(--peace-border)] p-2" value={part} disabled={!day} onChange={e => setPart(e.target.value)}><option value="all">Tutta la giornata</option><option value="morning">Mattina · prima delle 12</option><option value="afternoon">Pomeriggio · dalle 12</option></select></label>
      <button className="btn-secondary min-h-11 px-3" type="button" disabled={!day} onClick={() => { setDay(''); setPart('all'); }}>Intero evento</button>
    </div>
    <p className="text-sm text-[var(--peace-muted)]">{day ? 'Previsti: iscritti che hanno indicato Sì nella fascia scelta, con i minori collegati; scuole con almeno un panel prenotato nella fascia. Ogni nucleo o scuola è contato una sola volta.' : 'Previsti: tutte le iscrizioni operative, inclusi minori e quantità prenotate dalle scuole.'} Gli ingressi sono quelli registrati nella fascia scelta e tuttora validi. Non misurano permanenza o assenze; una persona entrata prima della fascia non è un nuovo ingresso.</p>
    <p className="text-sm" role="status">{!eventId ? 'Nessun evento disponibile.' : current?.error ? 'Report non disponibile. Verifica la connessione e l’accesso.' : data ? `Aggiornato alle ${new Date(data.updatedAt).toLocaleTimeString('it-IT', { timeZone:'Europe/Rome' })} · ogni 10 secondi.` : 'Caricamento report…'}</p>
    {current?.error && <button type="button" className="btn-secondary min-h-11 justify-self-start px-3" onClick={() => setAttempt(n=>n+1)}>Riprova report</button>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Previsti e ingressi effettivi nella selezione</caption><thead><tr><th className="p-2">Persone</th><th className="p-2">Previsti</th><th className="p-2">Ingressi</th></tr></thead><tbody>
      {([['adults','Adulti iscritti'],['children','Minori accompagnati'],['students','Studenti'],['companions','Accompagnatori scuole'],['schoolBookings','Classi / gruppi scuola']] as const).map(([field,label])=><tr key={field} className="border-t border-[var(--peace-border)]"><th className="p-2 font-normal" scope="row">{label}</th><td className="p-2">{data?.expected[field] ?? '—'}</td><td className="p-2">{data?.arrivals[field] ?? '—'}</td></tr>)}
      <tr className="border-t border-[var(--peace-border)] font-semibold"><th className="p-2" scope="row">Totale persone</th><td className="p-2">{data ? countPeople(data.expected) : '—'}</td><td className="p-2">{data ? countPeople(data.arrivals) : '—'}</td></tr>
    </tbody></table></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{([
      ['duplicateRequests','Richieste di ingresso duplicate evitate'],['retries','Retry riconosciuti'],['corrections','Correzioni salvate'],['cancellations','Annullamenti salvati'],
    ] as const).map(([field,label])=><div className="rounded-lg border border-[var(--peace-border)] p-3" key={field}><p className="text-sm">{label}</p><p className="text-2xl font-semibold">{data?.operations[field] ?? '—'}</p></div>)}</div>
    <p className="text-sm text-[var(--peace-muted)]">Le operazioni sono conteggiate all’ora della richiesta, per richiesta e non per persona. I duplicati indicano richieste di ingresso senza modifiche: le semplici riletture di QR già presenti non sono distinguibili nell’audit storico e non sono incluse. I retry sono separati dalle correzioni. Punto di accoglienza: dato non registrato.</p>
    {data && <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">Ingressi per ora · Europe/Rome</summary>{data.hours.length ? <ul className="grid gap-2 text-sm">{data.hours.map(h=><li className="flex justify-between gap-4 border-b border-[var(--peace-border)] py-2" key={h.hour}><span>{h.hour}</span><span>{h.people} persone</span></li>)}</ul> : <p className="text-sm">Nessun ingresso nella fascia scelta.</p>}</details>}
  </section>;
}

import type { GroupCeremonySummary } from '@/lib/ceremonies/group-seat-summary';
export function GroupCeremonyPlaces({ summary }: { summary?: GroupCeremonySummary }) {
  if (!summary) return null;
  return <section aria-label="Posti cerimonie del gruppo" className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
    <h4 className="font-semibold">Posti cerimonie assegnati al gruppo</h4>
    {summary.status === 'unavailable' ? <p role="alert">Non è stato possibile leggere i posti della delegazione. Riapri la scheda per riprovare.</p> : !summary.items.length ? <p>Nessun posto riservato al gruppo.</p> : summary.items.map((item,i) => <div key={i} className="space-y-1">
      <p className="font-semibold">{item.kind === 'opening' ? 'Inaugurazione' : 'Cerimonia finale'} · Settore {item.sector} · {item.quantity} posti</p>
      <ul className="space-y-1 text-sm">{item.ranges.map(range=><li key={range}>{range}</li>)}</ul>
      {item.unnumbered > 0 && <p className="text-sm">Settore {item.sector} · {item.unnumbered} posti senza sedia numerata</p>}
    </div>)}
    <p className="text-xs text-slate-600">La riserva dei posti non registra l’ingresso alla cerimonia.</p>
  </section>;
}

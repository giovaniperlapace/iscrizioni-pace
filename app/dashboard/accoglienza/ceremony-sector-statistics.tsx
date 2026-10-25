import type { CeremonySectorStatistics as SectorStatistics } from '@/lib/reception/ceremony-sector-statistics';
export function CeremonySectorStatistics({ sectors }: { sectors: SectorStatistics[] }) {
  return <div className="grid gap-3" aria-live="polite">
    {sectors.map(s => <section key={s.sectorId} aria-label={`Situazione settore ${s.sector}`} className={`grid gap-2 rounded-xl border p-3 ${s.entered >= s.capacity ? 'border-amber-500 bg-amber-50 text-amber-950' : 'border-sky-200 bg-sky-50 text-slate-900'}`}>
      <h4 className="font-semibold">Settore {s.sector}</h4>
      <dl className="grid grid-cols-3 gap-2">
        {[["Capienza reale", s.capacity], ["Persone entrate", s.entered], ["Overbooking previsto", `+${s.overbooking}`]].map(([label,value]) => <div key={label}><dt className="text-xs">{label}</dt><dd className="text-xl font-bold tabular-nums">{value}</dd></div>)}
      </dl>
      {s.entered >= s.capacity && <p className="text-sm font-semibold">Capienza reale raggiunta{s.entered > s.capacity ? `: ${s.entered - s.capacity} persone oltre la capienza` : ''}. Valuta la disponibilità prima di registrare altri ingressi.</p>}
    </section>)}
  </div>;
}

import type { RelayRoomStatistics as Room } from "@/lib/reception/relay-room-statistics";
export function RelayRoomStatistics({rooms,loading}:{rooms:Room[]|null;loading:boolean}) {
  if (rooms?.length === 0) return null;
  return <section aria-label="Disponibilità sale collegate" aria-live="polite" className="surface-card grid gap-3 border border-slate-200 bg-slate-50 p-4 sm:p-5">
    <h3 className="text-base font-semibold">Sala collegata · Solo in italiano</h3>
    {loading ? <p role="status" className="text-sm">Aggiornamento disponibilità…</p> : rooms === null
      ? <p role="alert" className="text-sm">Disponibilità della sala collegata non verificata. Premi «Aggiorna conteggi» per riprovare.</p>
      : rooms.map(room => <div key={room.panelId} className="grid gap-2">
        <p className="break-words font-semibold">{room.room ?? room.title}</p>
        <p className="text-sm text-[var(--peace-muted)]">{room.entered} entrati / {room.booked === null ? "prenotazioni non disponibili" : `${room.booked} prenotazioni`}</p>
        {room.capacity === null ? <p className="text-sm">Capienza della sala non disponibile.</p> : <>
          <p className="flex flex-wrap items-baseline gap-x-2"><strong className={`text-2xl tabular-nums ${room.entered >= room.capacity ? "text-amber-800" : "text-[var(--peace-blue-800)]"}`}>{Math.max(0,room.capacity-room.entered)}</strong><span>posti rimanenti</span></p>
          <p className="text-sm text-[var(--peace-muted)]">Capienza {room.capacity}</p>
          {room.entered >= room.capacity && <p className="text-sm font-semibold text-amber-800">Capienza raggiunta</p>}
        </>}
      </div>)}
    {!loading && rooms !== null && rooms.length > 0 && <p className="text-xs text-[var(--peace-muted)]">Calcolati sugli ingressi registrati nella sala collegata. L’ingresso richiede una prenotazione valida per quella sala.</p>}
  </section>;
}

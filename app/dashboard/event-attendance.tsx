"use client";

import { createContext, memo, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { ReceptionOperationalReport } from "./reception-operational-report";
import { EventAttendanceStore } from "@/lib/reception/attendance-store";

const fallback = new EventAttendanceStore(null);
const AttendanceContext = createContext(fallback);
const formatter = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" });
const date = (value: string) => formatter.format(new Date(value));

export function EventAttendanceProvider({ eventId, summaryOnly = false, children }: {
  eventId: string | null; summaryOnly?: boolean; children: ReactNode;
}) {
  const store = useMemo(() => new EventAttendanceStore(eventId, summaryOnly), [eventId, summaryOnly]);
  useEffect(() => store.start(), [store]);
  return <AttendanceContext.Provider value={store}>
    <AttendanceStatus />
    {children}
  </AttendanceContext.Provider>;
}

function useAttendanceValue<T>(select: (state: ReturnType<EventAttendanceStore["snapshot"]>) => T) {
  const store = useContext(AttendanceContext);
  return useSyncExternalStore(store.subscribe, () => select(store.snapshot()), () => select(store.serverSnapshot()));
}

function AttendanceStatus() {
  const store = useContext(AttendanceContext);
  const current = useSyncExternalStore(store.subscribe, store.snapshot, store.serverSnapshot);
  return <div className="my-3 flex flex-wrap items-center gap-3 text-sm text-[var(--peace-muted)]">
    <p role="status">{!store.eventId ? "Nessun evento disponibile." : current.error ? "Presenze non disponibili. Verifica la connessione e l’accesso." : current.data ? `Ingressi evento aggiornati il ${date(current.data.updatedAt)}${store.summaryOnly ? "." : " · controllo automatico ogni 15 minuti."}` : "Caricamento ingressi evento…"}</p>
    {store.eventId && (!store.summaryOnly || current.error) && <button type="button" className="btn-secondary min-h-11 px-3" disabled={current.refreshing} aria-busy={current.refreshing} onClick={store.refresh}>{current.error ? "Riprova" : "Aggiorna presenze"}</button>}
  </div>;
}

export const EventPresence = memo(function EventPresence({ eventId, registrationId, childId, inactive = false }: {
  eventId: string; registrationId: string; childId?: string; inactive?: boolean;
}) {
  const value = useAttendanceValue(({ data, error }) => inactive ? "inactive" : data?.eventId === eventId ? data.entries[`${registrationId}:${childId ?? "adult"}`] ?? null : error ? "error" : "loading");
  if (value === "inactive") return <span className="block text-xs leading-5 text-[var(--peace-muted)]">Iscrizione non operativa</span>;
  const at = value && value !== "error" && value !== "loading" ? value : null;
  const text = value === "error" ? "Partecipazione non disponibile" : value === "loading" ? "Partecipazione da verificare…" : at ? `Partecipazione confermata · ${date(at)}` : "Partecipazione non confermata";
  return <span className={`block text-xs leading-5 ${at ? "font-semibold text-green-800" : "text-[var(--peace-muted)]"}`}>{text}</span>;
});

export const SchoolEventPresence = memo(function SchoolEventPresence({ eventId, bookingId, inactive = false }: { eventId: string; bookingId: string; inactive?: boolean }) {
  const value = useAttendanceValue(({ data, error }) => inactive ? "inactive" : data?.eventId === eventId ? data.schoolEntries[bookingId] ?? null : error ? "error" : "loading");
  if (value === "inactive") return <span className="block text-xs leading-5 text-[var(--peace-muted)]">Prenotazione non operativa</span>;
  const entry = value && typeof value === "object" ? value : null;
  return <span className={`block text-xs leading-5 ${entry ? "font-semibold text-green-800" : "text-[var(--peace-muted)]"}`}>
    {value === "error" ? "Presenza non disponibile" : value === "loading" ? "Presenza da verificare…" : entry ? <>
      <span className="block">Ingresso registrato · {date(entry.checkedInAt)}</span>
      <span className="block">{entry.students} studenti · {entry.companions} accompagnatori presenti</span>
    </> : "Ingresso non registrato"}
  </span>;
});

function AttendanceTotals() {
  const t = useAttendanceValue(({ data }) => data?.totals);
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
    {([
      ["Persone entrate", t?.people], ["Adulti iscritti", t?.adults], ["Minori accompagnati", t?.children],
      ["Studenti delle scuole", t?.students], ["Accompagnatori scuole", t?.companions], ["Classi / gruppi scuola entrati", t?.schoolBookings],
    ] as const).map(([label, count]) => <div key={label} className="rounded-lg border border-[var(--peace-border)] p-3"><p className="text-sm">{label}</p><p className="text-2xl font-semibold">{count ?? "—"}</p></div>)}
  </div>;
}
export function EventAttendanceReport({ eventId }: { eventId: string | null }) {
  return <article className="surface-card min-w-0 p-5">
    <p className="text-sm text-[var(--peace-muted)]">Totali dell’intero evento: persone con ingresso registrato all’accoglienza, al netto degli annullamenti. I giorni previsti e le prenotazioni ai panel restano separati. Non indica quante persone sono ancora sul posto.</p>
    <EventAttendanceProvider key={eventId} eventId={eventId} summaryOnly><AttendanceTotals /></EventAttendanceProvider>
    <ReceptionOperationalReport eventId={eventId} />
  </article>;
}

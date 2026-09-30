"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AttendanceSnapshot } from "@/lib/reception/attendance.server";

type AttendanceState = { data: AttendanceSnapshot | null; error: boolean };
const AttendanceContext = createContext<AttendanceState>({ data: null, error: false });
const date = (value: string) => new Date(value).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" });

export function EventAttendanceProvider({ eventId, summaryOnly = false, children }: {
  eventId: string | null; summaryOnly?: boolean; children: ReactNode;
}) {
  const [state, setState] = useState<AttendanceState>({ data: null, error: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!eventId) return;
    let disposed = false;
    let busy = false;
    let blocked = false;
    let controller: AbortController | null = null;
    async function refresh() {
      if (document.hidden || busy || blocked) return;
      busy = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 15000);
      try {
        const response = await fetch(`/dashboard/attendance?eventId=${encodeURIComponent(eventId!)}${summaryOnly ? "&summary=1" : ""}`, { cache: "no-store", signal: controller.signal });
        if (response.redirected || response.status === 401 || response.status === 403) blocked = true;
        if (response.redirected || !response.ok) throw new Error("unavailable");
        const data: AttendanceSnapshot = await response.json();
        if (data.eventId !== eventId || !data.entries || !data.schoolEntries || !data.totals || !Number.isFinite(Date.parse(data.updatedAt))) throw new Error("invalid");
        if (!disposed) setState({ data, error: false });
      } catch {
        // Never display an old presence or turn a failed read into an absence.
        if (!disposed) setState({ data: null, error: true });
      } finally { clearTimeout(timeout); busy = false; }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    const visible = () => void refresh();
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", visible);
    return () => { disposed = true; clearInterval(timer); controller?.abort(); document.removeEventListener("visibilitychange", visible); window.removeEventListener("online", visible); };
  }, [eventId, summaryOnly, attempt]);
  const current = state.data?.eventId === eventId ? state : { data: null, error: state.error };
  return <AttendanceContext.Provider value={current}>
    <div className="my-3 flex flex-wrap items-center gap-3 text-sm text-[var(--peace-muted)]">
      <p role="status">{!eventId ? "Nessun evento disponibile." : current.error ? "Presenze non disponibili. Verifica la connessione e l’accesso." : current.data ? `Ingressi evento aggiornati il ${date(current.data.updatedAt)} · aggiornamento automatico ogni 10 secondi.` : "Caricamento ingressi evento…"}</p>
      {current.error && <button type="button" className="btn-secondary min-h-11 px-3" onClick={() => setAttempt(n => n + 1)}>Riprova</button>}
    </div>
    {children}
  </AttendanceContext.Provider>;
}

export function EventPresence({ eventId, registrationId, childId, inactive = false }: { eventId: string; registrationId: string; childId?: string; inactive?: boolean }) {
  const { data, error } = useContext(AttendanceContext);
  if (inactive) return <span className="block text-xs leading-5 text-[var(--peace-muted)]">Iscrizione non operativa</span>;
  const loaded = data?.eventId === eventId;
  const at = loaded ? data.entries[`${registrationId}:${childId ?? "adult"}`] : null;
  return <span className={`block text-xs leading-5 ${at ? "font-semibold text-green-800" : "text-[var(--peace-muted)]"}`}>
    {!loaded ? (error ? "Presenza non disponibile" : "Presenza da verificare…") : at ? `Ingresso registrato · ${date(at)}` : "Ingresso non registrato"}
  </span>;
}

export function SchoolEventPresence({ eventId, bookingId, inactive = false }: { eventId: string; bookingId: string; inactive?: boolean }) {
  const { data, error } = useContext(AttendanceContext);
  if (inactive) return <span className="block text-xs leading-5 text-[var(--peace-muted)]">Prenotazione non operativa</span>;
  const loaded = data?.eventId === eventId;
  const entry = loaded ? data.schoolEntries[bookingId] : null;
  return <span className={`block text-xs leading-5 ${entry ? "font-semibold text-green-800" : "text-[var(--peace-muted)]"}`}>
    {!loaded ? (error ? "Presenza non disponibile" : "Presenza da verificare…") : entry ? <>
      <span className="block">Ingresso registrato · {date(entry.checkedInAt)}</span>
      <span className="block">{entry.students} studenti · {entry.companions} accompagnatori presenti</span>
    </> : "Ingresso non registrato"}
  </span>;
}

function AttendanceTotals() {
  const { data } = useContext(AttendanceContext);
  const t = data?.totals;
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
    {([
      ["Persone entrate", t?.people], ["Adulti iscritti", t?.adults], ["Minori accompagnati", t?.children],
      ["Studenti delle scuole", t?.students], ["Accompagnatori scuole", t?.companions], ["Classi / gruppi scuola entrati", t?.schoolBookings],
    ] as const).map(([label, count]) => <div key={label} className="rounded-lg border border-[var(--peace-border)] p-3"><p className="text-sm">{label}</p><p className="text-2xl font-semibold">{count ?? "—"}</p></div>)}
  </div>;
}
export function EventAttendanceReport({ eventId }: { eventId: string | null }) {
  return <article className="surface-card p-5"><h2 className="text-xl font-semibold">Ingressi effettivi all’evento</h2>
    <p className="mt-2 text-sm text-[var(--peace-muted)]">Totali dell’intero evento: persone con ingresso registrato all’accoglienza, al netto degli annullamenti. I giorni previsti e le prenotazioni ai panel restano separati. Non indica quante persone sono ancora sul posto.</p>
    <EventAttendanceProvider key={eventId} eventId={eventId} summaryOnly><AttendanceTotals /></EventAttendanceProvider>
  </article>;
}

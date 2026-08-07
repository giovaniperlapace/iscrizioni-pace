import Link from "next/link";
import { CalendarDays, MapPin, Plus, School, Search, X } from "lucide-react";

import { cancelSchoolBooking, saveSchoolBooking } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  filterSchoolBookings,
  SCHOOL_BOOKING_NOTES_MAX_LENGTH,
  SCHOOL_BOOKING_SEARCH_MAX_LENGTH,
  type SchoolBookingFilters,
  type SchoolBookingRow,
  type SchoolPanelOption,
} from "@/lib/panels/school-bookings";

type Props = {
  dashboard: "admin" | "manager";
  navMode: "full" | "mini";
  event: { id: string; title: string } | null;
  bookings: SchoolBookingRow[];
  panelOptions: SchoolPanelOption[];
  selectedBooking: SchoolBookingRow | null;
  isCreating: boolean;
  canManage: boolean;
  filters: SchoolBookingFilters;
  error?: string;
  saved?: string;
};

export function SchoolBookingsSection({ dashboard, navMode, event, bookings, panelOptions, selectedBooking, isCreating, canManage, filters, error, saved }: Props) {
  const filtered = filterSchoolBookings(bookings, filters);
  const closePath = schoolPath(dashboard, navMode, filters);
  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--peace-blue-700)]">Panel</p>
            <h2 className="mt-1 text-xl font-semibold">Prenotazioni scuole</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--peace-muted)]">
              Classi e docenti restano separati dalle iscrizioni individuali. I posti occupano soltanto le quote Scuole dei panel.
            </p>
          </div>
          {canManage && event ? (
            <Link href={`${closePath}&schoolTool=new`} scroll={false} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white hover:bg-[var(--peace-blue-900)]">
              <Plus className="size-4" aria-hidden="true" /> Nuova prenotazione
            </Link>
          ) : null}
        </div>
        <PanelTabs dashboard={dashboard} navMode={navMode} active="schools" />
        <SchoolStatus error={error} saved={saved} />
        {!canManage && event ? <p className="mt-5 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] px-4 py-3 text-sm text-[var(--peace-muted)]">Vista in sola lettura. Il manager viewer può consultare prenotazioni, docenti e quantità, ma non modificarli.</p> : null}
        {event ? (
          <form action={`/dashboard/${dashboard}`} method="get" className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_12rem_16rem_auto] xl:items-end">
            <input type="hidden" name="section" value="panel" />
            <input type="hidden" name="panelView" value="schools" />
            <input type="hidden" name="nav" value={navMode} />
            <label className="grid gap-1 text-sm font-semibold">Cerca<span className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--peace-muted)]" aria-hidden="true" /><input name="schoolQ" defaultValue={filters.query} maxLength={SCHOOL_BOOKING_SEARCH_MAX_LENGTH} className="field field-with-leading-icon w-full font-normal" placeholder="Scuola, città, docente o email" /></span></label>
            <label className="grid gap-1 text-sm font-semibold">Stato<select name="schoolStatus" defaultValue={filters.status} className="field font-normal"><option value="all">Tutti</option><option value="submitted">Da verificare</option><option value="confirmed">Confermata</option><option value="cancelled">Annullata</option></select></label>
            <label className="grid gap-1 text-sm font-semibold">Panel<select name="schoolPanel" defaultValue={filters.panelId} className="field font-normal"><option value="all">Tutti</option>{uniquePanels(panelOptions).map((panel) => <option key={panel.panelId} value={panel.panelId}>{panel.title}</option>)}</select></label>
            <div className="flex gap-2"><PendingSubmitButton className="min-h-11 rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-blue-800)]">Filtra</PendingSubmitButton>{hasFilters(filters) ? <Link href={schoolPath(dashboard, navMode)} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[var(--peace-blue-800)]">Azzera</Link> : null}</div>
          </form>
        ) : null}
        {!event ? <p className="mt-5 text-sm text-[var(--peace-muted)]">Nessun evento operativo corrente disponibile.</p> : <SchoolBookingTable rows={filtered} total={bookings.length} dashboard={dashboard} navMode={navMode} filters={filters} />}
      </div>
      {event && (isCreating || selectedBooking) ? <SchoolBookingOverlay dashboard={dashboard} navMode={navMode} event={event} booking={selectedBooking} panelOptions={panelOptions} canManage={canManage} closePath={closePath} /> : null}
    </section>
  );
}

export function PanelTabs({ dashboard, navMode, active }: { dashboard: "admin" | "manager"; navMode: "full" | "mini"; active: "panels" | "schools" | "locations" }) {
  const tabs = [
    { key: "locations", label: "Location", Icon: MapPin },
    { key: "panels", label: "Panel", Icon: CalendarDays },
    { key: "schools", label: "Scuole", Icon: School },
  ] as const;
  return <div className="mt-5 flex gap-1 overflow-x-auto border-b border-[var(--peace-border)]">{tabs.map(({ key, label, Icon }) => <Link key={key} href={`/dashboard/${dashboard}?section=panel&panelView=${key}&nav=${navMode}`} className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${active === key ? "border-[var(--peace-blue-800)] text-[var(--peace-blue-800)]" : "border-transparent text-[var(--peace-muted)] hover:text-[var(--peace-blue-800)]"}`}><Icon className="size-4" aria-hidden="true" />{label}</Link>)}</div>;
}

function SchoolBookingTable({ rows, total, dashboard, navMode, filters }: { rows: SchoolBookingRow[]; total: number; dashboard: "admin" | "manager"; navMode: "full" | "mini"; filters: SchoolBookingFilters }) {
  if (rows.length === 0) return <p className="mt-6 rounded-md border border-dashed border-[var(--peace-border-strong)] p-5 text-sm text-[var(--peace-muted)]">{total === 0 ? "Non ci sono ancora prenotazioni scuola." : "Nessuna prenotazione corrisponde ai filtri."}</p>;
  const base = schoolPath(dashboard, navMode, filters);
  return <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[58rem] text-left text-sm"><thead><tr className="border-b border-[var(--peace-border)] text-[var(--peace-muted)]"><th className="py-3 pr-4 font-semibold">Scuola / classe</th><th className="py-3 pr-4 font-semibold">Docente</th><th className="py-3 pr-4 font-semibold">Panel</th><th className="py-3 pr-4 font-semibold">Quantità</th><th className="py-3 pr-4 font-semibold">Stato</th><th className="py-3 text-right font-semibold"><span className="sr-only">Azioni</span></th></tr></thead><tbody>{rows.map((booking) => <tr key={booking.id} className="border-b border-[var(--peace-border)] align-top"><td className="py-4 pr-4"><p className="font-semibold">{booking.schoolName}</p><p className="text-[var(--peace-muted)]">{booking.classDescription} · {booking.schoolCity}</p></td><td className="py-4 pr-4"><p>{booking.teacher.firstName} {booking.teacher.lastName}</p><p className="text-[var(--peace-muted)]">{booking.teacher.email}</p></td><td className="py-4 pr-4"><p>{booking.reservations.filter((row) => row.status === "reserved").map((row) => row.title).join(", ") || "Nessuno"}</p></td><td className="py-4 pr-4">{booking.studentCount} studenti<br />{booking.companionCount} accompagnatori</td><td className="py-4 pr-4"><StatusBadge status={booking.status} /></td><td className="py-4 text-right"><Link href={`${base}&schoolId=${booking.id}`} scroll={false} className="inline-flex min-h-10 items-center rounded-md border border-[var(--peace-border-strong)] px-3 font-semibold text-[var(--peace-blue-800)]">Apri</Link></td></tr>)}</tbody></table></div>;
}

function SchoolBookingOverlay({ dashboard, navMode, event, booking, panelOptions, canManage, closePath }: { dashboard: "admin" | "manager"; navMode: "full" | "mini"; event: { id: string; title: string }; booking: SchoolBookingRow | null; panelOptions: SchoolPanelOption[]; canManage: boolean; closePath: string }) {
  const reservations = new Map((booking?.reservations ?? []).filter((row) => row.status === "reserved").map((row) => [row.sectionId, row]));
  return <div className="fixed inset-0 z-50 grid place-items-end bg-[#0c2947]/45 p-0 sm:place-items-center sm:p-5"><div role="dialog" aria-modal="true" aria-labelledby="school-booking-title" className="grid max-h-[100dvh] w-full max-w-4xl grid-rows-[auto_1fr] overflow-hidden bg-white shadow-2xl sm:max-h-[92dvh] sm:rounded-xl"><header className="flex items-start justify-between gap-4 border-b border-[var(--peace-border)] px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--peace-blue-700)]">{event.title}</p><h2 id="school-booking-title" className="mt-1 text-xl font-semibold">{booking ? "Scheda prenotazione scuola" : "Nuova prenotazione scuola"}</h2></div><Link href={closePath} scroll={false} aria-label="Chiudi" className="grid min-h-10 min-w-10 place-items-center rounded-md border border-[var(--peace-border)]"><X className="size-5" aria-hidden="true" /></Link></header><form action={saveSchoolBooking} className="grid overflow-y-auto" data-preserve-dashboard-scroll><input type="hidden" name="sourceDashboard" value={dashboard} /><input type="hidden" name="nav" value={navMode} /><input type="hidden" name="eventId" value={event.id} />{booking ? <input type="hidden" name="bookingId" value={booking.id} /> : null}<div className="grid gap-6 p-5"><fieldset disabled={!canManage || booking?.status === "cancelled"} className="grid gap-5"><div className="grid gap-4 md:grid-cols-2"><Field label="Scuola" name="schoolName" defaultValue={booking?.schoolName} maxLength={180} /><Field label="Città" name="schoolCity" defaultValue={booking?.schoolCity} maxLength={120} /><Field label="Classe o descrizione gruppo" name="classDescription" defaultValue={booking?.classDescription} maxLength={180} wide /><Field label="Nome docente" name="teacherFirstName" defaultValue={booking?.teacher.firstName} maxLength={120} /><Field label="Cognome docente" name="teacherLastName" defaultValue={booking?.teacher.lastName} maxLength={120} /><Field label="Email docente" name="teacherEmail" defaultValue={booking?.teacher.email} type="email" maxLength={320} /><Field label="Telefono docente" name="teacherPhone" defaultValue={booking?.teacher.phone} type="tel" maxLength={40} /><Field label="Studenti del gruppo" name="studentCount" defaultValue={booking?.studentCount ?? 1} type="number" min={1} max={1000} /><Field label="Accompagnatori" name="companionCount" defaultValue={booking?.companionCount ?? 1} type="number" min={1} max={100} /><label className="grid gap-1 text-sm font-semibold">Stato<select name="status" defaultValue={booking?.status === "submitted" ? "submitted" : "confirmed"} className="field font-normal"><option value="submitted">Da verificare</option><option value="confirmed">Confermata</option></select></label></div><fieldset className="grid gap-3"><legend className="text-sm font-semibold">Panel e posti riservati</legend><p className="text-sm text-[var(--peace-muted)]">Seleziona almeno un panel. Le quantità possono essere ridotte per un singolo momento, ma non superare il totale del gruppo.</p>{panelOptions.length === 0 ? <p className="rounded-md border border-dashed border-[var(--peace-border-strong)] p-4 text-sm text-[var(--peace-muted)]">Non ci sono panel pubblicati con una quota Scuole.</p> : panelOptions.map((option) => { const row = reservations.get(option.sectionId); return <div key={option.sectionId} className="grid gap-3 rounded-md border border-[var(--peace-border)] p-4 md:grid-cols-[minmax(0,1fr)_8rem_8rem] md:items-end"><label className="flex gap-3"><input type="checkbox" name="sectionIds" value={option.sectionId} defaultChecked={Boolean(row)} className="mt-1 size-4" /><span><span className="block font-semibold">{option.title}</span><span className="block text-sm text-[var(--peace-muted)]">{formatSchedule(option)} · {option.locationName} · quota {option.audienceName}</span></span></label><input type="hidden" name={`panelId:${option.sectionId}`} value={option.panelId} /><Field label="Studenti" name={`students:${option.sectionId}`} defaultValue={row?.studentCount ?? booking?.studentCount ?? 1} type="number" min={1} max={1000} /><Field label="Accompagnatori" name={`companions:${option.sectionId}`} defaultValue={row?.companionCount ?? booking?.companionCount ?? 1} type="number" min={1} max={100} /></div>; })}</fieldset><label className="grid gap-1 text-sm font-semibold">Note interne<textarea name="internalNotes" defaultValue={booking?.internalNotes ?? ""} maxLength={SCHOOL_BOOKING_NOTES_MAX_LENGTH} rows={4} className="field min-h-28 font-normal" /><span className="text-xs font-normal text-[var(--peace-muted)]">Massimo {SCHOOL_BOOKING_NOTES_MAX_LENGTH} caratteri. Non inserire nomi o dati degli studenti.</span></label>{!booking ? <label className="flex gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4 text-sm"><input type="checkbox" name="privacyAccepted" value="yes" required className="mt-1 size-4" /><span>Confermo che il docente ha accettato l’informativa privacy prevista per la prenotazione scuola. L’app non raccoglie i nomi degli studenti.</span></label> : <p className="text-sm text-[var(--peace-muted)]">Consenso registrato: {formatDateTime(booking.privacyAcceptedAt)} · versione {booking.privacyVersion}. QR gruppo: {booking.hasActiveQr ? "attivo" : "non attivo"}.</p>}</fieldset></div><footer className="flex flex-wrap justify-between gap-3 border-t border-[var(--peace-border)] px-5 py-4"><div>{booking && booking.status !== "cancelled" && canManage ? <PendingSubmitButton formAction={cancelSchoolBooking} name="bookingId" value={booking.id} pendingLabel="Annullamento…" className="min-h-11 rounded-md border border-[#cf9b8e] px-4 text-sm font-semibold text-[#8a3323]">Annulla prenotazione</PendingSubmitButton> : null}</div><div className="flex gap-3"><Link href={closePath} className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold">Chiudi</Link>{canManage && booking?.status !== "cancelled" ? <PendingSubmitButton pendingLabel="Salvataggio…" className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white">Salva</PendingSubmitButton> : null}</div></footer></form></div></div>;
}

function Field({ label, name, defaultValue, type = "text", maxLength, min, max, wide = false }: { label: string; name: string; defaultValue?: string | number; type?: string; maxLength?: number; min?: number; max?: number; wide?: boolean }) { return <label className={`grid gap-1 text-sm font-semibold ${wide ? "md:col-span-2" : ""}`}>{label}<input required name={name} defaultValue={defaultValue} type={type} maxLength={maxLength} min={min} max={max} className="field font-normal" /></label>; }
function StatusBadge({ status }: { status: SchoolBookingRow["status"] }) { const labels = { draft: "Bozza", submitted: "Da verificare", confirmed: "Confermata", cancelled: "Annullata" }; return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status === "confirmed" ? "bg-[#e8f6e8] text-[#27613a]" : status === "cancelled" ? "bg-[#fff0eb] text-[#8a3323]" : "bg-[var(--peace-sky-100)] text-[var(--peace-blue-800)]"}`}>{labels[status]}</span>; }
function SchoolStatus({ error, saved }: { error?: string; saved?: string }) { const errors: Record<string, string> = { invalid: "Controlla dati, quantità e panel selezionati.", forbidden: "Non hai i permessi per modificare questa prenotazione.", overlap: "I panel scelti si sovrappongono.", capacity: "La quota Scuole di almeno un panel non ha posti sufficienti." }; const savedLabels: Record<string, string> = { created: "Prenotazione scuola creata e QR gruppo generato.", updated: "Prenotazione scuola aggiornata.", cancelled: "Prenotazione scuola annullata e posti liberati." }; if (!error && !saved) return null; return <p role="status" className={`mt-5 rounded-md border px-4 py-3 text-sm ${error ? "border-[#d9a99d] bg-[#fff0eb] text-[#7f2f20]" : "border-[#a9d5b1] bg-[#eef9ef] text-[#255b34]"}`}>{error ? errors[error] ?? "Operazione non riuscita." : savedLabels[saved ?? ""] ?? "Operazione completata."}</p>; }
function uniquePanels(options: SchoolPanelOption[]) { return [...new Map(options.map((row) => [row.panelId, row])).values()]; }
function formatSchedule(row: SchoolPanelOption) { return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(row.startsAt)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(value)); }
function hasFilters(filters: SchoolBookingFilters) { return Boolean(filters.query || filters.status !== "all" || filters.panelId !== "all"); }
function schoolPath(dashboard: "admin" | "manager", navMode: "full" | "mini", filters?: SchoolBookingFilters) { const params = new URLSearchParams({ section: "panel", panelView: "schools", nav: navMode }); if (filters?.query) params.set("schoolQ", filters.query); if (filters && filters.status !== "all") params.set("schoolStatus", filters.status); if (filters && filters.panelId !== "all") params.set("schoolPanel", filters.panelId); return `/dashboard/${dashboard}?${params.toString()}`; }

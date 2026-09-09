"use client";

import { useRef, useState, useTransition } from "react";
import { CalendarDays, RefreshCw, UserMinus, UserPlus, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/lib/i18n/config";
import { GROUP_BOOKING_COPY } from "@/lib/panels/group-booking-copy";
import { filterGroupPanelParticipants, type GroupBookingResult, type GroupPanelView } from "@/lib/panels/group-bookings";
import { setGroupPanelBooking } from "./actions";

export function GroupPanelBookings({view, sectionId, locale}: {view: GroupPanelView; sectionId: string | null; locale: SupportedLocale}) {
  const router = useRouter();
  const copy = GROUP_BOOKING_COPY[locale];
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [result, setResult] = useState<{registrationId: string; booked: boolean; response: GroupBookingResult} | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const panel = view.panels.find(p => p.sectionId === sectionId);
  const visible = filterGroupPanelParticipants(view.participants, query, group);
  const groups = [...new Map(view.participants.map(p => [p.groupId, p.groupName])).entries()].sort((a,b) => a[1].localeCompare(b[1], locale));
  const dateFormat = new Intl.DateTimeFormat(locale, {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome"});
  const timeFormat = new Intl.DateTimeFormat(locale, {hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome"});
  function submit(registrationId: string, booked: boolean) {
    if (!panel || pending || inFlight.current) return;
    inFlight.current = true;
    setActiveId(registrationId);
    setResult(null);
    startTransition(async () => {
      try {
        const response = await setGroupPanelBooking(panel.sectionId, registrationId, booked);
        setResult({registrationId, booked, response});
        router.refresh();
      } catch {
        setResult({registrationId, booked, response: {error: "failure"}});
        router.refresh();
      } finally { inFlight.current = false; setActiveId(null); }
    });
  }
  const buttonClass = "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60";
  return <div className="grid min-w-0 gap-5" aria-busy={pending}>
    <div className="surface-panel grid gap-3 p-5">
      <label className="flex items-center gap-2 text-sm font-semibold text-[var(--peace-blue-900)]" htmlFor="group-panel"><CalendarDays size={18} aria-hidden="true" />{copy.panel}</label>
      <select id="group-panel" className="field w-full min-w-0" value={sectionId ?? ""} disabled={pending} onChange={e => {
        const value = e.target.value;
        startTransition(() => router.push(value ? `/dashboard/capogruppo/panel?section=${encodeURIComponent(value)}` : "/dashboard/capogruppo/panel"));
      }}>
        <option value="">{copy.choose}</option>
        {view.panels.map(p => <option key={p.sectionId} value={p.sectionId}>{p.title} · {dateFormat.format(new Date(p.startsAt))}–{timeFormat.format(new Date(p.endsAt))} · {p.location} · {p.audience}</option>)}
      </select>
      {!view.panels.length ? <p>{copy.emptyPanels}</p> : null}
      {panel ? <div className="flex items-center justify-start gap-3 border-t border-[var(--peace-border)] pt-3 text-sm">
        <strong className="rounded-full bg-[var(--peace-sky-100)] px-3 py-1.5 text-[var(--peace-blue-800)]">{copy.remaining}: {panel.remaining}</strong>
      </div> : null}
    </div>
    {panel ? <>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">{copy.search}<input className="field" value={query} onChange={e => setQuery(e.target.value)} disabled={pending} type="search" /></label>
          <label className="grid gap-1 text-sm font-semibold">{copy.group}<select className="field" value={group} onChange={e => setGroup(e.target.value)} disabled={pending}><option value="">{copy.allGroups}</option>{groups.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        </div>
        <div className="surface-panel min-w-0 overflow-x-auto overscroll-x-contain">
          <table className="w-full text-left text-sm"><caption className="sr-only">{copy.title} · {panel.title}</caption>
            <thead><tr className="border-b border-[var(--peace-border)] bg-[var(--peace-soft)] text-[var(--peace-blue-900)]">
              {[copy.person, copy.group, copy.seats, copy.status, copy.action].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead>
            <tbody>{visible.map(row => {
              const booked = row.status === "selected";
              const blocked = row.status === "conflict" || row.status === "full";
              const feedback = result?.registrationId === row.registrationId ? result : null;
              return <tr key={row.registrationId} className="border-b border-[var(--peace-border)] last:border-0 hover:bg-[var(--peace-soft)]">
                <th scope="row" className="p-3 font-medium">{row.name}{row.code ? <span className="block text-xs font-normal text-[var(--peace-muted)]">{row.code}</span> : null}</th>
                <td className="p-3">{row.groupName}</td><td className="p-3">{row.seats}</td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${booked ? "bg-green-100 text-green-900" : "bg-slate-100 text-slate-700"}`}>
                    {booked ? <CheckCircle2 size={14} aria-hidden="true" /> : null}{booked ? copy.selected : copy.notBooked}
                  </span>
                  {blocked ? <span id={`reason-${row.registrationId}`} className="mt-1 block text-xs text-amber-800">{copy[row.status]}</span> : null}
                </td>
                <td className="p-3">
                  <button type="button" className={`${booked ? "btn-secondary" : "btn-primary"} ${buttonClass} whitespace-nowrap`}
                    aria-label={`${booked ? copy.unbook : copy.book}: ${row.name}`}
                    aria-describedby={blocked ? `reason-${row.registrationId}` : undefined}
                    disabled={pending || blocked} onClick={() => submit(row.registrationId, !booked)}>
                    {booked ? <UserMinus size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
                    {pending && activeId === row.registrationId ? copy.pending : booked ? copy.unbook : copy.book}
                  </button>
                  {feedback ? <p role={"error" in feedback.response ? "alert" : "status"} className={`mt-2 max-w-xs text-xs ${"error" in feedback.response ? "text-red-800" : "text-green-800"}`}>
                    {"error" in feedback.response ? copy[feedback.response.error] : feedback.booked ? copy.success : copy.removed}
                  </p> : null}
                </td>
              </tr>;
            })}</tbody>
          </table>
          {!visible.length ? <p className="p-5">{copy.emptyPeople}</p> : null}
        </div>
        <section className="surface-panel grid gap-3 p-5">
          <p className="text-sm text-[var(--peace-muted)]">{copy.family}</p>
          <div className="mt-1 flex flex-col items-start gap-3 border-t border-[var(--peace-border)] pt-4 sm:flex-row sm:items-center sm:gap-4">
            <button type="button" className={`btn-secondary shrink-0 ${buttonClass}`} aria-describedby="group-panel-refresh-help" disabled={pending} onClick={() => {setResult(null); startTransition(() => router.refresh());}}><RefreshCw size={16} aria-hidden="true" />{copy.refresh}</button>
            <p id="group-panel-refresh-help" className="max-w-xl text-sm leading-6 text-[var(--peace-muted)]">{copy.refreshHelp}</p>
          </div>
        </section>
    </> : null}
  </div>;
}

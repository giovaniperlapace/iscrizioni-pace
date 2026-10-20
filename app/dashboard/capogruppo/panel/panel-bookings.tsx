"use client";
import { ForumChildSelection } from "@/components/forum-child-selection";
import { FORUM_CHILD_COPY } from "@/lib/panels/child-selection";

import { ForumLanguages } from "@/components/forum-languages";
import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarDays, RefreshCw, UserMinus, UserPlus, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/lib/i18n/config";
import { GROUP_BOOKING_COPY } from "@/lib/panels/group-booking-copy";
import { filterGroupPanelParticipants, type GroupBookingResult, type GroupWaitlistIntent, type GroupPanelView } from "@/lib/panels/group-bookings";
import { GROUP_WAITLIST_COPY } from "@/lib/panels/group-waitlist-copy";
import { FORUM_WAITLIST_COPY } from "@/lib/panels/waitlist-copy";
import { useGroupForumAvailability } from "@/lib/panels/use-group-forum-availability";
import { setGroupPanelBooking, setGroupPanelWaitlist } from "./actions";

export function GroupPanelBookings({view: initialView, sectionId, locale}: {view: GroupPanelView; sectionId: string | null; locale: SupportedLocale}) {
  const router = useRouter();
  const queueCopy = GROUP_WAITLIST_COPY[locale];
  const sharedQueueCopy = FORUM_WAITLIST_COPY[locale];
  const copy = { ...GROUP_BOOKING_COPY[locale], queued: sharedQueueCopy.queued, offered: sharedQueueCopy.offered,
    expired: queueCopy.expired, availableNow: queueCopy.available };
  const [childDrafts, setChildDrafts] = useState<Record<string, string[]>>({});
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [result, setResult] = useState<{registrationId: string; response: GroupBookingResult} | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const { view, error: availabilityError } = useGroupForumAvailability(initialView, sectionId, pending);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const panel = view.panels.find(p => p.sectionId === sectionId);
  const visible = filterGroupPanelParticipants(view.participants, query, group);
  const groups = [...new Map(view.participants.map(p => [p.groupId, p.groupName])).entries()].sort((a,b) => a[1].localeCompare(b[1], locale));
  const dateFormat = new Intl.DateTimeFormat(locale, {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome"});
  const timeFormat = new Intl.DateTimeFormat(locale, {hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome"});
  function submit(registrationId: string, operation: boolean | GroupWaitlistIntent, waitlistSectionId?: string | null) {
    if (!panel || pending || inFlight.current) return;
    inFlight.current = true;
    setActiveId(registrationId);
    setResult(null);
    const selectedChildIds = childDrafts[`${panel.panelId}:${registrationId}`] ?? view.participants.find(row => row.registrationId === registrationId)?.children?.filter(c => c.selected).map(c => c.id) ?? [];
    startTransition(async () => {
      try {
        const response = typeof operation === "boolean"
          ? await setGroupPanelBooking(panel.sectionId, registrationId, operation, selectedChildIds)
          : await setGroupPanelWaitlist(waitlistSectionId ?? panel.sectionId, registrationId, operation, selectedChildIds);
        setResult("error" in response ? {registrationId, response} : null);
        router.refresh();
      } catch {
        setResult({registrationId, response: {error: "failure"}});
        router.refresh();
      } finally { inFlight.current = false; setActiveId(null); }
    });
  }
  const buttonClass = "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60";
  return <div className="grid min-w-0 gap-5" aria-busy={pending}>
    {availabilityError ? <p role="alert" className="text-sm text-red-800">{availabilityError === "forbidden" ? copy.scopeError : copy.loadError}</p> : null}
    <div className="surface-panel grid gap-3 p-5">
      <label className="flex items-center gap-2 text-sm font-semibold text-[var(--peace-blue-900)]" htmlFor="group-panel"><CalendarDays size={18} aria-hidden="true" />{copy.panel}</label>
      <select id="group-panel" className="field w-full min-w-0" value={sectionId ?? ""} disabled={pending} onChange={e => {
        const value = e.target.value;
        startTransition(() => router.push(value ? `/dashboard/capogruppo/panel?section=${encodeURIComponent(value)}` : "/dashboard/capogruppo/panel"));
      }}>
        <option value="">{copy.choose}</option>
        {view.panels.map(p => <option key={p.sectionId} value={p.sectionId}>{p.title} · {dateFormat.format(new Date(p.startsAt))}–{timeFormat.format(new Date(p.endsAt))} · {p.location} · {p.audience}</option>)}
      </select>
      {panel ? <ForumLanguages panelId={panel.panelId} locale={locale} /> : null}
      {!view.panels.length ? <p>{copy.emptyPanels}</p> : null}
      {panel ? <div className="flex items-center justify-start gap-3 border-t border-[var(--peace-border)] pt-3 text-sm">
        <strong className="rounded-full bg-[var(--peace-sky-100)] px-3 py-1.5 text-[var(--peace-blue-800)]">{copy.remaining}: {panel.remaining}</strong>
      </div> : null}
    </div>
    {panel ? <>
        <div className="surface-panel grid gap-2 p-5 text-sm leading-6"><p>{queueCopy.rule}</p><p>{queueCopy.help}</p></div>
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

              const expired = row.status === "offered" && !!row.offerExpiresAt && now !== null && new Date(row.offerExpiresAt).getTime() <= now;
              const queued = row.status === "queued" || row.status === "offered";
              const childKey = `${panel.panelId}:${row.registrationId}`;
              const childIds = booked || queued ? (row.children ?? []).filter(c => c.selected).map(c => c.id) : childDrafts[childKey] ?? (row.children ?? []).filter(c => c.selected).map(c => c.id);
              const full = row.status === "full" || row.hasWaiting || 1 + childIds.length > panel.remaining;
              const blocked = (row.hasConflict || row.status === "conflict") && !full;
              const operation = booked ? false : row.status === "queued" ? "leave" : row.status === "offered" ? "accept" : full ? "join" : true;
              const action = booked ? copy.unbook : row.status === "queued" ? queueCopy.leave : row.status === "offered" ? queueCopy.accept : full ? queueCopy.join : copy.book;
              const feedback = result?.registrationId === row.registrationId ? result : null;
              return <tr key={row.registrationId} className="border-b border-[var(--peace-border)] last:border-0 hover:bg-[var(--peace-soft)]">
                <th scope="row" className="p-3 font-medium">{row.name}{row.code ? <span className="block text-xs font-normal text-[var(--peace-muted)]">{row.code}</span> : null}
                  <ForumChildSelection options={row.children ?? []} selected={childIds} locale={locale} locked={booked || queued} disabled={pending}
                    onChange={ids => setChildDrafts(old => ({...old, [childKey]: ids}))} />
                </th>
                <td className="p-3">{row.groupName}</td><td className="p-3">{booked || queued ? row.seats : 1 + childIds.length}</td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${booked ? "bg-green-100 text-green-900" : "bg-slate-100 text-slate-700"}`}>
                    {booked ? <CheckCircle2 size={14} aria-hidden="true" /> : null}{booked ? copy.selected : queued ? copy[row.status] : copy.notBooked}
                  </span>
                  {queued && row.waitlistSectionId !== sectionId && row.waitlistAudience ? <span className="mt-1 block text-xs">{row.waitlistAudience}</span> : null}
                  {row.queuePosition != null ? <span className="mt-1 block text-xs">{sharedQueueCopy.position}: {row.queuePosition}</span> : null}
                  {row.offerExpiresAt ? <span className="mt-1 block text-xs">{sharedQueueCopy.deadline}: {dateFormat.format(new Date(row.offerExpiresAt))} (Europe/Rome)</span> : null}
                  {expired ? <span role="status" className="mt-1 block text-xs text-amber-800">{queueCopy.expired}</span> : null}
                  {blocked || row.status === "full" ? <span id={`reason-${row.registrationId}`} className="mt-1 block text-xs text-amber-800">{copy[row.status]}</span> : null}
                </td>
                <td className="p-3">
                  {row.status === "offered" ? <p id={`swap-${row.registrationId}`} className="mb-2 max-w-sm text-xs leading-5">{queueCopy.swap}</p> : null}
                  <button type="button" className={`${booked ? "btn-secondary" : "btn-primary"} ${buttonClass} whitespace-nowrap`}
                    aria-label={`${action}: ${row.name}`}
                    aria-describedby={blocked ? `reason-${row.registrationId}` : row.status === "offered" ? `swap-${row.registrationId}` : undefined}
                    disabled={pending || blocked || expired || !!availabilityError} onClick={() => submit(row.registrationId, operation, queued ? row.waitlistSectionId : null)}>
                    {booked ? <UserMinus size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
                    {pending && activeId === row.registrationId ? copy.pending : action}
                  </button>
                  {row.status === "offered" ? <button type="button" className={`btn-secondary mt-2 sm:ml-2 ${buttonClass}`} disabled={pending || !!availabilityError} onClick={() => submit(row.registrationId, "leave", row.waitlistSectionId)} aria-label={`${queueCopy.leave}: ${row.name}`}>{queueCopy.leave}</button> : null}
                  {feedback ? <p role={"error" in feedback.response ? "alert" : "status"} className={`mt-2 max-w-xs text-xs ${"error" in feedback.response ? "text-red-800" : "text-green-800"}`}>
                    {"error" in feedback.response ? copy[feedback.response.error] : ""}
                  </p> : null}
                </td>
              </tr>;
            })}</tbody>
          </table>
          {!visible.length ? <p className="p-5">{copy.emptyPeople}</p> : null}
        </div>
        <section className="surface-panel grid gap-3 p-5">
          <p className="text-sm text-[var(--peace-muted)]">{FORUM_CHILD_COPY[locale].help}</p>
          <div className="mt-1 flex flex-col items-start gap-3 border-t border-[var(--peace-border)] pt-4 sm:flex-row sm:items-center sm:gap-4">
            <button type="button" className={`btn-secondary shrink-0 ${buttonClass}`} aria-describedby="group-panel-refresh-help" disabled={pending} onClick={() => {setResult(null); startTransition(() => router.refresh());}}><RefreshCw size={16} aria-hidden="true" />{copy.refresh}</button>
            <p id="group-panel-refresh-help" className="max-w-xl text-sm leading-6 text-[var(--peace-muted)]">{copy.refreshHelp}</p>
          </div>
        </section>
    </> : null}
  </div>;
}

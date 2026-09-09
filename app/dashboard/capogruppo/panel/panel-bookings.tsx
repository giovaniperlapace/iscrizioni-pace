"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/lib/i18n/config";
import { GROUP_BOOKING_COPY } from "@/lib/panels/group-booking-copy";
import { filterGroupPanelParticipants, toggleVisiblePanelSelection, type GroupBookingResult, type GroupPanelView } from "@/lib/panels/group-bookings";
import { bookGroupPanel } from "./actions";

export function GroupPanelBookings({view, sectionId, locale}: {view: GroupPanelView; sectionId: string | null; locale: SupportedLocale}) {
  const router = useRouter();
  const copy = GROUP_BOOKING_COPY[locale];
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [review, setReview] = useState(false);
  const [result, setResult] = useState<GroupBookingResult | null>(null);
  const [pending, startTransition] = useTransition();
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const panel = view.panels.find(p => p.sectionId === sectionId);
  const visible = filterGroupPanelParticipants(view.participants, query, group);
  const eligible = visible.filter(row => row.status === "available");
  const checked = new Set(selected);
  const selectedRows = view.participants.filter(row => checked.has(row.registrationId));
  const totalSeats = selectedRows.reduce((sum, row) => sum + row.seats, 0);
  const overCapacity = Boolean(panel && totalSeats > panel.remaining);
  const groups = [...new Map(view.participants.map(p => [p.groupId, p.groupName])).entries()].sort((a,b) => a[1].localeCompare(b[1], locale));
  const dateFormat = new Intl.DateTimeFormat(locale, {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome"});
  const timeFormat = new Intl.DateTimeFormat(locale, {hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome"});
  function submit() {
    if (!panel || !selected.length || pending) return;
    setResult(null);
    startTransition(async () => {
      try {
        const response = await bookGroupPanel(panel.sectionId, selected);
        setResult(response);
        if (!("error" in response)) { setSelected([]); setReview(false); router.refresh(); }
      } catch { setResult({error: "failure"}); }
    });
  }
  const buttonClass = "min-h-11 rounded-md border border-[var(--peace-line)] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
  return <div className="grid min-w-0 gap-5" aria-busy={pending}>
    {result ? <p role={"error" in result ? "alert" : "status"} className={`rounded-lg border p-4 ${"error" in result ? "border-red-300 bg-red-50 text-red-900" : "border-green-300 bg-green-50 text-green-900"}`}>
      {"error" in result ? copy[result.error] : `${copy.success}: ${result.count} · ${copy.seats}: ${result.seats}`}
    </p> : null}
    <div className="surface-panel grid gap-3 p-5">
      <label className="grid gap-2 font-semibold" htmlFor="group-panel">{copy.panel}</label>
      <select id="group-panel" className="field w-full min-w-0" value={sectionId ?? ""} disabled={pending || review} onChange={e => {
        const value = e.target.value;
        startTransition(() => router.push(value ? `/dashboard/capogruppo/panel?section=${encodeURIComponent(value)}` : "/dashboard/capogruppo/panel"));
      }}>
        <option value="">{copy.choose}</option>
        {view.panels.map(p => <option key={p.sectionId} value={p.sectionId}>{p.title} · {dateFormat.format(new Date(p.startsAt))} · {p.audience}</option>)}
      </select>
      {!view.panels.length ? <p>{copy.emptyPanels}</p> : null}
      {panel ? <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
        <p>{dateFormat.format(new Date(panel.startsAt))}–{timeFormat.format(new Date(panel.endsAt))} · {panel.location} · {panel.audience}</p>
        <strong>{copy.remaining}: {panel.remaining}</strong>
      </div> : null}
    </div>
    {panel ? <>
      {review ? <section className="surface-panel grid gap-4 p-5" aria-labelledby="group-panel-review">
        <h2 id="group-panel-review" ref={reviewHeading} tabIndex={-1} className="text-lg font-semibold">{copy.review} · {panel.title}</h2>
        <p>{copy.selection}: <strong>{selected.length}</strong> · {copy.totalSeats}: <strong>{totalSeats}</strong></p>
        <p className="text-sm">{copy.atomic}</p>
        <ul className="max-h-72 overflow-auto text-sm">{selectedRows.map(row => <li className="border-b border-[var(--peace-line)] py-2" key={row.registrationId}>{row.name} · {row.groupName} · {copy.seats}: {row.seats}</li>)}</ul>
        <div className="flex flex-wrap gap-3"><button type="button" disabled={pending} className={buttonClass} onClick={() => {setReview(false); setResult(null);}}>{copy.cancel}</button>
          <button type="button" disabled={pending || overCapacity || !selected.length} className={`${buttonClass} bg-[var(--peace-blue-800)] text-white`} onClick={submit}>{pending ? copy.pending : copy.confirm}</button></div>
      </section> : <>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">{copy.search}<input className="field" value={query} onChange={e => setQuery(e.target.value)} disabled={pending} type="search" /></label>
          <label className="grid gap-1 text-sm font-semibold">{copy.group}<select className="field" value={group} onChange={e => setGroup(e.target.value)} disabled={pending}><option value="">{copy.allGroups}</option>{groups.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        </div>
        <div className="surface-panel min-w-0 overflow-x-auto overscroll-x-contain">
          <table className="w-full text-left text-sm"><caption className="sr-only">{copy.title} · {panel.title}</caption>
            <thead><tr className="border-b border-[var(--peace-line)] bg-slate-50">
              <th className="p-3"><input type="checkbox" className="size-5" aria-label={copy.selectAll} disabled={pending || !eligible.length} checked={eligible.length > 0 && eligible.every(row => checked.has(row.registrationId))}
                ref={node => {if(node) node.indeterminate = eligible.some(row => checked.has(row.registrationId)) && !eligible.every(row => checked.has(row.registrationId));}}
                onChange={() => setSelected(toggleVisiblePanelSelection(selected, visible))} /></th>
              {[copy.person, copy.group, copy.seats, copy.status].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead>
            <tbody>{visible.map(row => <tr key={row.registrationId} className="border-b border-[var(--peace-line)]">
              <td className="p-3"><input type="checkbox" className="size-5" aria-label={row.name} disabled={pending || row.status !== "available"} checked={checked.has(row.registrationId)} onChange={e => setSelected(e.target.checked ? [...selected, row.registrationId] : selected.filter(id => id !== row.registrationId))} /></td>
              <th scope="row" className="p-3 font-medium">{row.name}{row.code ? <span className="block text-xs font-normal text-[var(--peace-muted)]">{row.code}</span> : null}</th>
              <td className="p-3">{row.groupName}</td><td className="p-3">{row.seats}</td>
              <td className="p-3"><span className={`inline-block rounded-full px-2 py-1 text-xs ${row.status === "selected" ? "bg-green-100 text-green-900" : row.status === "available" ? "bg-blue-50 text-blue-900" : "bg-amber-50 text-amber-900"}`}>{copy[row.status]}</span></td>
            </tr>)}</tbody>
          </table>
          {!visible.length ? <p className="p-5">{copy.emptyPeople}</p> : null}
        </div>
        <section className="surface-panel grid gap-3 p-5" aria-label={copy.review}>
          <p aria-live="polite">{copy.selection}: <strong>{selected.length}</strong> · {copy.totalSeats}: <strong>{totalSeats}</strong></p>
          <p className="text-sm text-[var(--peace-muted)]">{copy.family}</p>
          {overCapacity ? <p role="alert" className="text-sm text-red-800">{copy.fullError}</p> : null}
          <div className="flex flex-wrap gap-3">
            <button type="button" className={`${buttonClass} bg-[var(--peace-blue-800)] text-white`} disabled={pending || !selected.length || overCapacity} onClick={() => {setReview(true); setResult(null); requestAnimationFrame(() => reviewHeading.current?.focus());}}>{copy.submit}</button>
            <button type="button" className={buttonClass} disabled={pending || !selected.length} onClick={() => setSelected([])}>{copy.clear}</button>
            <button type="button" className={buttonClass} disabled={pending} onClick={() => {setSelected([]); startTransition(() => router.refresh());}}>{copy.refresh}</button>
          </div>
        </section>
      </>}
    </> : null}
  </div>;
}

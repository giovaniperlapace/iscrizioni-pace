"use client";

import { useState } from "react";
import type { PublicSchoolPanelOption } from "@/lib/panels/public-school-bookings";
import { getSchoolBookingCopy } from "@/lib/panels/school-booking-copy";
import type { SupportedLocale } from "@/lib/i18n/config";

export function SchoolPanelSelection({ panels, locale }: { panels: PublicSchoolPanelOption[]; locale: SupportedLocale }) {
  const copy = getSchoolBookingCopy(locale);
  const [students, setStudents] = useState("20");
  const [companions, setCompanions] = useState("2");
  const [selected, setSelected] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, { students?: string; companions?: string }>>({});
  function count(section: string, kind: "students" | "companions", total: string) {
    const custom = counts[section]?.[kind];
    return custom === undefined ? total : custom === "" ? "" : String(Math.min(Number(custom), Number(total)));
  }
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Europe/Rome" });
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
  return <>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="grid gap-1 text-sm font-semibold">{copy.students}<input required name="studentCount" type="number" min={1} max={1000} value={students} onChange={e => setStudents(e.target.value)} className="field font-normal" /></label>
      <label className="grid gap-1 text-sm font-semibold">{copy.companions}<input required name="companionCount" type="number" min={1} max={100} value={companions} onChange={e => setCompanions(e.target.value)} className="field font-normal" /></label>
    </div>
    <fieldset className="grid gap-3 border-t border-[var(--peace-border)] pt-6">
      <legend className="text-xl font-semibold">{copy.panels}</legend>
      <p className="text-sm leading-6 text-[var(--peace-muted)]">{copy.panelsHelp}</p>
      {panels.map(panel => {
        const checked = selected.includes(panel.sectionId);
        return <div key={panel.sectionId} className="grid gap-4 rounded-lg border border-[var(--peace-border)] p-4 md:grid-cols-[minmax(0,1fr)_8rem_8rem] md:items-end">
          <label className="flex gap-3"><input type="checkbox" name="sectionIds" value={panel.sectionId} checked={checked} onChange={e => setSelected(current => e.target.checked ? [...current, panel.sectionId] : current.filter(id => id !== panel.sectionId))} className="mt-1 size-5" /><span><span className="block font-semibold">{panel.title}</span><span className="block text-sm leading-6 text-[var(--peace-muted)]">{date.format(new Date(panel.startsAt))}, {time.format(new Date(panel.startsAt))}–{time.format(new Date(panel.endsAt))}{panel.locationName ? ` · ${panel.locationName}` : ""}</span>{panel.description ? <span className="mt-1 block text-sm text-[var(--peace-muted)]">{panel.description}</span> : null}</span></label>
          <input type="hidden" name={`panelId:${panel.sectionId}`} value={panel.panelId} />
          {(["students", "companions"] as const).map(kind => <label key={kind} className="grid gap-1 text-sm font-semibold">{copy[kind]}<input required disabled={!checked} name={`${kind}:${panel.sectionId}`} type="number" min={1} max={Number(kind === "students" ? students : companions)} value={count(panel.sectionId, kind, kind === "students" ? students : companions)} onChange={e => setCounts(current => ({ ...current, [panel.sectionId]: { ...current[panel.sectionId], [kind]: e.target.value } }))} className="field font-normal disabled:opacity-50" /></label>)}
        </div>;
      })}
    </fieldset>
  </>;
}

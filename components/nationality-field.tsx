"use client";

import { useId, useState } from "react";
import { NATIONALITY_OPTIONS } from "@/lib/questionnaire/registration";
import { nationalityName } from "@/lib/registrations/nationality-names";
import type { SupportedLocale } from "@/lib/i18n/config";

// Editing the search never erases an existing answer merely by focusing it.
export function NationalityField({ locale, initial = "", label }: { locale: SupportedLocale; initial?: string; label: string }) {
  const id = useId();
  const [value, setValue] = useState(initial);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase(locale);
  const options = NATIONALITY_OPTIONS.map(value => ({ value, label: nationalityName(value, locale)! }))
    .sort((a, b) => a.label.localeCompare(b.label, locale))
    .filter(option => normalize(option.label + " " + option.value).includes(normalize(query)));
  return <div className="relative grid gap-1 text-sm font-semibold text-[var(--peace-ink)]" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id}>{label}</label>
    <input type="hidden" name="nationality" value={value} />
    <input id={id} className="field bg-white font-normal" role="combobox" aria-expanded={open} aria-controls={`${id}-options`} aria-autocomplete="list"
      maxLength={200} autoComplete="off" value={open ? query : nationalityName(value, locale) ?? ""}
      placeholder={nationalityName(value, locale) ?? label}
      onFocus={() => { setQuery(""); setOpen(true); }}
      onChange={e => { setQuery(e.target.value); setValue(e.target.value); setOpen(true); }}
      onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); setOpen(false); } if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); document.getElementById(`${id}-options`)?.querySelector<HTMLButtonElement>("button")?.focus(); } }} />
    {open ? <div id={`${id}-options`} role="listbox" aria-label={label} className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-[var(--peace-border)] bg-white shadow-lg"
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      {options.map(option => <button key={option.value} type="button" role="option" aria-selected={value === option.value}
        className="block w-full px-3 py-2 text-left font-normal hover:bg-[var(--peace-sky-100)] focus:bg-[var(--peace-sky-100)]"
        onMouseDown={e => e.preventDefault()} onClick={() => { setValue(option.value); document.getElementById(id)?.focus(); setOpen(false); }}
        onKeyDown={e => { const target = e.key === "ArrowDown" ? e.currentTarget.nextElementSibling : e.key === "ArrowUp" ? e.currentTarget.previousElementSibling : null; if (target instanceof HTMLElement) { e.preventDefault(); target.focus(); } }}>
        {option.label}
      </button>)}
    </div> : null}
  </div>;
}

"use client";

import { useId } from "react";
import { NATIONALITY_OPTIONS, RESIDENCE_COUNTRIES } from "@/lib/questionnaire/registration";
import { countryName } from "@/lib/registrations/country-names";
import { DEMOGRAPHICS_COPY, type Demographics } from "@/lib/registrations/assisted-demographics";
import type { SupportedLocale } from "@/lib/i18n/config";

export function AssistedDemographicFields({ locale, initial, includeSex = false }: { locale: SupportedLocale; initial?: Demographics; includeSex?: boolean }) {
  const id = useId();
  const copy = DEMOGRAPHICS_COPY[locale];
  return <>
    {(["nationality", "birthPlace", "country"] as const).map(key => <label key={key} className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
      {copy[key]}
      <input name={key} maxLength={200} defaultValue={initial?.[key] ?? ""} list={`${id}-${key === "nationality" ? "nationalities" : "countries"}`} className="field bg-white font-normal" />
    </label>)}
    <datalist id={`${id}-nationalities`}>{NATIONALITY_OPTIONS.map(value => <option key={value} value={value} />)}</datalist>
    <datalist id={`${id}-countries`}>{RESIDENCE_COUNTRIES.map(value => <option key={value} value={countryName(value, locale) ?? value} />)}</datalist>
    {includeSex ? <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
      {copy.sex}
      <select name="internalSex" defaultValue="" className="field bg-white font-normal" aria-describedby={`${id}-internal`}>
        <option value="">{copy.empty}</option><option value="male">{copy.male}</option><option value="female">{copy.female}</option>
      </select>
      <span id={`${id}-internal`} className="text-xs font-normal text-[var(--peace-muted)]">{copy.internal}</span>
    </label> : null}
  </>;
}

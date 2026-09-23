"use client";
import { useState } from "react";
import type { GroupEditTreeRow } from "./group-edit-fields";
import { groupCountryOptions, groupCityOptions, type GroupGeographyCatalog } from "@/lib/groups/geography";
import { GROUP_GEOGRAPHY_COPY } from "@/lib/groups/geography-copy";
import type { SupportedLocale } from "@/lib/i18n/config";

export function GroupGeographyFields({ group, groups, parentId, catalog, locale }: {
  group: GroupEditTreeRow | null; groups: GroupEditTreeRow[]; parentId: string;
  catalog: GroupGeographyCatalog; locale: SupportedLocale;
}) {
  const copy = GROUP_GEOGRAPHY_COPY[locale];
  const [country, setCountry] = useState(group?.countryId ?? "");
  const [city, setCity] = useState(group?.cityId ?? "");
  const countries = groupCountryOptions(catalog, locale);
  let inheritedCountry: string | null = null;
  let inheritedCity: string | null = null;
  let ancestorId: string | null = parentId;
  const visited = new Set<string>();
  while (ancestorId && !visited.has(ancestorId)) {
    visited.add(ancestorId);
    const ancestor = groups.find(row => row.id === ancestorId);
    if (!ancestor) break;
    inheritedCountry ??= ancestor.countryId ?? null;
    inheritedCity ??= ancestor.cityId ?? null;
    ancestorId = ancestor.parentGroupId;
  }
  const effectiveCountry = country || inheritedCountry || "";
  const cities = groupCityOptions(catalog, effectiveCountry, locale);
  const countryLabel = countries.find(c => c.value === inheritedCountry)?.label;
  const cityLabel = catalog.cities.find(c => c.id === inheritedCity)?.name;
  // Keep an obsolete selection visible so an ancestor change cannot silently erase it.
  const previousCity = catalog.cities.find(c => c.id === city);
  return <fieldset className="grid gap-4 rounded-lg border border-[var(--peace-border)] p-4 sm:col-span-2">
    <legend className="px-1 text-sm font-semibold">{copy.title}</legend>
    <input type="hidden" name="groupGeographyPresent" value="1" />
    <input type="hidden" name="groupExpectedUpdatedAt" value={group?.updatedAt ?? ""} />
    <p className="text-sm text-[var(--peace-muted)]">{copy.hint}</p>
    <label className="grid gap-2 text-sm font-semibold">{copy.country}
      <select name="groupCountry" className="field" value={country} onChange={e => { setCountry(e.target.value); setCity(""); }}>
        <option value="">{copy.inherit}</option>
        {countries.map(c => <option key={c.value} value={c.value} disabled={catalog.countries.find(row => row.id === c.value)?.is_active === false && c.value !== country}>{c.label}{catalog.countries.find(row => row.id === c.value)?.is_active === false ? ` (${copy.inactive})` : ""}</option>)}
      </select>
    </label>
    {!effectiveCountry && city ? <input type="hidden" name="groupCity" value={city} /> : null}
    <label className="grid gap-2 text-sm font-semibold">{copy.city}
      <select name="groupCity" className="field" value={city} disabled={!effectiveCountry} onChange={e => setCity(e.target.value)}>
        <option value="">{!effectiveCountry ? copy.selectCountry : cityLabel ? `${copy.inherited}: ${cityLabel}` : copy.allCities}</option>
        {previousCity && !cities.some(c => c.value === city) ? <option value={city}>{previousCity.name}</option> : null}
        {cities.map(c => <option key={c.value} value={c.value} disabled={catalog.cities.find(row => row.id === c.value)?.is_active === false && c.value !== city}>{c.label}{catalog.cities.find(row => row.id === c.value)?.is_active === false ? ` (${copy.inactive})` : ""}</option>)}
        <option value="__other__">{copy.other}</option>
      </select>
    </label>
    {city === "__other__" ? <label className="grid gap-2 text-sm font-semibold">{copy.cityName}<input name="groupCityOther" className="field" required minLength={2} maxLength={120} /></label> : null}
    <p className="text-sm text-[var(--peace-muted)]" role="status">{countryLabel ? `${copy.inherited}: ${[countryLabel, cityLabel].filter(Boolean).join(" / ")}` : !effectiveCountry ? copy.none : null}</p>
  </fieldset>;
}

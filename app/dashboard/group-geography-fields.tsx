"use client";
import { useRef, useState } from "react";
import type { GroupEditTreeRow } from "./group-edit-fields";
import { groupCountryOptions, groupCityOptions, type GroupGeographyCatalog } from "@/lib/groups/geography";
import { groupCityIds } from "@/lib/groups/matching";
import { GROUP_GEOGRAPHY_COPY } from "@/lib/groups/geography-copy";
import type { SupportedLocale } from "@/lib/i18n/config";

type CitySelection = { key: number; value: string; other: string };
export function GroupGeographyFields({ group, groups, parentId, catalog, locale }: {
  group: GroupEditTreeRow | null; groups: GroupEditTreeRow[]; parentId: string;
  catalog: GroupGeographyCatalog; locale: SupportedLocale;
}) {
  const copy = GROUP_GEOGRAPHY_COPY[locale];
  const initialCities = groupCityIds(group ?? {});
  const [country, setCountry] = useState(group?.countryId ?? "");
  const [selected, setSelected] = useState<CitySelection[]>(() => (initialCities.length
    ? initialCities : [group?.cityScope === "country" ? "__country__" : ""]
  ).map((value, key) => ({ key, value, other: "" })));
  const nextKey = useRef(Math.max(initialCities.length, 1));
  const scope = selected[0]?.value === "__country__" ? "country" : selected[0]?.value ? "cities" : "inherit";
  const countries = groupCountryOptions(catalog, locale);
  let inheritedCountry: string | null = null;
  let inheritedCities: string[] = [];
  let citiesResolved = false;
  let ancestorId: string | null = parentId;
  const visited = new Set<string>();
  while (ancestorId && !visited.has(ancestorId)) {
    visited.add(ancestorId);
    const ancestor = groups.find(row => row.id === ancestorId);
    if (!ancestor) break;
    inheritedCountry ??= ancestor.countryId ?? null;
    if (!citiesResolved) {
      inheritedCities = groupCityIds(ancestor);
      citiesResolved = inheritedCities.length > 0 || ancestor.cityScope === "country";
    }
    ancestorId = ancestor.parentGroupId;
  }
  const effectiveCountry = country || inheritedCountry || "";
  const cities = groupCityOptions(catalog, effectiveCountry, locale);
  const countryLabel = countries.find(c => c.value === inheritedCountry)?.label;
  const cityLabels = inheritedCities.map(id => catalog.cities.find(c => c.id === id)?.name).filter(Boolean);
  function addCity() {
    const key = nextKey.current++;
    setSelected(rows => [...rows, { key, value: "", other: "" }]);
  }
  function updateCity(key: number, patch: Partial<CitySelection>) {
    setSelected(rows => rows.map(row => row.key === key ? { ...row, ...patch } : row));
  }
  return <fieldset className="grid min-w-0 gap-4 rounded-lg border border-[var(--peace-border)] p-4 sm:col-span-2">
    <legend className="px-1 text-sm font-semibold">{copy.title}</legend>
    <input type="hidden" name="groupGeographyPresent" value="1" />
    <input type="hidden" name="groupExpectedUpdatedAt" value={group?.updatedAt ?? ""} />
    <p className="text-sm text-[var(--peace-muted)]">{copy.hint}</p>
    <label className="grid gap-2 text-sm font-semibold">{copy.country}
      <select name="groupCountry" className="field min-w-0" value={country} onChange={e => {
        setCountry(e.target.value);
        setSelected([{ key: nextKey.current++, value: "", other: "" }]);
      }}>
        <option value="">{copy.inherit}</option>
        {countries.map(c => <option key={c.value} value={c.value} disabled={catalog.countries.find(row => row.id === c.value)?.is_active === false && c.value !== country}>{c.label}{catalog.countries.find(row => row.id === c.value)?.is_active === false ? ` (${copy.inactive})` : ""}</option>)}
      </select>
    </label>
    <input type="hidden" name="groupCityScope" value={scope} />
    <div className="grid min-w-0 gap-3">
      {selected.map((row, index) => {
        const previousCity = catalog.cities.find(c => c.id === row.value);
        return <div key={row.key} className="grid min-w-0 gap-2">
          {scope === "cities" ? <input type="hidden" name="groupCities" value={row.value === "__other__" ? `name:${row.other}` : row.value} /> : null}
          <label className="grid min-w-0 gap-2 text-sm font-semibold">{copy.city}{selected.length > 1 ? ` ${index + 1}` : ""}
            <select className="field min-w-0" required={index > 0} disabled={!effectiveCountry} value={row.value} onChange={e => {
              const value = e.target.value;
              if (index === 0 && (!value || value === "__country__")) setSelected([{ ...row, value, other: "" }]);
              else updateCity(row.key, { value, other: "" });
            }}>
              <option value="">{!effectiveCountry ? copy.selectCountry : index > 0 ? copy.chooseCity : cityLabels.length ? `${copy.inherited}: ${cityLabels.join(", ")}` : row.value === "__country__" ? copy.inherit : copy.allCities}</option>
              {index === 0 && (cityLabels.length > 0 || row.value === "__country__") ? <option value="__country__">{copy.allCities}</option> : null}
              {previousCity && !cities.some(c => c.value === row.value) ? <option value={row.value}>{previousCity.name}</option> : null}
              {cities.map(c => <option key={c.value} value={c.value} disabled={(catalog.cities.find(item => item.id === c.value)?.is_active === false && c.value !== row.value) || selected.some(item => item.key !== row.key && item.value === c.value)}>{c.label}{catalog.cities.find(item => item.id === c.value)?.is_active === false ? ` (${copy.inactive})` : ""}</option>)}
              <option value="__other__">{copy.other}</option>
            </select>
          </label>
          {row.value === "__other__" ? <label className="grid gap-2 text-sm font-semibold">{copy.cityName}<input className="field" required minLength={2} maxLength={120} value={row.other} onChange={e => updateCity(row.key, { other: e.target.value })} /></label> : null}
          {selected.length > 1 ? <button type="button" className="justify-self-start text-sm underline" aria-label={`${copy.removeCity} ${index + 1}`} onClick={() => setSelected(rows => rows.filter(item => item.key !== row.key))}>{copy.removeCity}</button> : null}
        </div>;
      })}
      <button type="button" className="justify-self-start rounded border border-[var(--peace-border)] px-3 py-2 text-sm font-semibold" disabled={!effectiveCountry || scope !== "cities" || selected.some(row => !row.value) || selected.length >= 100} onClick={addCity}>{copy.addCity}</button>
    </div>
    <p className="text-sm text-[var(--peace-muted)]" role="status">{countryLabel ? `${copy.inherited}: ${[countryLabel, ...cityLabels].join(" / ")}` : !effectiveCountry ? copy.none : null}</p>
  </fieldset>;
}

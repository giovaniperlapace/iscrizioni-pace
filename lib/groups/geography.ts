import { RESIDENCE_COUNTRIES, RESIDENCE_CITY_OPTIONS } from "../questionnaire/registration.ts";
import { countryCode, countryName } from "../registrations/country-names.ts";
import type { SupportedLocale } from "../i18n/config.ts";

export type GroupGeographyCatalog = {
  countries: Array<{ id: string; iso2: string | null; name_it: string; name_en: string; is_active: boolean }>;
  cities: Array<{ id: string; country_id: string; name: string; is_active: boolean }>;
};
export function normalizeGroupCity(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
export function groupCountryOptions(catalog: GroupGeographyCatalog, locale: SupportedLocale) {
  const options = new Map<string, { value: string; label: string; name: string }>();
  for (const name of RESIDENCE_COUNTRIES) {
    const code = countryCode(name)!;
    options.set(code, { value: `iso:${code}`, label: countryName(name, locale)!, name });
  }
  for (const c of catalog.countries) {
    const key = c.iso2 ?? c.id;
    options.set(key, { value: c.id, label: countryName(c.name_it, locale)!, name: countryName(c.name_it)! });
  }
  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, locale));
}
export function groupCityOptions(catalog: GroupGeographyCatalog, country: string, locale: SupportedLocale) {
  const selected = groupCountryOptions(catalog, locale).find(c => c.value === country);
  if (!selected) return [];
  const options = new Map<string, { value: string; label: string }>();
  for (const name of RESIDENCE_CITY_OPTIONS[selected.name] ?? []) {
    options.set(normalizeGroupCity(name), { value: `name:${name}`, label: name });
  }
  for (const city of catalog.cities.filter(c => c.country_id === country)) {
    options.set(normalizeGroupCity(city.name), { value: city.id, label: city.name });
  }
  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, locale));
}

// Server-side parsing: labels are derived here, never trusted from hidden inputs.
type CityInput = { city_id?: string; city_name?: string; city_normalized_name?: string };
type GeographyInput = CityInput & { country_id?: string; country_code?: string; country_name_it?: string; country_name_en?: string; city_scope?: string; cities?: CityInput[] };
export function parseGroupGeography(form: FormData): { ok: false; field: string | null } | { ok: true; value: GeographyInput } {
  if (form.get("groupGeographyPresent") !== "1") return { ok: false as const, field: null };
  const country = String(form.get("groupCountry") ?? "");
  const city = String(form.get("groupCity") ?? "");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let countryData: { country_id?: string; country_code?: string; country_name_it?: string; country_name_en?: string } = {};
  if (country.startsWith("iso:")) {
    const option = RESIDENCE_COUNTRIES.find(name => `iso:${countryCode(name)}` === country);
    if (!option) return { ok: false as const, field: "groupCountry" };
    countryData = { country_code: countryCode(option)!, country_name_it: countryName(option)!, country_name_en: countryName(option, "en")! };
  } else if (country) {
    if (!uuid.test(country)) return { ok: false as const, field: "groupCountry" };
    countryData = { country_id: country };
  }
  const scope = form.get("groupCityScope");
  if (scope !== null) {
    if (!["inherit", "country", "cities"].includes(String(scope))) return { ok: false as const, field: "groupCityScope" };
    const entries = form.getAll("groupCities");
    if (entries.length > 100 || (scope === "cities" ? entries.length === 0 : entries.length !== 0)) return { ok: false as const, field: "groupCityScope" };
    const cities: Array<{ city_id?: string; city_name?: string; city_normalized_name?: string }> = [];
    const seen = new Set<string>();
    for (const entry of entries) {
      const item = new FormData();
      item.set("groupGeographyPresent", "1");
      item.set("groupCity", String(entry));
      const parsed = parseGroupGeography(item);
      if (!parsed.ok || (!parsed.value.city_id && !parsed.value.city_name)) return { ok: false as const, field: "groupCityScope" };
      const key = parsed.value.city_id?.toLowerCase() ?? parsed.value.city_normalized_name!;
      if (!seen.has(key)) { cities.push(parsed.value); seen.add(key); }
    }
    return { ok: true as const, value: { ...countryData, city_scope: String(scope), cities } };
  }
  let cityData: { city_id?: string; city_name?: string; city_normalized_name?: string } = {};
  if (city === "__other__" || city.startsWith("name:")) {
    const name = (city === "__other__" ? String(form.get("groupCityOther") ?? "") : city.slice(5)).trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) return { ok: false as const, field: "groupCity" };
    cityData = { city_name: name, city_normalized_name: normalizeGroupCity(name) };
  } else if (city) {
    if (!uuid.test(city)) return { ok: false as const, field: "groupCity" };
    cityData = { city_id: city };
  }
  return { ok: true as const, value: { ...countryData, ...cityData } };
}

import { SUPPORTED_LOCALES, type SupportedLocale } from "../i18n/config.ts";
import { RESIDENCE_COUNTRIES } from "../questionnaire/registration.ts";

import { COUNTRY_CODES } from "./country-codes.ts";

const aliases: Record<string, string> = {
  "United States of America": "US", USA: "US", UK: "GB",
  "Czech Republic": "CZ", "Repubblica Ceca": "CZ", "Ivory Coast": "CI", "Cape Verde": "CV",
  Swaziland: "SZ", "East Timor": "TL", "South Korea": "KR", "North Korea": "KP",
  Moldavia: "MD", Vaticano: "VA", Kazakhstan: "KZ",
  "Repubblica Democratica del Congo": "CD",
};
const names = new Map<string, string | null>();
const canonicalNames = new Map<string, string>();
const displays = new Map<SupportedLocale, Intl.DisplayNames>();

function key(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[’']/g, " ").replace(/\s+/g, " ").trim();
}
function add(name: string, code: string) {
  const normalized = key(name);
  // A collision must remain ambiguous, never resolve by insertion order.
  if (!names.has(normalized)) names.set(normalized, code);
  else if (names.get(normalized) !== code) names.set(normalized, null);
}
function initialize() {
  if (displays.size) return;
  for (const locale of SUPPORTED_LOCALES) {
    const display = new Intl.DisplayNames([locale], { type: "region", fallback: "none" });
    displays.set(locale, display);
    for (const code of COUNTRY_CODES) {
      const name = display.of(code);
      if (name) add(name, code);
    }
  }
  for (const [name, code] of Object.entries(aliases)) add(name, code);
  // Preserve the established Italian labels used by lists, cities and statistics.
  for (const name of RESIDENCE_COUNTRIES) {
    const code = names.get(key(name));
    if (code) canonicalNames.set(code, name);
  }
}

export function countryCode(value: string | null | undefined): string | null {
  initialize();
  return value ? names.get(key(value)) ?? null : null;
}

// Unknown historical values remain visible; no fuzzy matching or data loss.
export function countryName(value: string | null | undefined, locale: SupportedLocale = "it"): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const code = countryCode(trimmed);
  if (!code) return trimmed;
  return (locale === "it" ? canonicalNames.get(code) : null)
    ?? displays.get(locale)?.of(code) ?? trimmed;
}

export type CountryCatalogEntry = {
  id: string;
  iso2?: string | null;
  name_it: string;
  name_en: string;
};

export function findCountryId(countries: readonly CountryCatalogEntry[], value: string): string | null {
  const code = countryCode(value);
  if (!code) return null;
  const matches = countries.filter(country => {
    // Prefer the catalogue's ISO identity, including when its labels differ.
    if (country.iso2) return country.iso2.toUpperCase() === code;
    return countryCode(country.name_it) === code || countryCode(country.name_en) === code;
  });
  return matches.length === 1 ? matches[0].id : null;
}

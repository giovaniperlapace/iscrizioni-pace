import { SUPPORTED_LOCALES, type SupportedLocale } from "../i18n/config.ts";
import { RESIDENCE_COUNTRIES } from "../questionnaire/registration.ts";

// ISO countries/territories and Kosovo; arbitrary region codes are not accepted.
const COUNTRY_CODES = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW".split(" ");

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

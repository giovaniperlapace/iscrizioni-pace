import { NATIONALITY_OPTIONS } from "../questionnaire/registration.ts";
import { countryName } from "./country-names.ts";
import type { SupportedLocale } from "../i18n/config.ts";

// Keep stored questionnaire values stable; display the country of nationality
// in the interface language, including historical English demonyms.
const aliases: Record<string, string> = {
  "Bolivia (Plurinational State of)": "Bolivia",
  "Bonaire, Sint Eustatius and Saba": "Caribbean Netherlands",
  "Virgin Islands (British)": "British Virgin Islands",
  "United Kingdom of Great Britain and Northern Ireland": "United Kingdom",
  "Brunei Darussalam": "Brunei",
  "Taiwan, Province of China": "Taiwan",
  "Cocos (Keeling) Islands": "Cocos Islands",
  "Congo (Democratic Republic of the)": "Congo - Kinshasa",
  "Congo (Republic of the)": "Congo - Brazzaville",
  "Falkland Islands (Malvinas)": "Falkland Islands",
  "Korea (Democratic People's Republic of)": "North Korea",
  "Korea (Republic of)": "South Korea",
  "Lao People's Democratic Republic": "Laos",
  "Macedonia (the former Yugoslav Republic of)": "North Macedonia",
  "Moldova (Republic of)": "Moldova",
  "Palestine, State of": "Palestinian Territories",
  "Russian Federation": "Russia",
  "Saint Martin (French part)": "Saint Martin",
  "Sint Maarten (Dutch part)": "Sint Maarten",
  "Syrian Arab Republic": "Syria",
  "Tanzania, United Republic of": "Tanzania",
  "Venezuela (Bolivarian Republic of)": "Venezuela",
  "Viet Nam": "Vietnam",
  "Virgin Islands (U.S.)": "U.S. Virgin Islands",
};
const legacyRegions: Record<string, string> = {
  "United States Minor Outlying Islands": "UM", "Antigua and Barbuda": "AG",
  "Saint Barthélemy": "BL", "Bosnia and Herzegovina": "BA", "Cocos Islands": "CC",
  "Heard Island and McDonald Islands": "HM", "Hong Kong": "HK", "Saint Kitts and Nevis": "KN",
  Macao: "MO", "Micronesia (Federated States of)": "FM", Pitcairn: "PN",
  "Saint Helena, Ascension and Tristan da Cunha": "SH", "Saint Vincent and the Grenadines": "VC",
  "Saint Pierre and Miquelon": "PM", "Sao Tome and Principe": "ST",
  "South Georgia and the South Sandwich Islands": "GS", "Svalbard and Jan Mayen": "SJ",
  "Trinidad and Tobago": "TT", Turkey: "TR", "Turks and Caicos Islands": "TC",
  "Vatican City State": "VA", "Wallis and Futuna": "WF",
};
const catalogValues = new Set<string>(NATIONALITY_OPTIONS);
const demonyms = new Map<string, string | null>();
for (const value of NATIONALITY_OPTIONS) {
  const match = value.match(/^(.*?) \((.*)\)$/);
  if (!match) continue;
  for (const name of match[1].split(/,\s*/)) {
    const key = name.toLowerCase();
    demonyms.set(key, demonyms.has(key) ? null : match[2]);
  }
}
export function nationalityName(value: string | null | undefined, locale: SupportedLocale = "it"): string | null {
  if (!value?.trim()) return null;
  const country = (catalogValues.has(value) ? value.match(/^[^(]+\((.*)\)$/)?.[1] : null) ?? demonyms.get(value.trim().toLowerCase()) ?? value;
  const canonical = aliases[country] ?? country;
  const code = legacyRegions[canonical];
  return code ? new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? value : countryName(canonical, locale);
}

import { SUPPORTED_LOCALES, type SupportedLocale } from "../i18n/config.ts";
import { EUROPEAN_COUNTRIES } from "../questionnaire/registration.ts";

// ISO country/territory codes plus Kosovo. Do not accept arbitrary region codes
// (e.g. EU) or infer a country from a city/province (e.g. Roma/RM).
const COUNTRY_CODES = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW".split(" ");
let names: Set<string> | undefined;

function key(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[’']/g, " ").replace(/\s+/g, " ").trim();
}

export function isCountryName(value: string): boolean {
  if (!names) {
    names = new Set(EUROPEAN_COUNTRIES.map(key));
    for (const locale of SUPPORTED_LOCALES) {
      const display = new Intl.DisplayNames([locale], { type: "region", fallback: "none" });
      for (const code of COUNTRY_CODES) {
        const name = display.of(code);
        if (name) names.add(key(name));
      }
    }
    // Common full-name variants not consistently represented by ICU.
    for (const name of ["United States of America", "USA", "UK", "Czech Republic", "Ivory Coast", "Cape Verde", "Swaziland", "East Timor", "South Korea", "North Korea"]) names.add(key(name));
  }
  return names.has(key(value));
}

export const COUNTRY_VALIDATION_MESSAGE: Record<SupportedLocale, string> = {
  it: "Indica un paese valido, ad esempio Italia. Non inserire una città o una provincia.",
  en: "Enter a valid country, such as Italy. Do not enter a city or province.",
  fr: "Indiquez un pays valide, par exemple Italie. Ne saisissez pas une ville ou une province.",
  de: "Gib ein gültiges Land ein, zum Beispiel Italien. Gib keine Stadt oder Provinz ein.",
  es: "Indica un país válido, por ejemplo Italia. No introduzcas una ciudad o provincia.",
  nl: "Vul een geldig land in, bijvoorbeeld Italië. Vul geen stad of provincie in.",
  uk: "Вкажіть дійсну країну, наприклад Італія. Не вказуйте місто або область.",
};

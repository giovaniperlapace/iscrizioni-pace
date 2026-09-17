import type { SupportedLocale } from "../i18n/config.ts";
import { countryCode } from "./country-names.ts";

export function isCountryName(value: string): boolean {
  return countryCode(value) !== null;
}

export const COUNTRY_VALIDATION_MESSAGE: Record<SupportedLocale, string> = {
  it: "Indica un paese valido, ad esempio Italia. Non inserire una città o una provincia.",
  en: "Enter a valid country, such as Italy. Do not enter a city or province.",
  fr: "Indique un pays valide, par exemple l’Italie. Ne saisis pas de ville ni de province.",
  de: "Gib ein gültiges Land ein, zum Beispiel Italien. Gib keine Stadt oder Provinz ein.",
  es: "Indica un país válido, por ejemplo Italia. No introduzcas una ciudad o provincia.",
  nl: "Vul een geldig land in, bijvoorbeeld Italië. Vul geen stad of provincie in.",
  uk: "Вкажіть дійсну країну, наприклад Італія. Не вказуйте місто або область.",
};

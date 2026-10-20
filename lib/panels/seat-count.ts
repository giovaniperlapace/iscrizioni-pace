import type { SupportedLocale } from "@/lib/i18n/config";

const seatUnits: Record<SupportedLocale, { one: string; few?: string; other: string }> = {
  it: { one: "posto", other: "posti" },
  en: { one: "seat", other: "seats" },
  fr: { one: "place", other: "places" },
  de: { one: "Platz", other: "Plätze" },
  es: { one: "plaza", other: "plazas" },
  nl: { one: "plaats", other: "plaatsen" },
  uk: { one: "місце", few: "місця", other: "місць" },
};

export function formatSeatCount(count: number, locale: SupportedLocale): string {
  const seats = Math.max(0, count);
  const category = new Intl.PluralRules(locale).select(seats);
  const units = seatUnits[locale];
  const unit = category === "one" ? units.one : category === "few" ? units.few ?? units.other : units.other;
  return `${seats.toLocaleString(locale)} ${unit}`;
}

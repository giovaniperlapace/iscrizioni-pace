import { calculateAgeAtDate } from "@/lib/groups/matching";
import type { SupportedLocale } from "@/lib/i18n/config";
import type { RegistrationChildRow } from "@/lib/registrations/registration-children";

const COPY: Record<SupportedLocale, {
  one: string; many: string; of: string; atEvent: string; unknown: string;
  infant: string; year: string; years: string;
}> = {
  it: { one: "figlio accompagnato", many: "figli accompagnati", of: "Figli accompagnati di", atEvent: "Età all’inizio dell’evento", unknown: "Età non disponibile", infant: "meno di 1 anno", year: "anno", years: "anni" },
  en: { one: "accompanying child", many: "accompanying children", of: "Accompanying children of", atEvent: "Age at the start of the event", unknown: "Age unavailable", infant: "under 1 year", year: "year", years: "years" },
  fr: { one: "enfant accompagné", many: "enfants accompagnés", of: "Enfants accompagnés de", atEvent: "Âge au début de l’événement", unknown: "Âge non disponible", infant: "moins de 1 an", year: "an", years: "ans" },
  de: { one: "begleitetes Kind", many: "begleitete Kinder", of: "Begleitete Kinder von", atEvent: "Alter zu Beginn der Veranstaltung", unknown: "Alter nicht verfügbar", infant: "unter 1 Jahr", year: "Jahr", years: "Jahre" },
  es: { one: "hijo acompañado", many: "hijos acompañados", of: "Hijos acompañados de", atEvent: "Edad al inicio del evento", unknown: "Edad no disponible", infant: "menos de 1 año", year: "año", years: "años" },
  nl: { one: "begeleid kind", many: "begeleide kinderen", of: "Begeleide kinderen van", atEvent: "Leeftijd aan het begin van het evenement", unknown: "Leeftijd niet beschikbaar", infant: "jonger dan 1 jaar", year: "jaar", years: "jaar" },
  uk: { one: "дитина в супроводі", many: "дітей у супроводі", of: "Діти в супроводі учасника", atEvent: "Вік на початок події", unknown: "Вік недоступний", infant: "менше 1 року", year: "рік", years: "років" },
};

export function AccompanyingChildrenList({ records, participantName, startsOn, locale = "it" }: {
  records: RegistrationChildRow[]; participantName: string; startsOn: string | null; locale?: SupportedLocale;
}) {
  if (records.length === 0) return null;
  const copy = COPY[locale];
  const plural = new Intl.PluralRules(locale);
  function ageLabel(age: number | null) {
    if (age === null) return copy.unknown;
    if (age === 0) return copy.infant;
    const category = plural.select(age);
    const unit = locale === "uk" ? category === "one" ? "рік" : category === "few" ? "роки" : "років" : age === 1 ? copy.year : copy.years;
    return `${age} ${unit}`;
  }
  const countLabel = locale === "uk" && plural.select(records.length) === "few" ? "дитини в супроводі" :
    (locale === "uk" ? plural.select(records.length) === "one" : records.length === 1) ? copy.one : copy.many;
  return <div className="mt-2">
    <span className="inline-flex rounded-md bg-[var(--peace-sky-100)] px-2 py-1 text-xs font-semibold text-[var(--peace-blue-800)]">
      {records.length} {countLabel}
    </span>
    <ul aria-label={`${copy.of} ${participantName}`} className="mt-2 grid gap-1 border-l-2 border-[var(--peace-border-strong)] pl-2 text-xs leading-5 text-[var(--peace-muted)]">
      {records.map((child, index) => <li key={child.id ?? index} className="break-words">
        <span className="font-medium text-[var(--peace-ink)]">{child.first_name} {child.last_name}</span>
        {" · "}<span title={copy.atEvent}>{ageLabel(calculateAgeAtDate(child.birth_date, startsOn))}</span>
      </li>)}
    </ul>
  </div>;
}

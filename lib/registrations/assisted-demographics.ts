import type { SupportedLocale } from "../i18n/config.ts";

export const DEMOGRAPHICS_COPY = {
  it: { title: "Nazionalità e paesi", nationality: "Nazionalità", birthPlace: "Paese / luogo di nascita", country: "Paese in cui vive abitualmente", sex: "Sesso", male: "Maschio", female: "Femmina", empty: "Non indicato", internal: "Dato interno, non visibile al partecipante." },
  en: { title: "Nationality and countries", nationality: "Nationality", birthPlace: "Country / place of birth", country: "Country of usual residence", sex: "Sex", male: "Male", female: "Female", empty: "Not provided", internal: "Internal information, not visible to the participant." },
  fr: { title: "Nationalité et pays", nationality: "Nationalité", birthPlace: "Pays / lieu de naissance", country: "Pays de résidence habituelle", sex: "Sexe", male: "Masculin", female: "Féminin", empty: "Non renseigné", internal: "Information interne, non visible par le participant." },
  de: { title: "Staatsangehörigkeit und Länder", nationality: "Staatsangehörigkeit", birthPlace: "Geburtsland / Geburtsort", country: "Land des gewöhnlichen Aufenthalts", sex: "Geschlecht", male: "Männlich", female: "Weiblich", empty: "Nicht angegeben", internal: "Interne Angabe, für den Teilnehmer nicht sichtbar." },
  es: { title: "Nacionalidad y países", nationality: "Nacionalidad", birthPlace: "País / lugar de nacimiento", country: "País de residencia habitual", sex: "Sexo", male: "Masculino", female: "Femenino", empty: "No indicado", internal: "Información interna, no visible para el participante." },
  nl: { title: "Nationaliteit en landen", nationality: "Nationaliteit", birthPlace: "Geboorteland / geboorteplaats", country: "Land van gewoonlijk verblijf", sex: "Geslacht", male: "Man", female: "Vrouw", empty: "Niet opgegeven", internal: "Interne informatie, niet zichtbaar voor de deelnemer." },
  uk: { title: "Громадянство та країни", nationality: "Громадянство", birthPlace: "Країна / місце народження", country: "Країна постійного проживання", sex: "Стать", male: "Чоловіча", female: "Жіноча", empty: "Не вказано", internal: "Внутрішня інформація, недоступна учаснику." },
} satisfies Record<SupportedLocale, Record<string, string>>;
export type InternalSex = "male" | "female";
export type Demographics = { nationality: string | null; birthPlace: string | null; country: string | null };
export function parseDemographics(form: FormData): Demographics | null {
  const values = Object.fromEntries(["nationality", "birthPlace", "country"].map(key => [key, String(form.get(key) ?? "").trim() || null])) as Demographics;
  return Object.values(values).some(value => value && value.length > 200) ? null : values;
}
export function internalSexText(value: InternalSex | null | undefined, locale: SupportedLocale) {
  return value ? DEMOGRAPHICS_COPY[locale][value] : "—";
}

export const DEMOGRAPHICS_STATUS_COPY = {
  it: { save: "Salva dati", saved: "Dati aggiornati.", loading: "Caricamento…", error: "Impossibile caricare i dati.", retry: "Riprova" },
  en: { save: "Save details", saved: "Details updated.", loading: "Loading…", error: "Unable to load details.", retry: "Try again" },
  fr: { save: "Enregistrer les données", saved: "Données mises à jour.", loading: "Chargement…", error: "Impossible de charger les données.", retry: "Réessayer" },
  de: { save: "Daten speichern", saved: "Daten aktualisiert.", loading: "Wird geladen…", error: "Daten konnten nicht geladen werden.", retry: "Erneut versuchen" },
  es: { save: "Guardar datos", saved: "Datos actualizados.", loading: "Cargando…", error: "No se pudieron cargar los datos.", retry: "Reintentar" },
  nl: { save: "Gegevens opslaan", saved: "Gegevens bijgewerkt.", loading: "Laden…", error: "De gegevens konden niet worden geladen.", retry: "Opnieuw proberen" },
  uk: { save: "Зберегти дані", saved: "Дані оновлено.", loading: "Завантаження…", error: "Не вдалося завантажити дані.", retry: "Спробувати ще раз" },
} satisfies Record<SupportedLocale, Record<string, string>>;

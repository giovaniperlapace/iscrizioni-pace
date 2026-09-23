import type { SupportedLocale } from "../i18n/config.ts";
export const BIRTH_DATE_COPY: Record<SupportedLocale, { warning: string }> = {
  it: { warning: "Questa data indica meno di un anno di età. Controlla soprattutto l’anno di nascita. Se stai aggiungendo un bambino accompagnato, usa la sezione figli nell’iscrizione del genitore." },
  en: { warning: "This date indicates an age under one year. Check the birth year carefully. For an accompanying child, use the children section in the parent's registration." },
  fr: { warning: "Cette date indique un âge inférieur à un an. Vérifiez surtout l’année de naissance. Pour un enfant accompagné, utilisez la rubrique enfants dans l’inscription du parent." },
  de: { warning: "Dieses Datum ergibt ein Alter unter einem Jahr. Prüfen Sie besonders das Geburtsjahr. Nutzen Sie für ein begleitetes Kind den Kinderbereich in der Anmeldung des Elternteils." },
  es: { warning: "Esta fecha indica una edad inferior a un año. Revisa especialmente el año de nacimiento. Para un niño acompañado, utiliza la sección de hijos en la inscripción del progenitor." },
  nl: { warning: "Deze datum geeft een leeftijd van minder dan één jaar aan. Controleer vooral het geboortejaar. Gebruik voor een begeleid kind het onderdeel kinderen in de inschrijving van de ouder." },
  uk: { warning: "Ця дата означає вік до одного року. Уважно перевірте рік народження. Для дитини в супроводі дорослого скористайтеся розділом дітей у реєстрації одного з батьків." },
};

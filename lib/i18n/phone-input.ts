import type { SupportedLocale } from "@/lib/i18n/config";

export const PHONE_INPUT_COPY: Record<SupportedLocale, { phonePrefixLabel: string; phoneOther: string; phoneNumberPlaceholder: string; phonePrefixPlaceholder: string; phoneTitle: string }> = {
  it: {
    phonePrefixLabel: "Prefisso internazionale",
    phoneOther: "Altro",
    phoneNumberPlaceholder: "Numero",
    phonePrefixPlaceholder: "Scrivi il prefisso, per esempio +234",
    phoneTitle: "Inserisci solo cifre, spazi, punti, parentesi o trattini.",
  },
  en: {
    phonePrefixLabel: "International prefix",
    phoneOther: "Other",
    phoneNumberPlaceholder: "Number",
    phonePrefixPlaceholder: "Write the prefix, for example +234",
    phoneTitle: "Use only digits, spaces, dots, brackets or hyphens.",
  },
  fr: {
    phonePrefixLabel: "Préfixe international",
    phoneOther: "Autre",
    phoneNumberPlaceholder: "Numéro",
    phonePrefixPlaceholder: "Écris le préfixe, par exemple +234",
    phoneTitle: "Saisis uniquement des chiffres, espaces, points, parenthèses ou tirets.",
  },
  de: {
    phonePrefixLabel: "Internationale Vorwahl",
    phoneOther: "Andere",
    phoneNumberPlaceholder: "Nummer",
    phonePrefixPlaceholder: "Schreibe die Vorwahl, zum Beispiel +234",
    phoneTitle: "Gib nur Ziffern, Leerzeichen, Punkte, Klammern oder Bindestriche ein.",
  },
  es: {
    phonePrefixLabel: "Prefijo internacional",
    phoneOther: "Otro",
    phoneNumberPlaceholder: "Número",
    phonePrefixPlaceholder: "Escribe el prefijo, por ejemplo +234",
    phoneTitle: "Introduce solo cifras, espacios, puntos, paréntesis o guiones.",
  },
  nl: {
    phonePrefixLabel: "Internationaal kengetal",
    phoneOther: "Anders",
    phoneNumberPlaceholder: "Nummer",
    phonePrefixPlaceholder: "Schrijf het kengetal, bijvoorbeeld +234",
    phoneTitle: "Gebruik alleen cijfers, spaties, punten, haakjes of streepjes.",
  },
  uk: {
    phonePrefixLabel: "Міжнародний код",
    phoneOther: "Інше",
    phoneNumberPlaceholder: "Номер",
    phonePrefixPlaceholder: "Напишіть код, наприклад +234",
    phoneTitle: "Вводьте лише цифри, пробіли, крапки, дужки або дефіси.",
  },
};

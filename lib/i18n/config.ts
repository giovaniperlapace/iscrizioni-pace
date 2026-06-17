export const SUPPORTED_LOCALES = ["it", "en", "fr", "de", "es", "nl", "uk"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";
export const LOCALE_COOKIE_NAME = "iscrizioni_locale";

export const LANGUAGE_OPTIONS: Array<{
  value: SupportedLocale;
  nativeLabel: string;
  flag: string;
}> = [
  { value: "it", nativeLabel: "Italiano", flag: "🇮🇹" },
  { value: "en", nativeLabel: "English", flag: "🇬🇧" },
  { value: "fr", nativeLabel: "Français", flag: "🇫🇷" },
  { value: "de", nativeLabel: "Deutsch", flag: "🇩🇪" },
  { value: "es", nativeLabel: "Español", flag: "🇪🇸" },
  { value: "nl", nativeLabel: "Nederlands", flag: "🇳🇱" },
  { value: "uk", nativeLabel: "Українська", flag: "🇺🇦" },
];

const LOCALE_ALIASES: Record<string, SupportedLocale> = {
  ua: "uk",
};

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return Boolean(value && SUPPORTED_LOCALES.includes(value as SupportedLocale));
}

export function normalizeLocale(value: string | null | undefined): SupportedLocale | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace("_", "-");
  const direct = normalized.split("-")[0];
  const alias = LOCALE_ALIASES[direct];

  if (alias) {
    return alias;
  }

  return isSupportedLocale(direct) ? direct : null;
}

export function pickLocaleFromAcceptLanguage(value: string | null): SupportedLocale {
  if (!value) {
    return DEFAULT_LOCALE;
  }

  const choices = value
    .split(",")
    .map((part) => {
      const [rawLocale, rawWeight] = part.trim().split(";q=");
      const locale = normalizeLocale(rawLocale);
      const weight = rawWeight ? Number.parseFloat(rawWeight) : 1;

      return {
        locale,
        weight: Number.isFinite(weight) ? weight : 0,
      };
    })
    .filter((choice): choice is { locale: SupportedLocale; weight: number } =>
      Boolean(choice.locale)
    )
    .sort((a, b) => b.weight - a.weight);

  return choices[0]?.locale ?? DEFAULT_LOCALE;
}

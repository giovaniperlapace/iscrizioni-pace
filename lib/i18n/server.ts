import "server-only";

import { cookies, headers } from "next/headers";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  type SupportedLocale,
  normalizeLocale,
  pickLocaleFromAcceptLanguage,
} from "./config";

export async function getRequestLocale(): Promise<SupportedLocale> {
  const cookieStore = await cookies();
  const savedLocale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  if (savedLocale) {
    return savedLocale;
  }

  try {
    const headerStore = await headers();
    return pickLocaleFromAcceptLanguage(headerStore.get("accept-language"));
  } catch {
    return DEFAULT_LOCALE;
  }
}

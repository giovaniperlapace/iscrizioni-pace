"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";

const COPY = {
  it: "Operazione in corso…", en: "Working…", fr: "Opération en cours…",
  de: "Wird bearbeitet…", es: "Operación en curso…", nl: "Bezig…", uk: "Виконується…",
};
const LocaleContext = createContext<SupportedLocale>("en");

export function WorkStatusProvider({ locale, children }: { locale: SupportedLocale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function WorkStatus({ className = "", spinner = true }: { className?: string; spinner?: boolean }) {
  const locale = useContext(LocaleContext);
  return <span role="status" className={`work-status ${className}`}>
    {spinner && <span aria-hidden="true" className="work-spinner" />}
    <span>{COPY[locale]}</span>
  </span>;
}

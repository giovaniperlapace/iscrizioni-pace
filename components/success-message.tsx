"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";

const CLOSE_LABEL: Record<SupportedLocale, string> = {
  it: "Chiudi messaggio", en: "Dismiss message", fr: "Fermer le message",
  de: "Meldung schließen", es: "Cerrar mensaje", nl: "Bericht sluiten", uk: "Закрити повідомлення",
};
const SUCCESS_PARAMS = ["saved", "openingSaved", "adminSaved", "managerSaved", "groupSaved", "groupLinkSaved", "roleSaved", "serviceSaved", "manualSaved"];

export function SuccessMessage({ children, locale = "it", className = "", clearQuery = false }: {
  children: ReactNode;
  locale?: SupportedLocale;
  className?: string;
  clearQuery?: boolean;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), 5_000);
    return () => window.clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (visible || !clearQuery) return;
    const url = new URL(window.location.href);
    let changed = false;
    for (const param of SUCCESS_PARAMS) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    }
    if (changed) window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [visible, clearQuery]);

  if (!visible) return null;
  return (
    <div role="status" className={`flex items-start gap-3 ${className}`}>
      <div className="min-w-0 flex-1">{children}</div>
      <button type="button" aria-label={CLOSE_LABEL[locale]} title={CLOSE_LABEL[locale]}
        onClick={() => setVisible(false)}
        className="-my-1 flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-md text-xl leading-none hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2">
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

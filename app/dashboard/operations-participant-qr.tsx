"use client";

import { useEffect, useState } from "react";
import { LeaderParticipantQr } from "./capogruppo/participant-qr";
import type { RegistrationQrPreview } from "@/lib/qrcode/registration-qr";
import type { SupportedLocale } from "@/lib/i18n/config";

const COPY = {
  it: ["Caricamento QR…", "Impossibile caricare il QR.", "Riprova"],
  en: ["Loading QR code…", "Unable to load the QR code.", "Try again"],
  fr: ["Chargement du QR code…", "Impossible de charger le QR code.", "Réessayer"],
  de: ["QR-Code wird geladen…", "Der QR-Code konnte nicht geladen werden.", "Erneut versuchen"],
  es: ["Cargando código QR…", "No se puede cargar el código QR.", "Reintentar"],
  nl: ["QR-code laden…", "De QR-code kan niet worden geladen.", "Opnieuw proberen"],
  uk: ["Завантаження QR-коду…", "Не вдалося завантажити QR-код.", "Спробувати ще раз"],
} satisfies Record<SupportedLocale, string[]>;

export function OperationsParticipantQr({ registrationId, participantName, participantCode, locale }: {
  registrationId: string; participantName: string; participantCode: string | null; locale: SupportedLocale;
}) {
  const [result, setResult] = useState<{ registrationId: string; qr: RegistrationQrPreview | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/dashboard/participants/qr?registrationId=${encodeURIComponent(registrationId)}`, {
      signal: controller.signal, cache: "no-store",
    }).then(async (response) => {
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("QR read failed");
      return response.json() as Promise<{ qr: RegistrationQrPreview }>;
    }).then(({ qr }) => {
      if (!controller.signal.aborted) setResult({ registrationId, qr });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ registrationId, qr: null });
    });
    return () => controller.abort();
  }, [registrationId, attempt]);
  const copy = COPY[locale];
  if (!result || result.registrationId !== registrationId) return <p role="status">{copy[0]}</p>;
  if (!result.qr) return <div className="grid justify-items-start gap-2">
    <p role="alert">{copy[1]}</p>
    <button type="button" className="min-h-11 rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold"
      onClick={() => { setResult(null); setAttempt(value => value + 1); }}>{copy[2]}</button>
  </div>;
  return <LeaderParticipantQr qr={result.qr} participantName={participantName} participantCode={participantCode} locale={locale} />;
}

import { Mail } from "lucide-react";
import type { SupportedLocale } from "@/lib/i18n/config";

export const EMAIL_DELEGATION_COPY: Record<SupportedLocale, { label: string; help: string }> = {
  it: { label: "Email delegata al capogruppo", help: "All’iscrizione è stato scelto di ricevere le comunicazioni tramite il capogruppo." },
  en: { label: "Email delegated to group leader", help: "During registration, communications were assigned to the group leader." },
  fr: { label: "Email délégué au responsable du groupe", help: "Lors de l’inscription, il a été choisi de recevoir les communications par le responsable du groupe." },
  de: { label: "E-Mail über die Gruppenleitung", help: "Bei der Anmeldung wurde gewählt, Mitteilungen über die Gruppenleitung zu erhalten." },
  es: { label: "Correo delegado al responsable del grupo", help: "Al inscribirse, se eligió recibir las comunicaciones a través del responsable del grupo." },
  nl: { label: "E-mail via de groepsleider", help: "Bij de inschrijving is gekozen om berichten via de groepsleider te ontvangen." },
  uk: { label: "Пошта через керівника групи", help: "Під час реєстрації обрано отримання повідомлень через керівника групи." },
};

export function ParticipantEmailCell({ email, delegated, locale }: {
  email: string | null; delegated?: boolean; locale: SupportedLocale;
}) {
  if (email?.trim()) return email;
  if (!delegated) return "—";
  const copy = EMAIL_DELEGATION_COPY[locale];
  return <span title={copy.help} className="inline-flex max-w-56 whitespace-normal items-center gap-1.5 rounded-md border border-[var(--peace-border)] bg-[var(--peace-sky-100)] px-2 py-1 text-xs font-medium text-[var(--peace-blue-800)]">
    <Mail size={15} className="shrink-0" aria-hidden="true" />
    {copy.label}
  </span>;
}

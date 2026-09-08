"use client";

import { useId, useState } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";

export const MANUAL_EMAIL_COPY: Record<SupportedLocale, {
  choice: string; delegated: string; personal: string;
}> = {
  it: {
    choice: "Voglio usare la mia email",
    delegated: "Riceverai tu le comunicazioni per questa persona e gestirai la sua scheda. Non avrà un accesso personale finché non le assegnerai un’email dalla scheda partecipante.",
    personal: "Inserisci l’email della persona: riceverà le comunicazioni e potrà accedere con Magic Link per gestire la propria iscrizione.",
  },
  en: {
    choice: "I want to use my email",
    delegated: "You will receive communications for this person and manage their details. They will not have personal access until you add their own email in their participant record.",
    personal: "Enter the person’s email: they will receive communications and can use a Magic Link to manage their registration.",
  },
  fr: {
    choice: "Je souhaite utiliser mon email",
    delegated: "Tu recevras les communications pour cette personne et géreras sa fiche. Elle n’aura pas d’accès personnel tant que tu n’auras pas ajouté son email dans sa fiche.",
    personal: "Saisis l’email de la personne : elle recevra les communications et pourra gérer son inscription avec un Magic Link.",
  },
  de: {
    choice: "Ich möchte meine E-Mail-Adresse verwenden",
    delegated: "Du erhältst die Mitteilungen für diese Person und verwaltest ihre Daten. Sie erhält erst einen persönlichen Zugang, wenn du ihre eigene E-Mail-Adresse in ihrem Teilnehmendeneintrag ergänzt.",
    personal: "Gib die E-Mail-Adresse der Person ein: Sie erhält Mitteilungen und kann ihre Anmeldung über einen Magic Link verwalten.",
  },
  es: {
    choice: "Quiero usar mi correo electrónico",
    delegated: "Recibirás las comunicaciones de esta persona y gestionarás su ficha. No tendrá acceso personal hasta que añadas su propio correo en su ficha.",
    personal: "Introduce el correo de la persona: recibirá las comunicaciones y podrá gestionar su inscripción mediante un Magic Link.",
  },
  nl: {
    choice: "Ik wil mijn e-mailadres gebruiken",
    delegated: "Je ontvangt de berichten voor deze persoon en beheert diens gegevens. Deze persoon krijgt pas eigen toegang wanneer je een eigen e-mailadres toevoegt aan het deelnemersprofiel.",
    personal: "Vul het e-mailadres van de persoon in: deze ontvangt berichten en kan de inschrijving beheren via een Magic Link.",
  },
  uk: {
    choice: "Хочу використовувати свою електронну пошту",
    delegated: "Ти отримуватимеш повідомлення для цієї людини та керуватимеш її даними. Вона не матиме особистого доступу, доки ти не додаси її власну електронну адресу в картці учасника.",
    personal: "Вкажи електронну адресу людини: вона отримуватиме повідомлення та зможе керувати реєстрацією через Magic Link.",
  },
};

export function ManualEmailFields({ locale, emailLabel }: {
  locale: SupportedLocale; emailLabel: string;
}) {
  const [useLeaderEmail, setUseLeaderEmail] = useState(false);
  const helpId = useId();
  const copy = MANUAL_EMAIL_COPY[locale];
  return (
    <div className="grid gap-3 lg:col-span-2">
      <p id={helpId} className="text-sm text-[var(--peace-muted)]">
        {useLeaderEmail ? copy.delegated : copy.personal}
      </p>
      {!useLeaderEmail ? (
        <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
          {emailLabel}
          <input name="email" type="email" required className="field" aria-describedby={helpId} />
        </label>
      ) : null}
      <label className="flex items-center gap-3 text-sm font-semibold text-[var(--peace-ink)]">
        <input
          name="useLeaderEmail"
          type="checkbox"
          checked={useLeaderEmail}
          onChange={event => setUseLeaderEmail(event.target.checked)}
          aria-describedby={helpId}
          className="h-4 w-4 accent-[var(--peace-blue-800)]"
        />
        {copy.choice}
      </label>
    </div>
  );
}

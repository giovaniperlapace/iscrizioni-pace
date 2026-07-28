"use client";

import { useState } from "react";

import type { SupportedLocale } from "@/lib/i18n/config";
import { MAX_REGISTRATION_CHILDREN } from "@/lib/registrations/registration-children";

type ManualChildrenCopy = {
  title: string;
  help: string;
  question: string;
  count: string;
  child: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  yes: string;
  no: string;
};

const COPY: Record<SupportedLocale, ManualChildrenCopy> = {
  it: {
    title: "Partecipazione con figli",
    help:
      "I figli saranno collegati a questa iscrizione e ne condivideranno gruppo, presenze e QR.",
    question: "La persona parteciperà con uno o più figli?",
    count: "Con quanti figli parteciperà?",
    child: "Figlio",
    firstName: "Nome",
    lastName: "Cognome",
    birthDate: "Data di nascita",
    yes: "Sì",
    no: "No",
  },
  en: {
    title: "Attendance with children",
    help:
      "The children will be linked to this registration and will share its group, attendance and QR code.",
    question: "Will this person attend with one or more children?",
    count: "How many children will attend?",
    child: "Child",
    firstName: "First name",
    lastName: "Last name",
    birthDate: "Date of birth",
    yes: "Yes",
    no: "No",
  },
  fr: {
    title: "Participation avec des enfants",
    help:
      "Les enfants seront rattachés à cette inscription et partageront son groupe, ses présences et son QR code.",
    question: "Cette personne participera-t-elle avec un ou plusieurs enfants ?",
    count: "Avec combien d'enfants participera-t-elle ?",
    child: "Enfant",
    firstName: "Prénom",
    lastName: "Nom",
    birthDate: "Date de naissance",
    yes: "Oui",
    no: "Non",
  },
  de: {
    title: "Teilnahme mit Kindern",
    help:
      "Die Kinder werden mit dieser Anmeldung verknüpft und teilen Gruppe, Anwesenheit und QR-Code.",
    question: "Nimmt diese Person mit einem oder mehreren Kindern teil?",
    count: "Mit wie vielen Kindern nimmt sie teil?",
    child: "Kind",
    firstName: "Vorname",
    lastName: "Nachname",
    birthDate: "Geburtsdatum",
    yes: "Ja",
    no: "Nein",
  },
  es: {
    title: "Participación con hijos",
    help:
      "Los hijos quedarán vinculados a esta inscripción y compartirán grupo, asistencias y código QR.",
    question: "¿Esta persona participará con uno o más hijos?",
    count: "¿Con cuántos hijos participará?",
    child: "Hijo",
    firstName: "Nombre",
    lastName: "Apellidos",
    birthDate: "Fecha de nacimiento",
    yes: "Sí",
    no: "No",
  },
  nl: {
    title: "Deelname met kinderen",
    help:
      "De kinderen worden aan deze inschrijving gekoppeld en delen de groep, aanwezigheid en QR-code.",
    question: "Neemt deze persoon met een of meer kinderen deel?",
    count: "Met hoeveel kinderen neemt deze persoon deel?",
    child: "Kind",
    firstName: "Voornaam",
    lastName: "Achternaam",
    birthDate: "Geboortedatum",
    yes: "Ja",
    no: "Nee",
  },
  uk: {
    title: "Участь із дітьми",
    help:
      "Діти будуть пов’язані з цією реєстрацією та матимуть спільні групу, присутність і QR-код.",
    question: "Ця особа братиме участь з однією або кількома дітьми?",
    count: "Зі скількома дітьми вона братиме участь?",
    child: "Дитина",
    firstName: "Ім’я",
    lastName: "Прізвище",
    birthDate: "Дата народження",
    yes: "Так",
    no: "Ні",
  },
};

export function ManualChildrenFields({
  locale,
}: {
  locale: SupportedLocale;
}) {
  const [participatesWithChildren, setParticipatesWithChildren] =
    useState(false);
  const [childrenCount, setChildrenCount] = useState(1);
  const copy = COPY[locale] ?? COPY.en;

  return (
    <fieldset className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4 lg:col-span-2">
      <legend className="px-1 text-sm font-semibold text-[var(--peace-ink)]">
        {copy.title}
      </legend>
      <p className="text-sm leading-6 text-[var(--peace-muted)]">
        {copy.help}
      </p>

      <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
        {copy.question}
        <select
          name="participatesWithChildren"
          className="field"
          value={participatesWithChildren ? "yes" : "no"}
          onChange={(event) =>
            setParticipatesWithChildren(event.target.value === "yes")
          }
        >
          <option value="no">{copy.no}</option>
          <option value="yes">{copy.yes}</option>
        </select>
      </label>

      {participatesWithChildren ? (
        <>
          <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
            {copy.count}
            <select
              name="childrenCount"
              className="field"
              value={childrenCount}
              onChange={(event) =>
                setChildrenCount(Number(event.target.value))
              }
            >
              {Array.from(
                { length: MAX_REGISTRATION_CHILDREN },
                (_, index) => index + 1
              ).map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3">
            {Array.from({ length: childrenCount }, (_, index) => (
              <fieldset
                key={index}
                className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-white p-4 sm:grid-cols-2"
              >
                <legend className="px-1 text-sm font-semibold text-[var(--peace-blue-900)]">
                  {copy.child} {index + 1}
                </legend>
                <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
                  {copy.firstName}
                  <input
                    name={`child_${index}_firstName`}
                    required
                    maxLength={120}
                    autoComplete="off"
                    className="field"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
                  {copy.lastName}
                  <input
                    name={`child_${index}_lastName`}
                    required
                    maxLength={120}
                    autoComplete="off"
                    className="field"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)] sm:col-span-2">
                  {copy.birthDate}
                  <input
                    name={`child_${index}_birthDate`}
                    type="date"
                    required
                    className="field"
                  />
                </label>
              </fieldset>
            ))}
          </div>
        </>
      ) : null}
    </fieldset>
  );
}

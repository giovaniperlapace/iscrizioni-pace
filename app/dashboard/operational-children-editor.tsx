"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOperationalChild } from "@/app/actions";
import { ReliableForm } from "@/components/reliable-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { SuccessMessage } from "@/components/success-message";
import { ConfirmSubmitButton } from "./confirm-submit-button";
import type { SupportedLocale } from "@/lib/i18n/config";
import type { RegistrationChildRow } from "@/lib/registrations/registration-children";

const COPY: Record<SupportedLocale, readonly string[]> = {
  it: ["Nome", "Cognome", "Data di nascita", "Salva figlio", "Rimuovi figlio", "Rimuovere questo figlio dall’iscrizione? L’iscrizione del genitore resterà invariata.", "Dati del figlio salvati.", "Figlio rimosso dall’iscrizione.", "Nessun figlio associato.", "Modifica i dati o rimuovi un figlio inserito per errore o duplicato."],
  en: ["First name", "Last name", "Date of birth", "Save child", "Remove child", "Remove this child from the registration? The parent’s registration will remain unchanged.", "Child’s details saved.", "Child removed from the registration.", "No children linked.", "Edit the details or remove a child entered by mistake or duplicated."],
  fr: ["Prénom", "Nom", "Date de naissance", "Enregistrer l’enfant", "Retirer l’enfant", "Retirer cet enfant de l’inscription ? L’inscription du parent restera inchangée.", "Informations de l’enfant enregistrées.", "Enfant retiré de l’inscription.", "Aucun enfant associé.", "Modifiez les informations ou retirez un enfant inscrit par erreur ou en double."],
  de: ["Vorname", "Nachname", "Geburtsdatum", "Kind speichern", "Kind entfernen", "Dieses Kind aus der Anmeldung entfernen? Die Anmeldung des Elternteils bleibt unverändert.", "Angaben zum Kind gespeichert.", "Kind aus der Anmeldung entfernt.", "Keine Kinder zugeordnet.", "Bearbeite die Angaben oder entferne ein versehentlich oder doppelt eingetragenes Kind."],
  es: ["Nombre", "Apellidos", "Fecha de nacimiento", "Guardar hijo", "Eliminar hijo", "¿Eliminar a este hijo de la inscripción? La inscripción del progenitor no cambiará.", "Datos del hijo guardados.", "Hijo eliminado de la inscripción.", "No hay hijos asociados.", "Modifica los datos o elimina a un hijo inscrito por error o duplicado."],
  nl: ["Voornaam", "Achternaam", "Geboortedatum", "Kind opslaan", "Kind verwijderen", "Dit kind uit de inschrijving verwijderen? De inschrijving van de ouder blijft ongewijzigd.", "Gegevens van het kind opgeslagen.", "Kind uit de inschrijving verwijderd.", "Geen kinderen gekoppeld.", "Wijzig de gegevens of verwijder een kind dat per ongeluk of dubbel is ingeschreven."],
  uk: ["Ім’я", "Прізвище", "Дата народження", "Зберегти дитину", "Видалити дитину", "Видалити цю дитину з реєстрації? Реєстрація одного з батьків залишиться без змін.", "Дані дитини збережено.", "Дитину видалено з реєстрації.", "Немає пов’язаних дітей.", "Змініть дані або видаліть дитину, зареєстровану помилково чи двічі."],
};

export function OperationalChildrenEditor({ records, locale = "it", editable }: {
  records: RegistrationChildRow[]; locale?: SupportedLocale; editable: boolean;
}) {
  const copy = COPY[locale];
  return <div className="grid gap-3">
    {editable && records.length > 0 ? <p className="text-sm text-[var(--peace-muted)]">{copy[9]}</p> : null}
    {records.map(child => editable && child.id ?
      <ChildEditor key={child.id} child={child} locale={locale} /> :
      <p key={child.id ?? child.position}>{child.first_name} {child.last_name} · {child.birth_date}</p>)}
    {!records.length ? <p>{copy[8]}</p> : null}
  </div>;
}

function ChildEditor({ child, locale }: { child: RegistrationChildRow; locale: SupportedLocale }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ text: string; version: number } | null>(null);
  const [removed, setRemoved] = useState(false);
  const copy = COPY[locale];
  const expected = JSON.stringify({ first_name: child.first_name, last_name: child.last_name, birth_date: child.birth_date });
  async function save(data: FormData) {
    const result = await updateOperationalChild(data);
    if (result.status === "success") {
      const deleted = data.get("intent") === "delete";
      setRemoved(deleted);
      setMessage(previous => ({ text: copy[deleted ? 7 : 6], version: (previous?.version ?? 0) + 1 }));
      router.refresh();
    }
    return result;
  }
  const hidden = <><input type="hidden" name="childId" value={child.id} /><input type="hidden" name="expected" value={expected} /></>;
  return <div className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-3">
    {message ? <SuccessMessage key={message.version} locale={locale}>{message.text}</SuccessMessage> : null}
    {!removed ? <>
      <ReliableForm key={expected} action={save} locale={locale} className="grid gap-3" data-preserve-dashboard-scroll>
        {hidden}
        {([['firstName', child.first_name, copy[0]], ['lastName', child.last_name, copy[1]]] as const).map(([name, value, label]) =>
          <label key={name} className="grid gap-1 text-sm font-semibold">{label}
            <input name={name} defaultValue={value} required maxLength={120} className="field bg-white font-normal" />
          </label>)}
        <label className="grid gap-1 text-sm font-semibold">{copy[2]}
          <input name="birthDate" type="date" defaultValue={child.birth_date} required max={new Date().toISOString().slice(0, 10)} className="field bg-white font-normal" />
        </label>
        <PendingSubmitButton name="intent" value="save" className="min-h-11 w-fit rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white">{copy[3]}</PendingSubmitButton>
      </ReliableForm>
      <ReliableForm action={save} locale={locale}>
        {hidden}
        <ConfirmSubmitButton name="intent" value="delete" confirmMessage={`${child.first_name} ${child.last_name}: ${copy[5]}`} className="min-h-11 text-sm font-semibold text-red-700 underline">{copy[4]}</ConfirmSubmitButton>
      </ReliableForm>
    </> : null}
  </div>;
}

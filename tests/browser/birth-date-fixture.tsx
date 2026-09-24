"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ParticipantBirthDateField } from "@/components/participant-birth-date-field";
import { ReliableForm } from "@/components/reliable-form";
import { normalizeLocale } from "@/lib/i18n/config";
import { parseManualRegistrationForm } from "@/lib/registrations/manual-registration";
export default function Fixture() {
  const locale = normalizeLocale(useSearchParams().get("locale")) ?? "it";
  const [calls, setCalls] = useState(0);
  return <main className="mx-auto max-w-lg p-4">
    <ReliableForm locale={locale} validation="manualRegistration" action={async data => {
      if (!parseManualRegistrationForm(data).ok) throw new Error("Validation bypass");
      setCalls(count => count + 1);
    }}>
      {Object.entries({ groupId: "11111111-1111-4111-8111-111111111111", firstName: "Test", cityOther: "Berlin", lastName: "Person", email: "synthetic@example.test", availabilityUnknown: "on", consentConfirmed: "on" }).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <ParticipantBirthDateField label="Data di nascita" locale={locale} />
      <button type="submit">Verifica</button>
    </ReliableForm>
    <output data-calls>{calls}</output>
  </main>;
}

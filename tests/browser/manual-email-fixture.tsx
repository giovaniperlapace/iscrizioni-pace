"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ManualPhoneFields } from "@/app/dashboard/capogruppo/manual-phone-fields";
import { ManualEmailFields } from "@/app/dashboard/capogruppo/manual-email-fields";
import { ReliableForm } from "@/components/reliable-form";
import { normalizeLocale } from "@/lib/i18n/config";
import { parseManualRegistrationForm } from "@/lib/registrations/manual-registration";

export default function Fixture() {
  const locale = normalizeLocale(useSearchParams().get("locale")) ?? "it";
  const [result, setResult] = useState("");
  return <main className="mx-auto max-w-xl p-4">
    <ReliableForm validation="manualRegistration" locale={locale}
      action={async data => { setResult(JSON.stringify(parseManualRegistrationForm(data))); }}
      className="grid gap-4">
      <input type="hidden" name="groupId" value="11111111-1111-4111-8111-111111111111" />
      <input type="hidden" name="firstName" value="Persona" />
      <input type="hidden" name="lastName" value="Sintetica" />
      <input type="hidden" name="availabilityUnknown" value="on" />
      <input type="hidden" name="consentConfirmed" value="on" />
      <ManualEmailFields locale={locale} emailLabel="Email" />
      <ManualPhoneFields locale={locale} label="Telefono" />
      <button type="submit" className="button-primary">Verifica</button>
    </ReliableForm>
    <output data-result className="break-all">{result}</output>
  </main>;
}

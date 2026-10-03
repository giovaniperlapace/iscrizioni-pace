"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ManualRegistrationSection } from "@/app/dashboard/manual-registration-section";
import { MANUAL_REGISTRATION_COPY } from "@/lib/registrations/manual-registration-copy";
import { normalizeLocale } from "@/lib/i18n/config";
import { parseManualRegistrationForm } from "@/lib/registrations/manual-registration";
import { formFailure, issueFromMessage } from "@/lib/forms/result";
export default function Fixture() {
  const params = useSearchParams();
  const locale = normalizeLocale(params.get("locale")) ?? "de";
  const [saved, setSaved] = useState("");
  return <main className="mx-auto max-w-4xl p-4">
    <ManualRegistrationSection locale={locale} copy={MANUAL_REGISTRATION_COPY[locale]}
      sourceDashboard={params.get("role") === "manager" ? "manager" : "capogruppo"}
      groups={[{ id: "11111111-1111-4111-8111-111111111111", name: "Germania", isAssignable: true }]}
      selectedGroupId="11111111-1111-4111-8111-111111111111" eventDays={[]}
      action={async data => {
        const parsed = parseManualRegistrationForm(data);
        if (!parsed.ok) return formFailure(parsed.errors.map(issueFromMessage));
        setSaved(JSON.stringify({ city: parsed.value.cityOther, birthDate: parsed.value.birthDate }));
      }} />
    <output data-saved>{saved}</output>
  </main>;
}

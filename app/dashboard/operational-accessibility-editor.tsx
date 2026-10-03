"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOperationalAccessibility, updateOperationalAccessibility } from "./operational-registration-actions";
import { ReliableForm } from "@/components/reliable-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { SuccessMessage } from "@/components/success-message";
import { ACCESSIBILITY_DIFFICULTIES } from "@/lib/questionnaire/registration";
import { ACCESSIBILITY_COMMUNICATION_HELP } from "@/lib/i18n/accessibility";
import { OPERATIONAL_ADDITIONS_COPY } from "@/lib/registrations/operational-additions-copy";
import type { SupportedLocale } from "@/lib/i18n/config";

type Snapshot = { answers: Record<string, boolean>; version: string } | null;
export function OperationalAccessibilityEditor({ registrationId, locale = "it" }: { registrationId: string; locale?: SupportedLocale }) {
  const [loaded, setLoaded] = useState<{ snapshot: Snapshot } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState(0);
  const router = useRouter();
  const copy = OPERATIONAL_ADDITIONS_COPY[locale];
  useEffect(() => {
    let cancelled = false;
    getOperationalAccessibility(registrationId).then(result => {
      if (cancelled) return;
      if (result.status === "success") setLoaded({ snapshot: result.snapshot });
      else setFailed(true);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [registrationId, attempt]);
  return <section className="grid gap-3 text-sm">
    <h4 className="font-semibold">{copy[0]}</h4>
    {!loaded ? failed ? <div role="alert">{copy[4]} <button type="button" className="min-h-11 underline" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>{copy[5]}</button></div> : <p role="status">{copy[3]}</p> :
      <ReliableForm key={JSON.stringify(loaded.snapshot)} locale={locale} className="grid gap-3" data-preserve-dashboard-scroll action={async form => {
        const result = await updateOperationalAccessibility(form);
        if (result.status === "success") { setLoaded({ snapshot: result.snapshot }); setSaved(value => value + 1); router.refresh(); }
        return result;
      }}>
        <input type="hidden" name="registrationId" value={registrationId} />
        <input type="hidden" name="expected" value={JSON.stringify(loaded.snapshot)} />
        <p>{copy[8]}</p>
        {ACCESSIBILITY_DIFFICULTIES.map(({ key, label }) => <label key={key} className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name={`accessibility_${key}`} defaultChecked={loaded.snapshot?.answers[key] === true} className="h-4 w-4" />{label[locale]}
        </label>)}
        <p className="text-[var(--peace-muted)]">{ACCESSIBILITY_COMMUNICATION_HELP[locale]}</p>
        <PendingSubmitButton className="min-h-11 w-fit rounded-md bg-[var(--peace-blue-800)] px-4 font-semibold text-white">{copy[1]}</PendingSubmitButton>
      </ReliableForm>}
    {saved ? <SuccessMessage key={saved} locale={locale}>{copy[2]}</SuccessMessage> : null}
  </section>;
}

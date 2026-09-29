"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOperationalDemographics, updateOperationalDemographics } from "./operational-registration-actions";
import { ReliableForm } from "@/components/reliable-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { SuccessMessage } from "@/components/success-message";
import { AssistedDemographicFields } from "./assisted-demographic-fields";
import { DEMOGRAPHICS_COPY, DEMOGRAPHICS_STATUS_COPY, type Demographics } from "@/lib/registrations/assisted-demographics";
import type { SupportedLocale } from "@/lib/i18n/config";

type Snapshot = Demographics & { questionnaireId: string | null; countryId: string | null; countryOther: string | null };
export function OperationalDemographicsEditor({ registrationId, locale = "it" }: { registrationId: string; locale?: SupportedLocale }) {
  const [loaded, setLoaded] = useState<{ snapshot: Snapshot } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState(0);
  const router = useRouter();
  const copy = DEMOGRAPHICS_STATUS_COPY[locale];
  useEffect(() => {
    let cancelled = false;
    getOperationalDemographics(registrationId).then(result => {
      if (cancelled) return;
      if (result.status === "success") setLoaded({ snapshot: result.snapshot });
      else setFailed(true);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [registrationId, attempt]);
  return <section className="grid gap-3 text-sm">
    <h4 className="font-semibold">{DEMOGRAPHICS_COPY[locale].title}</h4>
    {!loaded ? failed ? <div role="alert">{copy.error} <button type="button" className="min-h-11 underline" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>{copy.retry}</button></div> : <p role="status">{copy.loading}</p> :
      <ReliableForm key={JSON.stringify(loaded.snapshot)} locale={locale} className="grid gap-3" data-preserve-dashboard-scroll action={async form => {
        const result = await updateOperationalDemographics(form);
        if (result.status === "success") { setLoaded({ snapshot: result.snapshot }); setSaved(value => value + 1); router.refresh(); }
        return result;
      }}>
        <input type="hidden" name="registrationId" value={registrationId} />
        <input type="hidden" name="expected" value={JSON.stringify(loaded.snapshot)} />
        <AssistedDemographicFields locale={locale} initial={loaded.snapshot} />
        <PendingSubmitButton className="min-h-11 w-fit rounded-md bg-[var(--peace-blue-800)] px-4 font-semibold text-white">{copy.save}</PendingSubmitButton>
      </ReliableForm>}
    {saved ? <SuccessMessage key={saved} locale={locale}>{copy.saved}</SuccessMessage> : null}
  </section>;
}

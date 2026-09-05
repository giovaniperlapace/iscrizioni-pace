import { redirect } from "next/navigation";
import { ReliableForm } from "@/components/reliable-form";
import { ParticipantCard, ParticipantQr, ParticipantFacts } from "@/app/dashboard/participant-card";
import { DeliveryFields } from "@/app/dashboard/capogruppo/delivery-fields";
import { renderQrDataUrl } from "@/lib/qrcode/render";
import { parseManualRegistrationForm } from "@/lib/registrations/manual-registration";
import { formFailure, issueFromMessage } from "@/lib/forms/result";
import { MANAGED_PARTICIPANT_COPY } from "@/lib/registrations/managed-participant-copy";
import { formatManagedAttendance } from "@/lib/registrations/managed-card";
import type { SupportedLocale } from "@/lib/i18n/config";

async function save(data: FormData) {
  "use server";
  const parsed=parseManualRegistrationForm(data);
  if (!parsed.ok) return formFailure(parsed.errors.map(issueFromMessage));
  redirect("/managed-participants-check?saved=1");
}
export default async function Fixture({ searchParams }: { searchParams: Promise<{ saved?: string; locale?: SupportedLocale }> }) {
 const params=await searchParams;
 const locale=params.locale && params.locale in MANAGED_PARTICIPANT_COPY ? params.locale : "it";
 const copy=MANAGED_PARTICIPANT_COPY[locale];
 return <main className="dashboard-modal fixed inset-0 z-50 grid place-items-center bg-black/30 p-3">
   <section role="dialog" aria-modal="true" aria-label="Scheda partecipante" className="w-full max-w-4xl rounded-lg bg-white p-5">
    <h1 className="mb-4 text-xl font-semibold">Persona di prova · Scheda partecipante</h1>
    <ParticipantCard qr={<ParticipantQr code="T3ST" dataUrl={await renderQrDataUrl("synthetic-opaque-qr-token")} active locale={locale} />}
      details={<ParticipantFacts items={[
        {label:copy.group,value:"Gruppo di prova"},{label:copy.status,value:copy.submitted},
        {label:copy.attendance,value:formatManagedAttendance([{day:"2026-10-01",day_part:null,choice:"yes"}],locale)},
        {label:copy.service,value:"Accoglienza"},
      ]} />}
    />
    <p className="my-4 text-sm">{copy.help}</p>
    {params.saved ? <p role="status">Salvato senza contatti personali</p> : <ReliableForm action={save} validation="manualRegistration" locale={locale} className="mt-4 grid gap-4 sm:grid-cols-2">
     <input type="hidden" name="groupId" value="11111111-1111-4111-8111-111111111111" />
     <input type="hidden" name="availabilityUnknown" value="on" />
     <label>Nome<input name="firstName" defaultValue="Persona" className="field" /></label>
     <label>Cognome<input name="lastName" defaultValue="Di prova" className="field" /></label>
     <label>{copy.personalEmail}<input name="email" type="email" className="field" /></label>
     <label>Telefono<input name="phone" type="tel" className="field" /></label>
     <DeliveryFields locale={locale} />
     <label className="col-span-full"><input name="consentConfirmed" type="checkbox" required /> Consenso dichiarato</label>
     <button type="submit" className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-white">{copy.save}</button>
    </ReliableForm>}
   </section>
 </main>;
}

// Mounted temporarily at /form-reliability-check by the browser regression runner.
import { redirect } from "next/navigation";
import { ReliableForm } from "@/components/reliable-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ManualAccessibilityFields } from "@/app/dashboard/capogruppo/manual-accessibility-fields";
import { ManualChildrenFields } from "@/app/dashboard/capogruppo/manual-children-fields";
import { createGroupLeaderManualRegistration } from "@/app/actions";
import { formFailure } from "@/lib/forms/result";

async function duplicate(data: FormData) {
  "use server";
  if (data.get("email") === "duplicate@example.org") return formFailure([{ field: "email", code: "duplicateEmail" }]);
  redirect("/form-reliability-check?saved=1");
}
async function serverValidation(data: FormData) {
  "use server";
  // Exercise the real action's server validator independently of browser validation.
  const copy = new FormData();
  for (const [key, value] of data) copy.append(key, value);
  copy.set("phone", "3331234567");
  return createGroupLeaderManualRegistration(copy);
}
export default async function FormFixture({ searchParams }: { searchParams: Promise<{ mode?: string; saved?: string }> }) {
  const { mode, saved } = await searchParams;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
    <section role="dialog" aria-modal="true" aria-label="Inserisci partecipante" className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6">
      <h1>Inserisci partecipante — verifica locale</h1>
      {saved ? <p role="status">Salvato</p> : <ReliableForm
        action={mode === "server" ? serverValidation : mode === "http" ? "/form-reliability-check/post" : duplicate}
        validation={mode ? undefined : "manualRegistration"} locale="it" className="grid gap-4 sm:grid-cols-2"
      >
        <input type="hidden" name="registrationId" value={mode === "http" ? "" : "test"} />
        <input type="hidden" name="participantId" value="test" />
        <label>Gruppo<select className="field" name="groupId" required defaultValue=""><option value="">Seleziona</option><option value="11111111-1111-4111-8111-111111111111">Gruppo prova</option></select></label>
        <label>Nome<input className="field" name="firstName" required minLength={2} /></label>
        <label>Cognome<input className="field" name="lastName" required minLength={2} /></label>
        <label>Email<input className="field" name="email" type="email" /></label>
        <label>Telefono<input className="field" name="phone" type="tel" /></label>
        <label>Data di nascita<input className="field" name="birthDate" type="date" /></label>
        <input type="hidden" name="availabilityUnknown" value="on" />
        <ManualChildrenFields locale="it" />
        <ManualAccessibilityFields locale="it" copy={{ title:"Accessibilità", help:"Solo opzioni strutturate", question:"Bisogni di accessibilità?", unknown:"Non so", yes:"Sì", no:"No" }} />
        <label className="col-span-full">Nota interna<textarea name="leaderNote" className="field" /></label>
        <label><input name="consentConfirmed" type="checkbox" required /> Consenso</label>
        <PendingSubmitButton>Inserisci partecipante</PendingSubmitButton>
      </ReliableForm>}
    </section>
  </div>;
}

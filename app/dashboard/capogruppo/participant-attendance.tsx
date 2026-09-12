import { SuccessMessage } from "@/components/success-message";
import { ReliableForm } from "@/components/reliable-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ManualAttendanceFields } from "./manual-attendance-fields";
import { buildAttendanceDayColumns } from "@/lib/registrations/attendance-slots";
import type { SupportedLocale } from "@/lib/i18n/config";
import type { FormFailure } from "@/lib/forms/result";

export function LeaderParticipantAttendance({ assignmentId, returnTo, attendance, locale, copy, action, savedMessage }: {
  savedMessage?: string;
  assignmentId: string;
  returnTo: string;
  attendance: { startsOn: string | null; endsOn: string | null; unknown: boolean; slots: string[] };
  locale: SupportedLocale;
  copy: { title: string; help: string; noDates: string; unknown: string };
  action: (data: FormData) => Promise<FormFailure | void>;
}) {
  return <ReliableForm action={action} locale={locale} className="grid min-w-0 gap-3" data-preserve-dashboard-scroll>
    {savedMessage ? <SuccessMessage locale={locale} clearQuery className="rounded-md border border-[#bad2b8] bg-[#edf7ea] p-3 text-sm text-[#2f6541]">{savedMessage}</SuccessMessage> : null}
    <input type="hidden" name="returnTo" value={returnTo} />
    <input type="hidden" name="assignmentId" value={assignmentId} />
    <ManualAttendanceFields
      key={`${assignmentId}:${attendance.unknown}:${attendance.slots.join(",")}`}
      eventDays={buildAttendanceDayColumns(attendance.startsOn, attendance.endsOn, locale)}
      locale={locale} initialUnknown={attendance.unknown} initialSlots={attendance.slots} copy={copy}
    />
    <PendingSubmitButton className="min-h-10 w-fit rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
      {({ it: "Salva presenze", en: "Save attendance", fr: "Enregistrer les présences", de: "Anwesenheit speichern", es: "Guardar asistencia", nl: "Aanwezigheid opslaan", uk: "Зберегти дні участі" })[locale]}
    </PendingSubmitButton>
  </ReliableForm>;
}

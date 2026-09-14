import { randomUUID } from "node:crypto";
import { updateOperationsAttendance } from "@/app/actions";
import { ReliableForm } from "@/components/reliable-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ManualAttendanceFields } from "./capogruppo/manual-attendance-fields";
import { buildAttendanceDayColumns } from "@/lib/registrations/attendance-slots";
import { loadOperationsAttendance } from "@/lib/registrations/operations-attendance.server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function OperationsAttendance({ registrationId, dashboard, returnTo, canManageEvent }: {
  registrationId: string; dashboard: "admin" | "manager"; returnTo: string;
  canManageEvent: (eventId: string) => boolean;
}) {
  let attendance;
  try {
    attendance = await loadOperationsAttendance(createSupabaseServiceClient(), registrationId, canManageEvent);
  } catch {
    return <p role="alert">Impossibile caricare le presenze. Riapri la scheda per riprovare.</p>;
  }
  if (!attendance) return null;
  return <ReliableForm key={randomUUID()} action={updateOperationsAttendance} locale="it" className="grid min-w-0 gap-3" data-preserve-dashboard-scroll>
    <input type="hidden" name="registrationId" value={registrationId} />
    <input type="hidden" name="sourceDashboard" value={dashboard} />
    <input type="hidden" name="returnTo" value={returnTo} />
    <ManualAttendanceFields locale="it" eventDays={buildAttendanceDayColumns(attendance.startsOn, attendance.endsOn, "it")}
      initialUnknown={attendance.unknown} initialSlots={attendance.slots}
      copy={{ title: "Presenza comunicata", help: "Visualizza e modifica i giorni e le fasce di presenza comunicati dal partecipante.", unknown: "Presenza da confermare", noDates: "Le date dell’evento non sono ancora disponibili." }} />
    <PendingSubmitButton className="min-h-11 w-fit rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white">Salva presenze</PendingSubmitButton>
  </ReliableForm>;
}

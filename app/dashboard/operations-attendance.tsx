"use client";

import { useEffect, useState } from "react";
import { updateOperationsAttendance } from "@/app/actions";
import { ReliableForm } from "@/components/reliable-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ManualAttendanceFields } from "./capogruppo/manual-attendance-fields";
import { buildAttendanceDayColumns } from "@/lib/registrations/attendance-slots";
import type { OperationsAttendanceData } from "@/lib/registrations/operations-attendance.server";

export function OperationsAttendance({ registrationId, dashboard, returnTo }: {
  registrationId: string; dashboard: "admin" | "manager"; returnTo: string;
}) {
  const [result, setResult] = useState<{ attendance: OperationsAttendanceData } | { error: true } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/dashboard/participants/attendance?registrationId=${encodeURIComponent(registrationId)}`, {
      signal: controller.signal, cache: "no-store",
    }).then(async (response) => {
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Attendance read failed");
      return response.json() as Promise<{ attendance: OperationsAttendanceData }>;
    }).then((data) => {
      if (!controller.signal.aborted) setResult(data);
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ error: true });
    });
    return () => controller.abort();
  }, [registrationId]);
  if (!result) return <p role="status">Caricamento presenze…</p>;
  if ("error" in result) return <p role="alert">Impossibile caricare le presenze. Riapri la scheda per riprovare.</p>;
  const attendance = result.attendance;
  if (!attendance) return null;
  return <ReliableForm action={updateOperationsAttendance} locale="it" className="grid min-w-0 gap-3" data-preserve-dashboard-scroll>
    <input type="hidden" name="registrationId" value={registrationId} />
    <input type="hidden" name="sourceDashboard" value={dashboard} />
    <input type="hidden" name="returnTo" value={returnTo} />
    <ManualAttendanceFields locale="it" eventDays={buildAttendanceDayColumns(attendance.startsOn, attendance.endsOn, "it")}
      initialUnknown={attendance.unknown} initialSlots={attendance.slots}
      copy={{ title: "Presenza comunicata", help: "Visualizza e modifica i giorni e le fasce di presenza comunicati dal partecipante.", unknown: "Presenza da confermare", noDates: "Le date dell’evento non sono ancora disponibili." }} />
    <PendingSubmitButton className="min-h-11 w-fit rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white">Salva presenze</PendingSubmitButton>
  </ReliableForm>;
}

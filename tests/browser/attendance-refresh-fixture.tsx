"use client";

import { Profiler } from "react";
import { EventAttendanceProvider, EventPresence } from "@/app/dashboard/event-attendance";
import { ParticipantReceptionPanel } from "@/app/dashboard/participant-reception-panel";
import { OperationsParticipantsTable } from "@/app/dashboard/operations-participants-table";
import { parseOperationsDashboardFilters } from "@/lib/registrations/operations-dashboard";
import type { OperationsParticipantRow } from "@/lib/registrations/operations-types";
import type { ReceptionCommand, ReceptionResult } from "@/lib/reception/contracts";

const eventId = "11111111-1111-4111-8111-111111111111";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const rows: OperationsParticipantRow[] = Array.from({ length: 500 }, (_, i) => ({
  registrationId: id(i), eventId, eventTitle: "Prova sintetica", participantId: id(i + 1000), authUserId: null,
  firstName: "Persona", lastName: `Prova ${i}`, name: `Persona Prova ${i}`, publicCode: "TEST", birthDate: "1980-01-01", country: "IT", city: "Roma", place: "Roma", email: null, phone: null,
  registrationStatus: "confirmed", submittedAt: "2026-10-17", currentGroupId: null, currentGroupName: null, currentGroupStatus: null, currentServiceId: null, currentServiceStatus: null, service: null, tagIds: [], tags: [], childrenCount: 0, children: [],
}));
async function commandAction(command: ReceptionCommand): Promise<ReceptionResult> {
  const response = await fetch("/fixture-presence-command", { method: "POST", body: JSON.stringify(command) });
  return response.json();
}
function measure(id: string, phase: string, duration: number) {
  if (phase === "mount") return;
  const target = document.querySelector<HTMLOutputElement>("[data-render-count]");
  if (target) {
    target.dataset.count = String(Number(target.dataset.count ?? 0) + 1);
    target.dataset.duration = String(Number(target.dataset.duration ?? 0) + duration);
  }
}
export default function Fixture() {
  return <main className="mx-auto grid max-w-6xl gap-5 p-4">
    <h1>Verifica aggiornamenti presenze</h1>
    <output data-render-count data-count="0" data-duration="0" />
    <section data-save><ParticipantReceptionPanel eventId={eventId} registrationId={id(0)} code="TEST" commandAction={commandAction}
      labelCommandAction={async () => ({ status: "forbidden" })} /></section>
    <section className="min-w-0" data-table><OperationsParticipantsTable snapshot={{ participants: rows, allParticipants: rows, groupOptions: [], operationalTags: [], eventServices: [], filters: parseOperationsDashboardFilters({}) }}
      selectedParticipant={null} attendancePanel={<p>Presenze previste sintetiche</p>} editableEventIds={[]} dashboard="manager" navMode="full" canDeleteRegistration={false} operatorId="refresh-fixture" eventId={eventId} eventStartsOn="2026-10-25" /></section>
    <section data-benchmark><EventAttendanceProvider eventId={eventId}>
      {rows.map(row => <Profiler key={row.registrationId} id={row.registrationId} onRender={measure}><EventPresence eventId={eventId} registrationId={row.registrationId} /></Profiler>)}
    </EventAttendanceProvider></section>
  </main>;
}

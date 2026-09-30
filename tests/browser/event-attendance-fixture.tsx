"use client";
import { useEffect, useState } from "react";
import { OperationsParticipantsTable } from "@/app/dashboard/operations-participants-table";
import { EventAttendanceReport } from "@/app/dashboard/event-attendance";
import type { OperationsParticipantRow } from "@/lib/registrations/operations-types";
import { parseOperationsDashboardFilters } from "@/lib/registrations/operations-dashboard";
const eventId = "11111111-1111-4111-8111-111111111111";
const row: OperationsParticipantRow = {
  registrationId: "registration", eventId, eventTitle: "Evento di prova", participantId: "person", authUserId: null,
  firstName: "Anna", lastName: "Prova", name: "Anna Prova", publicCode: "TEST", birthDate: "1980-01-01", country: "IT", city: "Roma", place: "Roma", email: null, phone: null,
  registrationStatus: "confirmed", submittedAt: "2026-09-30", currentGroupId: null, currentGroupName: null, currentGroupStatus: null, currentServiceId: null, currentServiceStatus: null, service: null, tagIds: [], tags: [], childrenCount: 1,
  children: [{ id: "child", first_name: "Minore", last_name: "Prova", birth_date: "2018-01-01", position: 1 }],
};
export default function Fixture() {
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const original = window.fetch;
    let mode = "absent";
    const change = (event: Event) => { mode = (event as CustomEvent).detail; };
    window.addEventListener("fixture-attendance", change);
    window.fetch = async (input, options) => {
      if (!String(input).startsWith("/dashboard/attendance")) return original(input, options);
      if (mode === "error" || mode === "forbidden") return new Response("{}", { status: mode === "forbidden" ? 403 : 503 });
      const entered = mode === "entered";
      return Response.json({ eventId, updatedAt: new Date().toISOString(), entries: entered ? { "registration:adult": "2026-09-30T10:00:00Z" } : {}, totals: { adults: entered ? 1 : 0, children: 0, students: entered ? 10 : 0, companions: entered ? 2 : 0, schoolBookings: entered ? 1 : 0, people: entered ? 13 : 0 } });
    };
    let disposed = false;
    queueMicrotask(() => { if (!disposed) setReady(true); });
    return () => { disposed = true; window.fetch = original; window.removeEventListener("fixture-attendance", change); };
  }, []);
  return <main className="mx-auto grid max-w-6xl gap-5 p-4">
    <h1>Collaudo ingressi evento</h1>
    <div className="flex flex-wrap gap-3">{["entered", "absent", "error", "forbidden"].map(mode => <button key={mode} className="btn-secondary p-3" onClick={() => { window.dispatchEvent(new CustomEvent("fixture-attendance", { detail: mode })); setVersion(n => n + 1); }}>{mode}</button>)}<button className="btn-secondary p-3" onClick={() => setSelected(true)}>Apri scheda</button></div>
    <p data-version={version}>Cambio sul server simulato: {version}</p>
    {ready && <><EventAttendanceReport eventId={eventId} /><OperationsParticipantsTable
      snapshot={{ participants: [row], allParticipants: [row], groupOptions: [], operationalTags: [], eventServices: [], filters: parseOperationsDashboardFilters({}) }}
      selectedParticipant={selected ? row : null} editableEventIds={[eventId]} dashboard="admin" navMode="full" canDeleteRegistration={false} operatorId="fixture" eventId={eventId} eventStartsOn="2026-10-25"
    /></>}
  </main>;
}

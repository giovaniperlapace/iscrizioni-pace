"use client";
import { useEffect, useState, type ReactNode } from "react";
import { OperationsParticipantsTable } from "@/app/dashboard/operations-participants-table";
import { EventAttendanceReport } from "@/app/dashboard/event-attendance";
import { notifyEventAttendanceChanged } from "@/lib/reception/attendance-events";
import type { OperationsParticipantRow } from "@/lib/registrations/operations-types";
import { parseOperationsDashboardFilters } from "@/lib/registrations/operations-dashboard";
const eventId = "11111111-1111-4111-8111-111111111111";
const row: OperationsParticipantRow = {
  registrationId: "registration", eventId, eventTitle: "Evento di prova", participantId: "person", authUserId: null,
  // This fixture covers the read model and unsaved fields; reception commands
  // with a public code are exercised separately by attendance-refresh.
  firstName: "Anna", lastName: "Prova", name: "Anna Prova", publicCode: null, birthDate: "1980-01-01", country: "IT", city: "Roma", place: "Roma", email: null, phone: null,
  registrationStatus: "confirmed", submittedAt: "2026-09-30", currentGroupId: null, currentGroupName: null, currentGroupStatus: null, currentServiceId: null, currentServiceStatus: null, service: null, tagIds: [], tags: [], childrenCount: 1,
  children: [{ id: "child", first_name: "Minore", last_name: "Prova", birth_date: "2018-01-01", position: 1 }],
};
export default function Fixture({ schoolLists, schoolDetail }: { schoolLists: ReactNode[]; schoolDetail: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState(false);
  const [schoolSelected, setSchoolSelected] = useState(false);
  const [version, setVersion] = useState(0);
  const [reportRead, setReportRead] = useState(0);
  useEffect(() => {
    const original = window.fetch;
    let mode = "absent";
    const change = (event: Event) => { mode = (event as CustomEvent).detail; notifyEventAttendanceChanged(); };
    window.addEventListener("fixture-attendance", change);
    const closeParticipant = () => { window.history.replaceState(null, "", window.location.pathname); setSelected(false); };
    window.addEventListener("fixture-close-participant", closeParticipant);
    window.fetch = async (input, options) => {
      if (!String(input).startsWith("/dashboard/attendance")) return original(input, options);
      if (mode === "error" || mode === "forbidden") return new Response("{}", { status: mode === "forbidden" ? 403 : 503 });
      const entered = mode === "entered";
      if (String(input).startsWith("/dashboard/attendance/report")) {
        const params = new URL(String(input),window.location.origin).searchParams;
        const day = params.get("day") || null, part = params.get("part") ?? "all";
        return Response.json({ eventId,updatedAt:new Date().toISOString(),day,part,
          expected:{ adults:2,children:1,students:20,companions:3,schoolBookings:1 },
          arrivals:{ adults:entered ? 1 : 0,children:0,students:entered ? 10 : 0,companions:entered ? 2 : 0,schoolBookings:entered ? 1 : 0 },
          operations:{ duplicateRequests:2,retries:1,corrections:3,cancellations:4 },
          hours:entered ? [{hour:"2026-09-30 12:00",people:13}] : [],
        });
      }
      return Response.json({ eventId, updatedAt: new Date().toISOString(), schoolEntries: entered ? { school: { checkedInAt: "2026-09-30T10:00:00Z", students: 10, companions: 2 } } : {}, entries: entered ? { "registration:adult": "2026-09-30T10:00:00Z" } : {}, totals: { adults: entered ? 1 : 0, children: 0, students: entered ? 10 : 0, companions: entered ? 2 : 0, schoolBookings: entered ? 1 : 0, people: entered ? 13 : 0 } });
    };
    let disposed = false;
    queueMicrotask(() => { if (!disposed) setReady(true); });
    return () => { disposed = true; window.fetch = original; window.removeEventListener("fixture-attendance", change); window.removeEventListener("fixture-close-participant", closeParticipant); };
  }, []);
  return <main className="mx-auto grid max-w-6xl gap-5 p-4">
    <h1>Collaudo ingressi evento</h1>
    <div className="flex flex-wrap gap-3">{["entered", "absent", "error", "forbidden"].map(mode => <button key={mode} className="btn-secondary p-3" onClick={() => { window.dispatchEvent(new CustomEvent("fixture-attendance", { detail: mode })); setVersion(n => n + 1); }}>{mode}</button>)}<button className="btn-secondary p-3" onClick={() => { window.history.replaceState(null, "", `${window.location.pathname}?edit=registration`); setSelected(true); }}>Apri scheda</button></div>
    <p data-version={version}>Cambio sul server simulato: {version}</p>
    <button onClick={() => setReportRead(value => value + 1)}>Aggiorna report ingressi</button>
    {ready && <><EventAttendanceReport key={reportRead} eventId={eventId} /><div className="min-w-0" data-participant-view><OperationsParticipantsTable
      snapshot={{ participants: [row], allParticipants: [row], groupOptions: [], operationalTags: [], eventServices: [], filters: parseOperationsDashboardFilters({}) }}
      selectedParticipant={selected ? row : null} editableEventIds={[eventId]} dashboard="manager" navMode="full" canDeleteRegistration={false} operatorId="fixture" eventId={eventId} eventStartsOn="2026-10-25"
    /></div>{(["iscritti", "panel"] as const).map(sourceSection => <div key={sourceSection} data-school-view={sourceSection}>
      <button className="btn-secondary p-3" onClick={() => { setSelected(false); setSchoolSelected(true); }}>Apri scheda scuola {sourceSection}</button>
      {schoolSelected && sourceSection === "iscritti" ? schoolDetail : schoolLists[sourceSection === "iscritti" ? 0 : 1]}
    </div>)}</>}
  </main>;
}

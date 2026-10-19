// Synthetic data, original shared table and participant dialog. Isolated copy only.
import { randomUUID } from "node:crypto";
import { OperationsParticipantsTable } from "@/app/dashboard/operations-participants-table";
import { parseOperationsDashboardFilters } from "@/lib/registrations/operations-dashboard";
import type { OperationsParticipantRow } from "@/lib/registrations/operations-types";
export default async function Fixture({ searchParams, dashboard }: {
  searchParams: Promise<Record<string, string>>; dashboard: "admin" | "manager";
}) {
  const params = await searchParams;
  const rows: OperationsParticipantRow[] = [0, 1].map(i => ({
    registrationId: `11111111-1111-4111-8111-11111111111${i}`, participantId: `person-${i}`,
    eventId: "33333333-3333-4333-8333-333333333333", eventTitle: "Evento sintetico", authUserId: null, firstName: i ? "Bruno" : "Anna",
    lastName: "Test", name: i ? "Bruno Test" : "Anna Test", publicCode: i ? "BT01" : "AT01",
    birthDate: "2000-01-01", country: "Italia", city: "Roma", place: "Roma", email: null, phone: null,
    registrationStatus: "confirmed", submittedAt: null, currentGroupId: null, currentGroupName: null,
    currentGroupStatus: null, currentServiceId: null, currentServiceStatus: null, service: null, tagIds: [], tags: [],
    childrenCount: params.children ? 1 : 0,
    children: params.children ? [{ id: "22222222-2222-4222-8222-222222222222", first_name: "Minore", last_name: "Test", birth_date: "2018-01-01", position: 0 }] : [],
    deletedAt: params.deleted ? "2026-10-01" : null,
  }));
  return <main className="p-4"><div aria-hidden="true" style={{ height: 1200 }} /><OperationsParticipantsTable
    dataVersion={randomUUID()}
    snapshot={{ participants: rows, allParticipants: rows, groupOptions: [], eventServices: [], operationalTags: [], filters: parseOperationsDashboardFilters({}) }}
    selectedParticipant={null} editableEventIds={params.viewer ? [] : ["33333333-3333-4333-8333-333333333333"]} dashboard={dashboard}
    navMode="mini" canDeleteRegistration={dashboard === "admin"} operatorId="synthetic-operator" eventId="33333333-3333-4333-8333-333333333333"
    eventStartsOn="2026-10-25" eventEndsOn="2026-10-27" /><div aria-hidden="true" style={{ height: 1200 }} /></main>;
}

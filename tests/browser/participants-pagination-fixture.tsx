// Local synthetic fixture: original table, filters, navigation and router.
import { OperationsParticipantsTable } from "@/app/dashboard/operations-participants-table";
import { OperationsParticipantsNavigation } from "@/app/dashboard/operations-participants-navigation";
import { applyOperationsDashboardFilters, parseOperationsDashboardFilters } from "@/lib/registrations/operations-dashboard";
import type { OperationsParticipantRow } from "@/lib/registrations/operations-types";

export async function PaginationFixture({ searchParams, dashboard }: {
  searchParams: Promise<Record<string, string>>;
  dashboard: "admin" | "manager";
}) {
  const params = await searchParams;
  const tag = { id: "tag", eventId: "event", label: "Tag prova", color: "#123456" };
  const rows: OperationsParticipantRow[] = Array.from({ length: 1203 }, (_, i) => ({
    registrationId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    participantId: `person-${i}`, eventId: "event", eventTitle: "Fixture event", authUserId: null,
    firstName: "Anna", lastName: `Test ${i}`, name: `Anna Test ${i}`, publicCode: `P${i}`,
    birthDate: "2000-01-01", country: "Italia", city: "Roma", place: "Roma Italia",
    email: `fixture${i}@example.test`, phone: "+39 1234567", registrationStatus: "submitted",
    submittedAt: "2026-09-01", currentGroupId: i % 2 ? null : "group",
    currentGroupName: i % 2 ? null : "Gruppo prova", currentGroupStatus: "confirmed",
    currentServiceId: i % 2 ? null : "service", currentServiceStatus: i % 2 ? null : "assigned",
    service: i % 2 ? null : {
      id: `assignment-${i}`, eventId: "event", registrationId: `registration-${i}`, participantId: `person-${i}`,
      serviceId: "service", serviceLabel: "Servizio prova", status: "assigned", source: "manager",
      participantNote: null, operatorNote: null, updatedAt: null,
    },
    tagIds: i % 2 ? [] : ["tag"], tags: i % 2 ? [] : [{ ...tag, assignedAt: null }],
    childrenCount: i === 100 ? 1 : 0,
    children: i === 100 ? [{ id: "child", first_name: "Minore", last_name: "Prova", birth_date: "2018-01-01", position: 0 }] : [],
    deletedAt: params.view === "deleted" ? "2026-10-01" : null,
  }));
  const filters = parseOperationsDashboardFilters(params);
  // A preselected statistics result, as supplied by the dashboard server loaders.
  const participants = applyOperationsDashboardFilters(params.stat ? rows.slice(900) : rows, filters);
  return <main className="p-5">
    <OperationsParticipantsNavigation dashboard={dashboard} navMode="mini" />
    <OperationsParticipantsTable snapshot={{
      allParticipants: rows, participants, filters,
      groupOptions: [{ id: "group", eventId: "event", name: "Gruppo prova" }],
      operationalTags: [tag],
      eventServices: [{ id: "service", eventId: "event", label: "Servizio prova", description: null, isActive: true, publicOrder: 0 }],
      statisticsFilter: params.stat ? { label: "Selezione sintetica", peopleCount: 303, registrationCount: 303, visibleRegistrationCount: participants.length } : null,
    }} selectedParticipant={rows.find(row => row.registrationId === params.edit) ?? null}
      attendancePanel={<></>} editableEventIds={params.viewer ? [] : ["event"]}
      dashboard={dashboard} navMode="mini" canDeleteRegistration={!params.viewer}
      operatorId="pagination-fixture" eventId="event" eventStartsOn="2026-10-25" />
  </main>;
}

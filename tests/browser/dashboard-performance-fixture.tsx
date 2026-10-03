// Mounted only by the local benchmark in an isolated checkout, without DB env.
import { OperationsParticipantsTable } from "@/app/dashboard/operations-participants-table";
import { parseOperationsDashboardFilters, applyOperationsDashboardFilters } from "@/lib/registrations/operations-dashboard";
import type { OperationsParticipantRow } from "@/lib/registrations/operations-types";

export async function PerformanceFixture({ searchParams, dashboard }: {
  searchParams: Promise<Record<string, string>>; dashboard: "admin" | "manager";
}) {
  const params = await searchParams;
  // Model a fixed server round trip, including on initial loads and deep links.
  await new Promise(resolve => setTimeout(resolve, 400));
  const rows: OperationsParticipantRow[] = Array.from({ length: 500 }, (_, i) => ({
    registrationId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    participantId: `person-${i}`, eventId: "event", eventTitle: "Fixture event", authUserId: null,
    firstName: "Anna", lastName: `Test ${i}`, name: `Anna Test ${i}`, publicCode: `P${i}`,
    birthDate: "2000-01-01", country: "Italia", city: "Roma", place: "Roma Italia",
    email: `fixture${i}@example.test`, phone: "+39 1234567", registrationStatus: "submitted",
    submittedAt: "2026-09-01", currentGroupId: null, currentGroupName: null, currentGroupStatus: null,
    currentServiceId: null, currentServiceStatus: null, service: null, tagIds: [], tags: [], childrenCount: 0, children: [],
  }));
  const filters = parseOperationsDashboardFilters(params);
  return <main className="p-5"><OperationsParticipantsTable
    snapshot={{ allParticipants: rows, participants: applyOperationsDashboardFilters(rows, filters), groupOptions: [], operationalTags: [], eventServices: [], filters }}
    selectedParticipant={rows.find(row => row.registrationId === params.edit) ?? null}
    attendancePanel={params.attendance === "live" ? undefined : <></>}
    editableEventIds={params.viewer ? [] : ["event"]} dashboard={dashboard} navMode="mini"
    canDeleteRegistration operatorId="performance-fixture" eventId="event" eventStartsOn="2026-10-25"
  /></main>;
}

import { StatisticsSection } from "@/app/dashboard/statistics-section";
import { OperationsParticipantsTable } from "@/app/dashboard/operations-participants-table";
import { singleDayStatistics, singleDayParticipants } from "@/tests/fixtures/single-day-attendance";
import { parseStatisticsDrilldown } from "@/lib/registrations/event-statistics";
import { applyStatisticsDrilldownToOperations, parseOperationsDashboardFilters } from "@/lib/registrations/operations-dashboard";
import type { OperationsParticipantRow } from "@/lib/registrations/operations-types";
const rows: OperationsParticipantRow[] = singleDayParticipants.map((p, i) => ({
  ...p, participantId: `person-${i}`, authUserId: null, firstName: "Prova", lastName: p.registrationId,
  publicCode: `TEST${i}`, birthDate: "1990-01-01", place: "—", email: null, phone: null,
  registrationStatus: "submitted", submittedAt: "2026-09-25", currentGroupStatus: null,
  currentServiceId: null, currentServiceStatus: null, service: null, tagIds: [], tags: [],
  childrenCount: p.children.length,
  children: p.children.map(c => ({ id: c.id, first_name: c.firstName!, last_name: c.lastName!, birth_date: c.birthDate!, position: c.position })),
}));
export default async function Fixture({ searchParams }: {searchParams: Promise<Record<string, string>>}) {
  const params = await searchParams;
  const dashboard = params.dashboard === "admin" ? "admin" : "manager";
  const navMode = params.nav === "mini" ? "mini" : "full";
  const filter = parseStatisticsDrilldown(params.stat);
  const selection = filter ? applyStatisticsDrilldownToOperations(rows, singleDayStatistics, filter) : null;
  return <main className="mx-auto min-w-0 max-w-6xl p-4">
    {selection ? <OperationsParticipantsTable
      snapshot={{ ...selection, allParticipants: rows, statisticsFilter: selection.summary, groupOptions: [], eventServices: [], operationalTags: [], filters: parseOperationsDashboardFilters({}) }}
      selectedParticipant={null} editableEventIds={[]} dashboard={dashboard} navMode={navMode}
      canDeleteRegistration={false} operatorId="single-day-fixture" eventId="event" eventStartsOn="2026-10-25" eventEndsOn="2026-10-27"
    /> : <StatisticsSection statistics={singleDayStatistics} report={params.report === "attendance" ? "attendance" : "territory"} dashboard={dashboard} navMode={navMode} />}
  </main>;
}

// Mounted only in an isolated copy without database credentials.
import { randomUUID } from "node:crypto";
import { OperationsParticipantsTable } from "@/app/dashboard/operations-participants-table";
import { OperationsParticipantsNavigation } from "@/app/dashboard/operations-participants-navigation";
import { loadOperationsParticipantPage } from "@/lib/registrations/operations-page.server";
import { parseOperationsDashboardFilters } from "@/lib/registrations/operations-dashboard";
import { operationsPageDatabase } from "@/tests/fixtures/operations-page";

export async function ServerPaginationFixture({ searchParams, dashboard }: {
  searchParams: Promise<Record<string, string>>;
  dashboard: "admin" | "manager";
}) {
  const params = await searchParams;
  const fixture = operationsPageDatabase();
  if (params.view === "deleted") for (const row of fixture.tables.registrations) row.deleted_at = "2026-10-01";
  const canManage = !params.viewer;
  const snapshot = await loadOperationsParticipantPage(fixture.db, {
    event: { id: "event", title: "Fixture event", starts_on: "2026-10-25" },
    actorId: "fixture", dashboard, canManage, locale: "it", params, filters: parseOperationsDashboardFilters(params),
  });
  return <main className="p-5">
    <OperationsParticipantsNavigation dashboard={dashboard} navMode="mini" />
    <OperationsParticipantsTable snapshot={snapshot}
      selectedParticipant={snapshot.allParticipants.find(row => row.registrationId === params.edit) ?? null}
      attendancePanel={<></>} editableEventIds={canManage ? ["event"] : []}
      dashboard={dashboard} navMode="mini" canDeleteRegistration={canManage}
      operatorId={`server-pagination-${dashboard}`} eventId="event" eventStartsOn="2026-10-25" dataVersion={randomUUID()} />
  </main>;
}

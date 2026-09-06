import { Suspense } from "react";
import { OperationsDuplicatesSection } from "@/app/dashboard/operations-duplicates-section";
import { OperationsParticipantsTable } from "@/app/dashboard/operations-participants-table";
import type {
  OperationsParticipantRow,
  OperationsParticipantsSnapshot,
} from "@/lib/registrations/operations-types";
export type { OperationsParticipantRow } from "@/lib/registrations/operations-types";

export function OperationsParticipantsSection({
  snapshot,
  selectedParticipant,
  canManageEvent,
  dashboard,
  navMode,
  canDeleteRegistration = false,
  operatorId,
  eventId,
  eventStartsOn,
  searchParams,
}: {
  snapshot: OperationsParticipantsSnapshot;
  selectedParticipant: OperationsParticipantRow | null;
  canManageEvent: (eventId: string) => boolean;
  dashboard: "admin" | "manager";
  navMode: "full" | "mini";
  canDeleteRegistration?: boolean;
  operatorId: string;
  eventId: string | null;
  eventStartsOn: string | null;
  searchParams?: Record<string, string | undefined>;
}) {
  return (
    <>
      <OperationsParticipantsTable
        snapshot={{
          participants: snapshot.participants,
          allParticipants: snapshot.allParticipants,
          groupOptions: snapshot.groupOptions,
          operationalTags: snapshot.operationalTags,
          eventServices: snapshot.eventServices,
          filters: snapshot.filters,
          statisticsFilter: snapshot.statisticsFilter,
        }}
        selectedParticipant={selectedParticipant}
        editableEventIds={[
          ...new Set(
            snapshot.groupOptions
              .map((group) => group.eventId)
              .concat(eventId ?? [])
              .filter(canManageEvent),
          ),
        ]}
        dashboard={dashboard}
        navMode={navMode}
        canDeleteRegistration={canDeleteRegistration}
        operatorId={operatorId}
        eventId={eventId}
        eventStartsOn={eventStartsOn}
      />
      {eventId && (
        <Suspense
          fallback={
            <section
              className="surface-card p-5"
              aria-label="Controllo duplicati"
            >
              <h2 className="text-xl font-semibold">Controllo duplicati</h2>
              <p role="status">Controllo in corso…</p>
            </section>
          }
        >
          <OperationsDuplicatesSection
            dashboard={dashboard}
            searchParams={searchParams}
          />
        </Suspense>
      )}
    </>
  );
}

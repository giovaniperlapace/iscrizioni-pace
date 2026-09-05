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
}) {
  return (
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
  );
}

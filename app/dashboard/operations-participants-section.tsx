import Link from "@/components/pending-link";
import { UserPlus } from "lucide-react";
import { getRequestLocale } from "@/lib/i18n/server";
import { MANUAL_REGISTRATION_COPY } from "@/lib/registrations/manual-registration-copy";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { OperationsParticipantsNavigation } from "@/app/dashboard/operations-participants-navigation";
import { OperationsDuplicatesSection } from "@/app/dashboard/operations-duplicates-section";
import { OperationsParticipantsTable } from "@/app/dashboard/operations-participants-table";
import type {
  OperationsParticipantRow,
  OperationsParticipantsSnapshot,
} from "@/lib/registrations/operations-types";
export type { OperationsParticipantRow } from "@/lib/registrations/operations-types";

export async function OperationsParticipantsSection({
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
  const locale = await getRequestLocale();
  const duplicatesView = searchParams?.view === "duplicates";
  return (
    <>
      <OperationsParticipantsNavigation
        dashboard={dashboard}
        navMode={navMode}
      />
      {eventId && canManageEvent(eventId) ? (
        <div className="flex justify-end">
          <Link href="/dashboard/manager/nuovo" prefetch={false} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--peace-blue-800)] px-4 py-2 text-sm font-semibold text-white">
            <UserPlus size={18} aria-hidden />{MANUAL_REGISTRATION_COPY[locale].addParticipant}
          </Link>
        </div>
      ) : null}
      <OperationsParticipantsTable
        dataVersion={randomUUID()}
        dialogOnly={duplicatesView}
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
      {duplicatesView && eventId && (
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
      {duplicatesView && !eventId && (
        <p>Nessun evento disponibile per il controllo duplicati.</p>
      )}
    </>
  );
}

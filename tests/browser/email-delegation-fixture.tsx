"use client";
import { useSearchParams } from "next/navigation";
import { normalizeLocale } from "@/lib/i18n/config";
import { OperationsParticipantsTable } from "@/app/dashboard/operations-participants-table";
import { LeaderParticipantsTable } from "@/app/dashboard/capogruppo/participants-table";
import { parseOperationsDashboardFilters } from "@/lib/registrations/operations-dashboard";
import type { OperationsParticipantRow } from "@/lib/registrations/operations-types";
const rows: OperationsParticipantRow[] = ["01 Delegated", "02 Missing", "03 Personal"].map((name, i) => ({
  registrationId: `reg-${i}`, participantId: `person-${i}`, eventId: "event", eventTitle: "Synthetic",
  authUserId: null, firstName: name, lastName: "Person", name, publicCode: `TEST${i}`, birthDate: null,
  country: null, city: null, place: "—", email: i === 2 ? "personal@example.test" : null, emailDelegated: i !== 1,
  phone: null, registrationStatus: "submitted", submittedAt: "2026-09-25", currentGroupId: "group",
  currentGroupName: "Synthetic group", currentGroupStatus: "confirmed", currentServiceId: null,
  currentServiceStatus: null, service: null, tagIds: [], tags: [], childrenCount: 0, children: [],
}));
export default function Fixture() {
  const locale = normalizeLocale(useSearchParams().get("locale")) ?? "it";
  return <main className="mx-auto min-w-0 max-w-6xl p-4">
    {["manager", "admin"].map(role => <section data-table={role} key={role}>
      <h2>{role}</h2>
      <OperationsParticipantsTable snapshot={{ participants: rows, allParticipants: rows, groupOptions: [], operationalTags: [], eventServices: [], filters: parseOperationsDashboardFilters({}) }}
        selectedParticipant={null} editableEventIds={[]} dashboard={role as "manager" | "admin"} navMode="mini"
        canDeleteRegistration={false} operatorId={`email-indicator-${role}`} eventId="event" eventStartsOn="2026-10-25" locale={locale} />
    </section>)}
    <section data-table="capogruppo"><h2>Capogruppo</h2>
      <LeaderParticipantsTable locale={locale} operatorId="email-indicator-leader" startsOn="2026-10-25" rows={rows.map(row => ({
        id: row.registrationId, registrationId: row.registrationId, groupId: "group", participantName: row.name,
        participantCode: row.publicCode, participantEmail: row.email, emailDelegated: row.emailDelegated,
        participantPhone: null, participantPlace: "—", participantCity: null, participantCountry: null,
        groupName: "Synthetic group", birthDate: null, submittedAt: row.submittedAt, tagIds: [], children: [],
        serviceLabel: null, tags: [],
      }))} />
    </section>
  </main>;
}

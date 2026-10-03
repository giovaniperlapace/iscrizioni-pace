"use client";
import { useSearchParams } from "next/navigation";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { OperationsChildrenSection } from "@/app/dashboard/operations-children-section";
import { OperationsParticipantsNavigation } from "@/app/dashboard/operations-participants-navigation";
import { OperationsParticipantsTable } from "@/app/dashboard/operations-participants-table";
import { parseOperationsDashboardFilters } from "@/lib/registrations/operations-dashboard";
import type { OperationsParticipantRow } from "@/lib/registrations/operations-types";
const rows: OperationsParticipantRow[] = [
  "Genitore Esempio",
  "Autonomo Quattordici",
  "Autonomo Quindici",
].map((name, i) => ({
  registrationId: `reg-${i}`,
  participantId: `p-${i}`,
  eventId: "event",
  eventTitle: "Evento",
  authUserId: null,
  firstName: name.split(" ")[0],
  lastName: name.split(" ")[1],
  name,
  publicCode: `TEST${i}`,
  birthDate: [null, "2011-10-26", "2011-10-25"][i],
  country: "Italia",
  city: i ? "Roma" : null,
  place: "Roma, Italia",
  email: i ? `${i}@example.test` : null,
  phone: "123456",
  registrationStatus: "submitted",
  submittedAt: "2026-09-01",
  currentGroupId: i ? null : "g",
  currentGroupName: i ? null : "Roma",
  currentGroupStatus: null,
  currentServiceId: null,
  currentServiceStatus: null,
  service: null,
  tagIds: [],
  tags: [],
  childrenCount: i ? 0 : 2,
  children: i
    ? []
    : [
        {
          id: "c1",
          first_name: "Ada",
          last_name: "Esempio",
          birth_date: "2020-01-01",
          position: 0,
        },
        {
          id: "c2",
          first_name: "Bruno",
          last_name: "Esempio",
          birth_date: "2010-01-01",
          position: 1,
        },
      ],
}));
export default function Fixture() {
  const params = useSearchParams();
  const dashboard = params.get("dashboard") === "admin" ? "admin" : "manager";
  const navigate = (href: string) => {
    const url = new URL(href, location.href);
    url.searchParams.set("dashboard", dashboard);
    history.pushState(null, "", `/children-overview-check?${url.searchParams}`);
  };
  return (
    <AppRouterContext.Provider
      value={{
        ...{ bfcacheId: "children-check" },
        back() {},
        forward() {},
        refresh() {},
        prefetch() {},
        push: navigate,
        replace: navigate,
      }}
    >
      <main
        className="mx-auto grid min-w-0 max-w-6xl gap-4 p-4"
        onClickCapture={(event) => {
          const anchor = (event.target as Element).closest("a");
          if (
            !anchor ||
            !new URL(anchor.href).pathname.startsWith("/dashboard/")
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          navigate(anchor.href);
        }}
        onSubmitCapture={(event) => {
          if (
            !(event.target instanceof HTMLFormElement) ||
            !event.target.querySelector('[name="childrenQuery"]')
          )
            return;
          event.preventDefault();
          navigate(
            `${event.target.action}?${new URLSearchParams(new FormData(event.target) as unknown as Record<string, string>)}`,
          );
        }}
      >
        <OperationsParticipantsNavigation
          dashboard={dashboard}
          navMode="mini"
        />
        <OperationsChildrenSection
          participants={rows}
          dashboard={dashboard}
          navMode="mini"
          eventId="event"
          eventStartsOn="2026-10-25"
        />
        <OperationsParticipantsTable
          locale="it"
          dataVersion="fixture"
          dialogOnly
          snapshot={{
            participants: rows,
            allParticipants: rows,
            groupOptions: [],
            operationalTags: [],
            eventServices: [],
            filters: parseOperationsDashboardFilters({}),
          }}
          selectedParticipant={null}
          editableEventIds={[]}
          canDeleteRegistration={false}
          dashboard={dashboard}
          navMode="mini"
          operatorId="viewer"
          eventId="event"
          eventStartsOn="2026-10-25"
        />
      </main>
    </AppRouterContext.Provider>
  );
}

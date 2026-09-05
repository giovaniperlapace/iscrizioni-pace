"use client";
// Real shared UI with synthetic data and a local in-memory transport. SQL tests
// separately exercise the exact production RPCs, roles, policies and rollback.
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { OperationsParticipantsTable } from "@/app/dashboard/operations-participants-table";
import type { OperationsParticipantRow as Row } from "@/lib/registrations/operations-types";
import {
  parseOperationsDashboardFilters,
  applyOperationsDashboardFilters,
} from "@/lib/registrations/operations-dashboard";

const seed: Row[] = Array.from({ length: 12 }, (_, i) => ({
  registrationId: `reg-${i}`,
  participantId: `person-${i}`,
  eventId: "event",
  eventTitle: "Fixture event",
  authUserId: null,
  firstName: i === 0 ? "Anna" : "Persona",
  lastName: i === 0 ? "Bianchi" : `Prova ${i}`,
  name: i === 0 ? "Anna Bianchi" : `Persona Prova ${i}`,
  publicCode: `FIX${i}`,
  birthDate: `${2000 + i}-01-01`,
  country: i % 2 ? "Italia" : "Francia",
  city: i % 2 ? "Roma" : "Parigi",
  place: "Roma Italia",
  email: `fixture${i}@example.test`,
  phone: "+39 1234567",
  registrationStatus: "submitted",
  submittedAt: "2026-09-01",
  currentGroupId: i % 3 ? "group1" : null,
  currentGroupName: i % 3 ? "Gruppo Roma" : null,
  currentGroupStatus: i % 3 ? "confirmed" : null,
  currentServiceId: null,
  currentServiceStatus: null,
  service: null,
  tagIds: [],
  tags: [],
  childrenCount: 0,
  children: [],
}));
const groupOptions = [
  { id: "group1", eventId: "event", name: "Gruppo Roma" },
  { id: "group2", eventId: "event", name: "Gruppo Parigi" },
];
const eventServices = [
  {
    id: "service1",
    eventId: "event",
    label: "Accoglienza",
    description: null,
    isActive: true,
    publicOrder: 1,
  },
];
const operationalTags = [
  { id: "tag1", eventId: "event", label: "Volontari", color: "#123456" },
  { id: "tag2", eventId: "event", label: "Da contattare", color: "#456789" },
];

export default function Fixture() {
  const [rows, setRows] = useState(seed);
  const [viewer, setViewer] = useState(false);
  const [operatorId, setOperatorId] = useState("browser-operator-a");
  const [lastReturn, setLastReturn] = useState("");
  const params = useSearchParams();
  const navigate = (href: string) => {
    const url = new URL(href, location.href);
    history.replaceState(
      null,
      "",
      `/participant-operations-check${url.search}`,
    );
  };
  useEffect(() => {
    const originalFetch = window.fetch;
    const originalHistory = history.replaceState.bind(history);
    history.replaceState = (state, title, url) => {
      const target = url ? new URL(String(url), location.href) : null;
      originalHistory(
        state,
        title,
        target?.pathname.startsWith("/dashboard/")
          ? `/participant-operations-check${target.search}`
          : url,
      );
    };
    window.fetch = async (input, init) => {
      const path = String(input);
      if (!path.includes("/participants/") || !(init?.body instanceof FormData))
        return originalFetch(input, init);
      const data = init.body;
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (document.documentElement.dataset.failNext === "true") {
        delete document.documentElement.dataset.failNext;
        return Response.json(
          { error: "Errore simulato. Riprova." },
          { status: 422 },
        );
      }
      setLastReturn(String(data.get("returnTo") ?? ""));
      setRows((previous) =>
        previous.map((row) => {
          if (row.registrationId !== data.get("registrationId")) return row;
          const next = { ...row };
          if (path.endsWith("/quick-update")) {
            const value = String(data.get("value") ?? "");
            if (data.get("field") === "group") {
              next.currentGroupId = value || null;
              next.currentGroupName =
                groupOptions.find((group) => group.id === value)?.name ?? null;
            }
            if (data.get("field") === "tags") {
              next.tagIds = data.getAll("value").map(String);
              next.tags = operationalTags
                .filter((tag) => next.tagIds.includes(tag.id))
                .map((tag) => ({ ...tag, assignedAt: null }));
            }
            if (data.get("field") === "service") {
              next.currentServiceId = value || null;
              next.service = value
                ? {
                    id: "service-assignment",
                    eventId: "event",
                    registrationId: row.registrationId,
                    participantId: row.participantId,
                    serviceId: value,
                    serviceLabel: "Accoglienza",
                    status: "assigned",
                    source: "manager",
                    participantNote: null,
                    operatorNote: null,
                    updatedAt: null,
                  }
                : null;
            }
          } else if (path.endsWith("/delete")) {
            next.deletedAt =
              data.get("intent") === "restore" ? null : "2026-09-05";
            next.deletedBy = "fixture-admin";
            next.deletionReason = String(data.get("reason"));
          } else {
            next.firstName = String(data.get("firstName"));
            next.name = `${next.firstName} ${next.lastName}`;
          }
          return next;
        }),
      );
      return Response.json(
        path.endsWith("/quick-update")
          ? { ok: true }
          : { redirect: String(data.get("returnTo")) },
      );
    };
    const capture = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest("a");
      if (!anchor || !new URL(anchor.href).pathname.startsWith("/dashboard/"))
        return;
      event.preventDefault();
      event.stopPropagation();
      navigate(anchor.href);
    };
    document.addEventListener("click", capture, true);
    return () => {
      window.fetch = originalFetch;
      history.replaceState = originalHistory;
      document.removeEventListener("click", capture, true);
    };
  }, []);
  const filters = parseOperationsDashboardFilters(Object.fromEntries(params));
  const visible = rows.filter((row) =>
    params.get("view") === "deleted" ? row.deletedAt : !row.deletedAt,
  );
  const snapshot = {
    participants: applyOperationsDashboardFilters(visible, filters),
    allParticipants: visible,
    groupOptions,
    eventServices,
    operationalTags,
    filters,
  };
  return (
    <AppRouterContext.Provider
      value={{
        back() {},
        forward() {},
        refresh() {},
        prefetch() {},
        push: navigate,
        replace: navigate,
      }}
    >
      <main className="mx-auto w-full min-w-0 max-w-7xl p-5">
        <div className="mb-6 flex gap-4">
          <button onClick={() => setViewer(!viewer)}>
            Modalità {viewer ? "modifica" : "sola lettura"}
          </button>
          <button
            onClick={() =>
              setOperatorId((id) =>
                id.endsWith("a") ? "browser-operator-b" : "browser-operator-a",
              )
            }
          >
            Cambia operatore
          </button>
        </div>
        <output className="sr-only" data-last-return>
          {lastReturn}
        </output>
        <OperationsParticipantsTable
          snapshot={snapshot}
          selectedParticipant={
            visible.find((row) => row.registrationId === params.get("edit")) ??
            null
          }
          editableEventIds={viewer ? [] : ["event"]}
          dashboard="admin"
          navMode="mini"
          canDeleteRegistration={!viewer}
          operatorId={operatorId}
          eventId="event"
          eventStartsOn="2026-10-25"
        />
      </main>
    </AppRouterContext.Provider>
  );
}

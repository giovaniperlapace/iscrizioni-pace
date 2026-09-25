"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { OperationsParticipantsTable } from "@/app/dashboard/operations-participants-table";
import { parseOperationsDashboardFilters } from "@/lib/registrations/operations-dashboard";

export default function Fixture() {
  const params = useSearchParams();
  const dashboard = params.get("dashboard") === "admin" ? "admin" : "manager";
  const viewer = params.get("role") === "viewer";
  const navigate = (href: string) => {
    const url = new URL(href, location.href);
    url.searchParams.set("dashboard", dashboard);
    history.pushState(null, "", `/service-import-check?${url.searchParams}`);
  };
  useEffect(() => {
    const original = window.fetch;
    let lost = false;
    window.fetch = async (input, init) => {
      if (String(input) === "/dashboard/participants/service-import/api") {
        if (init?.body instanceof FormData) {
          document.documentElement.dataset.importId = String(init.body.get("importId"));
          document.documentElement.dataset.importCalls = String(Number(document.documentElement.dataset.importCalls ?? 0) + 1);
        }
        const response = await original("/service-import-check/api", init);
        if (init?.method === "POST" && !lost && new URLSearchParams(location.search).has("lost")) {
          lost = true;
          // Real DB commit succeeds; simulate losing only the first HTTP response.
          await response.text();
          throw new Error("Risposta persa dopo il salvataggio. Riprova con lo stesso file.");
        }
        return response;
      }
      return original(input, init);
    };
    return () => { window.fetch = original; };
  }, []);
  return <AppRouterContext.Provider value={{ ...{ bfcacheId: "service-import-check" }, back() {}, forward() {}, refresh() {}, prefetch() {}, push: navigate, replace: navigate }}>
    <main className="app-page min-w-0" onClickCapture={(event) => {
      const anchor = (event.target as Element).closest("a");
      if (!anchor || !new URL(anchor.href).pathname.startsWith("/dashboard/") || anchor.href.includes("/api")) return;
      event.preventDefault(); event.stopPropagation(); navigate(anchor.href);
    }}>
      <h1 className="mb-5 text-2xl font-bold">Importazione servizi — collaudo locale</h1>
      <OperationsParticipantsTable snapshot={{ participants: [], allParticipants: [], groupOptions: [], eventServices: [], operationalTags: [], filters: parseOperationsDashboardFilters({}) }}
        selectedParticipant={null} editableEventIds={viewer ? [] : ["event"]} dashboard={dashboard} navMode="mini" canDeleteRegistration={false}
        operatorId="service-import-fixture" eventId="event" eventStartsOn="2026-10-25" />
    </main>
  </AppRouterContext.Provider>;
}

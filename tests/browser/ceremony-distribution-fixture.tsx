"use client";
import { useRef, useState } from "react";
import { CeremonyDistribution } from "@/app/dashboard/ceremony-distribution";
import { PersonalCeremonySeats } from "@/app/dashboard/partecipante/cerimonie/seats";
import type {
  DistributionView,
  NomineeCommand,
} from "@/lib/ceremonies/distribution";
import type { SupportedLocale } from "@/lib/i18n/config";
const initial: DistributionView = {
  allocations: [
    {
      id: "a",
      planId: "p",
      kind: "opening",
      revision: 1,
      state: "validated",
      groupId: "g",
      groupName: "Gruppo sintetico",
      location: "Sala inaugurazione",
      startsAt: "2026-10-25T10:00:00Z",
      sector: "Platea",
      category: "Delegazioni",
      quantity: 1,
      used: 0,
    },
  ],
  nominees: [],
  people: [
    {
      registrationId: "r",
      name: "Anna Presente",
      code: "TEST",
      groupIds: ["g"],
      children: [
        { id: "c1", name: "Luca Minore" },
        { id: "c2", name: "Maria Minore" },
      ],
      eligiblePlanIds: ["p"],
      assigned: [],
    },
  ],
};
export default function Fixture() {
  const [locale, setLocale] = useState<SupportedLocale>("it"),
    [role, setRole] = useState("manager"),
    [outcome, setOutcome] = useState("saved");
  const state = useRef<DistributionView>(structuredClone(initial)),
    requests = useRef(new Set<string>()),
    [last, setLast] = useState("");
  const [calls, setCalls] = useState(0);
  async function save(command: NomineeCommand) {
    setCalls((v) => v + 1);
    setLast(command.requestId);
    if (outcome === "conflict") return { status: "conflict" };
    if (!requests.current.has(command.requestId)) {
      requests.current.add(command.requestId);
      if (command.action === "assign" || command.action === "no_seat") {
        const person = state.current.people[0],
          name =
            person.children.find((c) => c.id === command.childId)?.name ??
            person.name;
        state.current.nominees.push({
          id: command.requestId,
          allocationId: "a",
          registrationId: "r",
          childId: command.childId,
          needsSeat: command.action === "assign",
          name,
          review: false,
        });
        person.assigned.push({
          planId: "p",
          childId: command.childId,
          needsSeat: command.action === "assign",
        });
        if (command.action === "assign") state.current.allocations[0].used++;
      }
      if (command.action === "revoke") {
        const n = state.current.nominees.find(
          (n) => n.id === command.nomineeId,
        )!;
        state.current.nominees = state.current.nominees.filter(
          (x) => x.id !== n.id,
        );
        state.current.people[0].assigned =
          state.current.people[0].assigned.filter(
            (x) => x.childId !== n.childId,
          );
        if (n.needsSeat) state.current.allocations[0].used--;
      }
      state.current.allocations[0].revision++;
    }
    if (outcome === "lost") {
      setOutcome("saved");
      throw Error("Synthetic response lost after commit");
    }
    return { status: "saved" };
  }
  return (
    <main className="app-page">
      <div className="mx-auto grid max-w-6xl gap-5 p-4">
        <label>
          Lingua test
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as SupportedLocale)}
          >
            {["it", "en", "fr", "de", "es", "nl", "uk"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label>
          Ruolo test
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option>manager</option>
            <option>leader</option>
            <option>viewer</option>
          </select>
        </label>
        <label>
          Esito test
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option>saved</option>
            <option>conflict</option>
            <option>lost</option>
          </select>
        </label>
        <output data-calls={calls} data-request={last} />
        <CeremonyDistribution
          initialView={initial}
          locale={locale}
          canManage={role !== "viewer"}
          save={save}
          refresh={async () => structuredClone(state.current)}
        />
        <PersonalCeremonySeats
          locale={locale}
          seats={[
            {
              id: "personal",
              kind: "closing",
              name: "Maria Minore",
              child: true,
              needsSeat: false,
              location: "Sede finale diversa",
              startsAt: "2026-10-27T18:00:00Z",
              sector: "Esterno",
              category: "Famiglie",
              review: false,
            },
          ]}
        />
      </div>
    </main>
  );
}

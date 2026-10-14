"use client";
import { useRef, useState } from "react";
import { CeremonyMapWorkspace } from "@/app/dashboard/ceremony-map-workspace";
import { PersonalCeremonySeats } from "@/app/dashboard/partecipante/cerimonie/seats";
import type { SeatMapView, SeatMapCommand } from "@/lib/ceremonies/seat-map";
import type { SupportedLocale } from "@/lib/i18n/config";
const id = (i: number) =>
  `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`;
const initial: SeatMapView = {
  planId: id(100),
  kind: "opening",
  revision: 1,
  state: "validated",
  draft: null,
  history: [],
  sectors: [{ id: id(30), name: "Platea sintetica", capacity: 20 }],
  active: {
    id: id(40),
    version: 1,
    title: "Sala sintetica · inaugurazione",
    seats: Array.from({ length: 20 }, (_, i) => ({
      id: id(i + 1),
      sectorId: id(30),
      row: i < 10 ? "A" : "B",
      number: String((i % 10) + 1),
      x: (i % 10) * 60,
      y: i < 10 ? 20 : 100,
      blocked: i === 19,
    })),
  },
  allocations: [
    {
      id: id(50),
      planId: id(100),
      kind: "opening",
      revision: 1,
      state: "validated",
      groupId: id(60),
      groupName: "Gruppo sintetico",
      location: "Sede inaugurazione",
      startsAt: "2026-10-25T10:00:00Z",
      sector: "Platea sintetica",
      sectorId: id(30),
      category: "Delegazioni",
      quantity: 3,
      used: 2,
    },
  ],
  nominees: [
    {
      id: id(70),
      allocationId: id(50),
      registrationId: id(80),
      childId: null,
      needsSeat: true,
      name: "Anna Sintetica",
      review: false,
    },
    {
      id: id(71),
      allocationId: id(50),
      registrationId: id(80),
      childId: id(81),
      needsSeat: true,
      name: "Luca Minore",
      review: false,
    },
    {
      id: id(72),
      allocationId: id(50),
      registrationId: id(80),
      childId: id(82),
      needsSeat: false,
      name: "Maria Senza Posto",
      review: false,
    },
  ],
  claims: [],
};
export default function Fixture() {
  const [role, setRole] = useState("manager"),
    [locale, setLocale] = useState<SupportedLocale>("it"),
    [outcome, setOutcome] = useState("saved"),
    [last, setLast] = useState(""),
    [calls, setCalls] = useState(0);
  const state = useRef(structuredClone(initial)),
    requests = useRef(new Set<string>());
  async function save(c: SeatMapCommand) {
    setLast(c.requestId);
    setCalls((n) => n + 1);
    if (outcome === "conflict") return { status: "conflict" };
    if (!requests.current.has(c.requestId)) {
      requests.current.add(c.requestId);
      if (c.operation === "reserve")
        state.current.claims.push(
          ...c.data.seatIds.map((seatId) => ({
            seatId,
            allocationId: c.data.allocationId,
            nomineeId: null,
          })),
        );
      if (c.operation === "name")
        for (const x of state.current.claims)
          if (c.data.seatIds.includes(x.seatId))
            x.nomineeId = c.data.nomineeId!;
      if (c.operation === "unname")
        for (const x of state.current.claims)
          if (c.data.seatIds.includes(x.seatId)) x.nomineeId = null;
      if (c.operation === "release")
        state.current.claims = state.current.claims.filter(
          (x) => !c.data.seatIds.includes(x.seatId),
        );
      if (c.operation === "draft")
        state.current.draft = { ...c.data, id: id(41), version: 2 };
      if (c.operation === "publish") {
        state.current.history.push(state.current.active!);
        state.current.active = state.current.draft;
        state.current.draft = null;
      }
      state.current.revision++;
    }
    if (outcome === "lost") {
      setOutcome("saved");
      throw Error("Synthetic lost response");
    }
    return { status: "saved" };
  }
  return (
    <main className="app-page">
      <div className="mx-auto grid max-w-6xl min-w-0 gap-5 p-4">
        <p>Fixture sintetica P13-E3</p>
        <label>
          Ruolo test
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {["manager", "admin", "leader", "viewer"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
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
          Esito test
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            {["saved", "lost", "conflict"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <output data-request={last} data-calls={calls} />
        <CeremonyMapWorkspace
          initialView={initial}
          locale={locale}
          admin={role === "admin"}
          manager={["admin", "manager"].includes(role)}
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
              name: "Anna Sintetica",
              child: false,
              needsSeat: true,
              location: "Sede finale diversa",
              startsAt: "2026-10-27T18:00:00Z",
              sector: "Esterno",
              category: "Delegazioni",
              review: false,
              seat: { id: id(99), row: "Z", number: "8", mapVersion: 3 },
              mapAvailable: true,
            },
          ]}
        />
      </div>
    </main>
  );
}

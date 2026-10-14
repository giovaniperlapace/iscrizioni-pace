"use client";
import { useState } from "react";
import { CeremonyWorkspace } from "@/app/dashboard/manager/cerimonie/workspace";
import type { CeremonySnapshot } from "@/lib/ceremonies/contracts";
const id = "11111111-1111-4111-8111-111111111111";
const snapshot: CeremonySnapshot = {
  plan: {
    id,
    revision: 3,
    state: "validated",
    location: "Sala sintetica inaugurazione",
    capacity: 100,
    startsAt: "2026-10-25T10:00",
    endsAt: "2026-10-25T12:00",
    attendancePart: "morning",
  },
  sectors: [{ id, name: "Platea", capacity: 100 }],
  quotas: [{ id, sectorId: id, category: "Delegazioni", quantity: 80 }],
  allocations: [
    {
      id,
      quotaId: id,
      groupId: id,
      registrationId: null,
      name: "Gruppo sintetico",
      quantity: 20,
      review: false,
    },
  ],
  people: [
    {
      id,
      name: "Anna Presente",
      code: "TST1",
      children: [
        { id: "44444444-4444-4444-8444-444444444444", name: "Luca Minore" },
      ],
      eligibility: "eligible",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Marco Da verificare",
      code: "TST2",
      children: [],
      eligibility: "unknown",
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Maria Assente",
      code: "TST3",
      children: [],
      eligibility: "absent",
    },
  ],
  groups: [{ id, name: "Gruppo sintetico", eligible: 1 }],
};
export default function Fixture() {
  const [mode, setMode] = useState("admin"),
    [state, setState] = useState("ready"),
    [outcome, setOutcome] = useState("capacity");
  return (
    <main className="mx-auto max-w-6xl p-4">
      <h1 className="text-2xl">Fixture sintetica P13-E1</h1>
      <div className="my-4 flex flex-wrap gap-3">
        <label>
          Ruolo test
          <select
            aria-label="Ruolo test"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>
        <label>
          Configurazione test
          <select
            aria-label="Configurazione test"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="ready">Validata</option>
            <option value="draft">Bozza sconosciuta</option>
            <option value="empty">Nuova</option>
          </select>
        </label>
        <label>
          Esito test
          <select
            aria-label="Esito test"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          >
            <option value="capacity">Capienza</option>
            <option value="conflict">Conflitto</option>
            <option value="saved">Salvato</option>
          </select>
        </label>
      </div>
      <CeremonyWorkspace
        key={`${mode}:${state}`}
        kind="opening"
        admin={mode === "admin"}
        canManage={mode !== "viewer"}
        snapshot={
          state === "empty"
            ? {
                ...snapshot,
                plan: null,
                sectors: [],
                quotas: [],
                allocations: [],
                people: [],
                groups: [],
              }
            : state === "draft"
              ? {
                  ...snapshot,
                  plan: {
                    ...snapshot.plan!,
                    state: "draft",
                    capacity: null,
                    startsAt: null,
                    endsAt: null,
                  },
                  allocations: [],
                }
              : snapshot
        }
        save={async () => ({ status: outcome })}
      />
    </main>
  );
}

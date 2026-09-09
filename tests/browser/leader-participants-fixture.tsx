"use client";
import { useState } from "react";
import { LeaderParticipantsTable } from "@/app/dashboard/capogruppo/participants-table";
import type { LeaderTableRow } from "@/lib/groups/leader-table";
const rows: LeaderTableRow[] = Array.from({ length: 12 }, (_, i) => ({
  id: `assignment-${i}`,
  registrationId: `reg-${i}`,
  groupId: "root",
  participantName: i ? `Persona Prova ${i}` : "Anna Bianchi",
  participantCode: `FIX${i}`,
  participantEmail: `fixture${i}@example.test`,
  participantPhone: "+39 1234567",
  participantPlace: "Roma, Italia",
  participantCity: "Roma",
  participantCountry: "Italia",
  groupName: "Gruppo Roma",
  birthDate: "2000-01-01",
  submittedAt: "2026-09-07T10:00:00Z",
  tagIds: ["tag"],
  tags: [{ id: "tag", label: "Volontari", color: "#124A7A" }],
  serviceLabel: "Accoglienza",
}));
export default function Fixture() {
  const [operatorId, setOperatorId] = useState("leader-fixture-a");
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl p-5">
      <h1>Partecipanti del gruppo</h1>
      <button
        onClick={() =>
          setOperatorId(
            operatorId.endsWith("a") ? "leader-fixture-b" : "leader-fixture-a",
          )
        }
      >
        Cambia operatore
      </button>
      <LeaderParticipantsTable
        rows={rows}
        operatorId={operatorId}
        startsOn="2026-10-25"
        locale="it"
      />
    </main>
  );
}

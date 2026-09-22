"use client";
import type { SupportedLocale } from "@/lib/i18n/config";
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
  children: i === 0 ? [
    { id: "child-1", first_name: "Sofia", last_name: "Bianchi", birth_date: "2020-10-25", position: 1 },
    { id: "child-2", first_name: "Luca", last_name: "Bianchi", birth_date: "2026-05-01", position: 2 },
  ] : [],
  tags: [{ id: "tag", label: "Volontari", color: "#124A7A" }],
  serviceLabel: "Accoglienza",
}));
export default function Fixture() {
  const [locale, setLocale] = useState<SupportedLocale>("it");
  const [operatorId, setOperatorId] = useState("leader-fixture-a");
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl p-5">
      <h1>Partecipanti del gruppo</h1>
      <select aria-label="Lingua fixture" value={locale} onChange={event => setLocale(event.target.value as SupportedLocale)}>{["it", "en", "fr", "de", "es", "nl", "uk"].map(value => <option key={value}>{value}</option>)}</select>
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
        locale={locale}
      />
    </main>
  );
}

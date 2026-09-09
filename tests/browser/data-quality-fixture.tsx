"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ImportParticipantsDialog from "@/app/dashboard/participants/data-quality/import-dialog";
import {
  ImportPanel,
  ReviewPanel,
} from "@/app/dashboard/participants/data-quality/panels";
import { buildPreviewRows } from "@/lib/data-quality/preview";
import type { QualityPerson } from "@/lib/data-quality/data.server";
import type { ExcelRow } from "@/lib/data-quality/format";
const catalog = { groups: [], services: [], tags: [] };
const values: ExcelRow = {
  nome: "Maria",
  cognome: "Rossi",
  email: "maria@example.test",
  telefono: "+393331234567",
  data_nascita: "1990-01-01",
  paese: "Italia",
  citta: "Roma",
  gruppo: "",
  servizio: "",
  stato_servizio: "",
  tag: "",
  stato: "submitted",
  consenso_privacy: "si",
  versione_privacy: "fixture",
  data_consenso: "2026-01-01",
};
const person: QualityPerson = {
  id: "a",
  registrationId: "a",
  participantId: "pa",
  eventId: "e",
  eventTitle: "Fixture",
  name: "Maria Rossi",
  firstName: "Maria",
  lastName: "Rossi",
  birthDate: "1990-01-01",
  email: "maria@example.test",
  phone: "+393331234567",
  country: "Italia",
  city: "Roma",
  publicCode: "AAAA",
  authUserId: null,
  deletedAt: null,
  registrationStatus: "submitted",
  place: "Roma, Italia",
  currentGroupId: null,
  currentGroupName: null,
  currentGroupStatus: null,
  currentServiceId: null,
  currentServiceStatus: null,
  tagIds: [],
  children: [],
};
const rows = buildPreviewRows(
  [
    { row: 2, values: { ...values }, cellErrors: [] },
    { row: 3, values: { ...values, nome: "" }, cellErrors: [] },
  ],
  catalog,
  [person],
);
export default function Fixture() {
  const params = useSearchParams();
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      if (String(input).endsWith("/data-quality/api")) {
        if (init?.body instanceof FormData)
          return Response.json({ rows, token: "synthetic" });
        const data = JSON.parse(String(init?.body));
        document.documentElement.dataset.lastQualityAction = data.action;
        if (data.action === "review")
          return Response.json(
            { error: "Errore di prova: nessun dato modificato." },
            { status: 422 },
          );
        return Response.json({ imported: 1, skipped: 1 });
      }
      return original(input, init);
    };
    return () => {
      window.fetch = original;
    };
  }, []);
  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6">
      <h1 className="text-2xl font-bold">Qualità dati — prova locale</h1>
      {params.get("import") === "excel" ? (
        <ImportParticipantsDialog closePath="/data-quality-check?q=Maria&nav=mini" />
      ) : <ImportPanel />}
      <ReviewPanel
        left={person}
        right={{
          ...person,
          id: "b",
          registrationId: "b",
          publicCode: "BBBB",
          name: "Mario Rossi",
          firstName: "Mario",
        }}
        token="synthetic"
        catalog={catalog}
        canWrite
      />
    </main>
  );
}

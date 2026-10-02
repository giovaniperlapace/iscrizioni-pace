"use client";
import { useState } from "react";
import { AssistedDemographicFields } from "@/app/dashboard/assisted-demographic-fields";
import { ParticipantSearchField } from "@/app/dashboard/participant-search-field";
import { SuccessMessage } from "@/components/success-message";
export default function Fixture() {
  const [notice, setNotice] = useState(0);
  return <main className="mx-auto max-w-xl p-5">
    <h1>Verifica campi e conferma email</h1>
    {notice > 0 ? <SuccessMessage key={notice} attention persistent className="status-success">Campagna presa in carico: 12 email in coda.</SuccessMessage> : null}
    <form className="grid gap-4" onSubmit={e => e.preventDefault()}>
      <AssistedDemographicFields locale="it" initial={{ nationality: "Italian (Italy)", birthPlace: "Italia", country: "Italia" }} />
      <ParticipantSearchField name="existingUserId" label="Utente esistente" options={[
        {id:"a", name:"José Rossi",email:"jose@example.test",searchText:"AB12"},
        {id:"b", name:"Anna Bianchi",email:"anna@example.test"},
      ]} />
    </form>
    <div style={{height:1600}} />
    <button type="button" className="btn-primary" onClick={() => setNotice(n => n + 1)}>Simula risposta email</button>
  </main>;
}

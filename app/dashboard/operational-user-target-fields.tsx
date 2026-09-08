"use client";

import { useState } from "react";
import { ParticipantSearchField } from "@/app/dashboard/participant-search-field";
import type { RoleCandidate } from "@/lib/operational-users/role-candidates";

export function OperationalUserTargetFields({ candidates }: { candidates: RoleCandidate[] }) {
  const [mode, setMode] = useState("existing");
  return (
    <div className="grid gap-4">
      <input type="hidden" name="mode" value={mode} />
      <div className="grid grid-cols-2 gap-1 rounded-md border border-[var(--peace-border)] bg-white p-1" role="group" aria-label="Utente a cui assegnare il ruolo">
        {[{ value: "existing", label: "Utente esistente" }, { value: "new", label: "Nuovo utente" }].map((option) => (
          <button key={option.value} type="button" aria-pressed={mode === option.value}
            onClick={() => setMode(option.value)}
            className={`min-h-11 rounded-md px-3 text-sm font-semibold ${mode === option.value ? "bg-[var(--peace-blue-800)] text-white" : "text-[var(--peace-blue-800)] hover:bg-[var(--peace-sky-100)]"}`}>
            {option.label}
          </button>
        ))}
      </div>
      {mode === "existing" ? (
        <div className="grid gap-2">
          <ParticipantSearchField
            label="Utente esistente"
            name="existingUserId"
            options={candidates}
            placeholder="Inizia a digitare un nome o un’email"
            emptyQueryHint="Inizia a digitare"
          />
          <p className="text-sm font-normal text-[var(--peace-muted)]">Cerca per nome o email, anche tra gli utenti che non hanno ancora un ruolo.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold">Nome<input name="firstName" className="field bg-white font-normal" required /></label>
          <label className="grid gap-1 text-sm font-semibold">Cognome<input name="lastName" className="field bg-white font-normal" required /></label>
          <label className="grid gap-1 text-sm font-semibold">Email<input name="email" type="email" className="field bg-white font-normal" required /></label>
        </div>
      )}
    </div>
  );
}

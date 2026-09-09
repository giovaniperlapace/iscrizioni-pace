"use client";
import { useState } from "react";
import { OperationalUserTargetFields } from "@/app/dashboard/operational-user-target-fields";
import { OperationalRoleFields } from "@/app/dashboard/operational-role-fields";
export default function Fixture() {
  const [submitted, setSubmitted] = useState("");
  return <main className="mx-auto max-w-4xl p-5"><h1 className="text-xl font-semibold">Utenti e ruoli</h1>
    <form className="mt-5 grid gap-4 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4" onSubmit={(event) => {
      event.preventDefault(); setSubmitted(JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))));
    }}>
      <OperationalUserTargetFields candidates={[
        { id: "no-role", name: "Persona senza ruoli", email: "persona@example.test" },
        { id: "operator", name: "Operatore esistente", email: "operatore@example.test" },
      ]} />
      <OperationalRoleFields eventOptions={[{ id: "event", title: "Evento" }]} groupOptions={[]}
        roleOptions={[{ value: "accoglienza", label: "Accoglienza" }, { value: "manager_viewer", label: "Manager viewer" }]} showInviteOption />
      <button className="min-h-11 w-fit rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white">Assegna ruolo</button>
    </form><output className="block break-all" data-submitted>{submitted}</output></main>;
}
